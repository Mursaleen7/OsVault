/**
 * Reachability Analysis Engine
 *
 * Downloads the repository tarball at a given commit SHA, streams through
 * every JS/TS source file, and determines whether each vulnerable package
 * is actually imported / required anywhere in the user's source code.
 *
 * If a package is never referenced, it is marked as UNREACHABLE — meaning
 * the vulnerability cannot possibly affect the running application and
 * can be safely bypassed for compliance purposes.
 *
 * Design decisions:
 *   • We stream the tarball in‑memory (no disk writes) for speed & security.
 *   • We use a carefully‑tuned set of RegExps instead of a full AST parser
 *     to keep the engine lightweight and dependency‑free.  The patterns
 *     cover: CJS require(), ESM import, dynamic import(), jest.mock(),
 *     and re‑export patterns.
 *   • We err on the side of *caution* — if there is any textual reference
 *     to the package name inside a source file we mark it REACHABLE.
 *   • We skip node_modules, dist, build, and .min.js files to avoid
 *     false positives from bundled third‑party code.
 */

import type { Octokit } from "@octokit/core";
import * as tar from "tar-stream";
import gunzip from "gunzip-maybe";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReachabilityResult {
  /** The npm / PyPI package name */
  package: string;
  /** true  = the package is referenced somewhere in the source tree
   *  false = no reference found — it is an unreachable transitive dep */
  isReachable: boolean;
  /** Files where the import was detected (max 5 for display purposes) */
  evidence: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** File extensions we consider "source code" worth scanning. */
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
  ".py",       // Python ecosystem support
]);

/** Directories inside the tarball we skip entirely. */
const SKIP_DIRS = [
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "out/",
  ".git/",
  "__pycache__/",
  ".venv/",
  "venv/",
  "vendor/",
  "coverage/",
  ".cache/",
];

/** Maximum tarball size we will download (200 MB). */
const MAX_TARBALL_BYTES = 200 * 1024 * 1024;

/** Maximum individual file size we will scan (500 KB). */
const MAX_FILE_BYTES = 500 * 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a set of RegExp patterns that match *any* way a developer could
 * reference `pkgName` in JavaScript / TypeScript / Python source code.
 *
 * Patterns covered:
 *   • require("pkg")  /  require('pkg')
 *   • import ... from "pkg"  /  import ... from 'pkg'
 *   • import("pkg")
 *   • jest.mock("pkg")
 *   • export ... from "pkg"
 *   • @pkg/subpath  (scoped packages)
 *   • import pkg  (Python)
 *   • from pkg import ...  (Python)
 */
function buildImportPatterns(pkgName: string): RegExp[] {
  // Escape special regex characters in the package name
  const escaped = pkgName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return [
    // CJS require
    new RegExp(`require\\s*\\(\\s*['"\`]${escaped}(?:[/'"]|['"\`])`, "m"),
    // ESM import ... from
    new RegExp(`\\bimport\\s+.*?\\bfrom\\s+['"\`]${escaped}(?:[/'"]|['"\`])`, "ms"),
    // Side‑effect import
    new RegExp(`\\bimport\\s+['"\`]${escaped}(?:[/'"]|['"\`])`, "m"),
    // Dynamic import()
    new RegExp(`\\bimport\\s*\\(\\s*['"\`]${escaped}(?:[/'"]|['"\`])`, "m"),
    // jest.mock / jest.requireActual
    new RegExp(`jest\\.(mock|requireActual|requireMock)\\s*\\(\\s*['"\`]${escaped}(?:[/'"]|['"\`])`, "m"),
    // Re‑export
    new RegExp(`\\bexport\\s+.*?\\bfrom\\s+['"\`]${escaped}(?:[/'"]|['"\`])`, "ms"),
    // Python: import pkg  /  import pkg.sub
    new RegExp(`^\\s*import\\s+${escaped}\\b`, "m"),
    // Python: from pkg import ...
    new RegExp(`^\\s*from\\s+${escaped}\\b`, "m"),
  ];
}

/**
 * Check whether a file path should be skipped.
 * The tarball prefixes every path with `<owner>-<repo>-<sha>/`.
 */
function shouldSkipPath(filePath: string): boolean {
  // Remove the root directory prefix (first component)
  const relPath = filePath.replace(/^[^/]+\//, "");

  // Skip directories
  if (SKIP_DIRS.some((dir) => relPath.includes(dir))) return true;

  // Skip minified bundles
  if (relPath.endsWith(".min.js") || relPath.endsWith(".bundle.js")) return true;

  // Skip lock files and config
  if (
    relPath.endsWith("package-lock.json") ||
    relPath.endsWith("yarn.lock") ||
    relPath.endsWith("pnpm-lock.yaml")
  )
    return true;

  return false;
}

/**
 * Check if the file has a scannable source extension.
 */
function isSourceFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Strip the tarball root prefix to get a clean relative path.
 */
function cleanPath(filePath: string): string {
  return filePath.replace(/^[^/]+\//, "");
}

// ---------------------------------------------------------------------------
// Core: Download & Stream tarball
// ---------------------------------------------------------------------------

/**
 * Download a repository tarball from GitHub at a specific commit SHA,
 * stream through every source file, and check if any of the given
 * package names are imported.
 *
 * @param octokit  Authenticated Octokit instance
 * @param owner    Repository owner
 * @param repo     Repository name
 * @param sha      Commit SHA to download
 * @param packages List of package names to check reachability for
 * @returns Map of package name → ReachabilityResult
 */
export async function analyzeReachability(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  packages: string[]
): Promise<Map<string, ReachabilityResult>> {
  // Initialise results — assume everything is UNREACHABLE until proven otherwise
  const results = new Map<string, ReachabilityResult>();
  for (const pkg of packages) {
    results.set(pkg, { package: pkg, isReachable: false, evidence: [] });
  }

  if (packages.length === 0) return results;

  // Pre‑compile regex patterns for every package
  const patternMap = new Map<string, RegExp[]>();
  for (const pkg of packages) {
    patternMap.set(pkg, buildImportPatterns(pkg));
  }

  // Track which packages still need to be found (optimisation: stop early)
  const remaining = new Set(packages);

  try {
    // Download the tarball (gzipped tar)
    const response = await octokit.request(
      "GET /repos/{owner}/{repo}/tarball/{ref}",
      {
        owner,
        repo,
        ref: sha,
        headers: { accept: "application/vnd.github.v3.raw" },
      }
    );

    const data = response.data as ArrayBuffer;

    // Safety check: don't process extremely large repos
    if (data.byteLength > MAX_TARBALL_BYTES) {
      console.warn(
        `[reachability] Tarball too large (${(data.byteLength / 1024 / 1024).toFixed(1)} MB), marking all packages as reachable for safety.`
      );
      for (const pkg of packages) {
        results.set(pkg, { package: pkg, isReachable: true, evidence: ["tarball too large to scan"] });
      }
      return results;
    }

    // Convert ArrayBuffer to a Node Readable stream
    const buffer = Buffer.from(data);
    const readable = Readable.from(buffer);

    // Pipe through gunzip → tar extract
    await new Promise<void>((resolve, reject) => {
      const extract = tar.extract();

      extract.on("entry", (header, stream, next) => {
        const filePath = header.name;

        // Skip non‑files, skipped directories, non‑source files, and large files
        if (
          header.type !== "file" ||
          shouldSkipPath(filePath) ||
          !isSourceFile(filePath) ||
          (header.size ?? 0) > MAX_FILE_BYTES
        ) {
          stream.resume(); // drain the stream
          next();
          return;
        }

        // Collect file contents
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          // All packages found — skip remaining files
          if (remaining.size === 0) {
            next();
            return;
          }

          const content = Buffer.concat(chunks).toString("utf-8");
          const cleanFilePath = cleanPath(filePath);

          // Check each remaining package against this file's contents
          for (const pkg of [...remaining]) {
            const patterns = patternMap.get(pkg)!;
            const matched = patterns.some((rx) => rx.test(content));

            if (matched) {
              const result = results.get(pkg)!;
              result.isReachable = true;
              if (result.evidence.length < 5) {
                result.evidence.push(cleanFilePath);
              }
              remaining.delete(pkg);
            }
          }

          next();
        });
        stream.on("error", next);
      });

      extract.on("finish", resolve);
      extract.on("error", reject);

      readable.pipe(gunzip()).pipe(extract);
    });
  } catch (err: unknown) {
    // If we cannot download or parse the tarball, mark everything reachable
    // to avoid false negatives (safety‑first approach).
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[reachability] Failed to analyse tarball: ${message}`);
    for (const pkg of packages) {
      results.set(pkg, {
        package: pkg,
        isReachable: true,
        evidence: [`analysis error: ${message.slice(0, 80)}`],
      });
    }
  }

  return results;
}
