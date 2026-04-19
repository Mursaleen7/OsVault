/**
 * Lockfile Parsers — Full Dependency Tree Resolution
 *
 * Parses lockfiles to extract the COMPLETE resolved dependency tree,
 * not just direct dependencies. This captures transitive deps that
 * are invisible in package.json / requirements.txt manifests.
 *
 * Supported lockfiles:
 *   • package-lock.json (npm v2/v3 format)
 *   • yarn.lock (v1 classic format)
 *   • pnpm-lock.yaml (basic support)
 *
 * Each parser returns dependencies with their resolved version and
 * depth in the dependency tree (0 = direct, 1+ = transitive).
 */

export interface ResolvedDep {
  name: string;
  version: string;
  ecosystem: "npm" | "PyPI" | "Go" | "Maven" | "Cargo";
  /** 0 = direct dependency, 1+ = transitive depth */
  depth: number;
}

/** Lockfile basenames we recognize */
export const LOCKFILE_NAMES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
];

// ---------------------------------------------------------------------------
// package-lock.json (npm lockfile v2/v3)
// ---------------------------------------------------------------------------

/**
 * Parse an npm package-lock.json to extract all resolved packages with depth.
 *
 * npm v2/v3 lockfiles use a flat "packages" map where keys are paths like:
 *   "" (root), "node_modules/lodash", "node_modules/express/node_modules/debug"
 *
 * Depth is derived from the number of nested node_modules segments.
 */
export function parsePackageLock(content: string): ResolvedDep[] {
  let lock: {
    packages?: Record<string, { version?: string; dev?: boolean }>;
    dependencies?: Record<string, { version?: string; requires?: Record<string, string> }>;
    lockfileVersion?: number;
  };

  try {
    lock = JSON.parse(content);
  } catch {
    console.warn("[lockfile] Failed to parse package-lock.json");
    return [];
  }

  const deps: ResolvedDep[] = [];

  // npm lockfile v2/v3: uses "packages" map with node_modules paths
  if (lock.packages) {
    for (const [path, info] of Object.entries(lock.packages)) {
      if (!path || !info.version) continue; // Skip root "" entry
      if (info.dev) continue; // Skip devDependencies

      // Extract package name from path: "node_modules/@scope/pkg" → "@scope/pkg"
      const segments = path.split("node_modules/");
      const name = segments[segments.length - 1];
      if (!name) continue;

      // Depth = number of node_modules segments - 1 (first is always the root)
      // "node_modules/lodash" → depth 0 (direct)
      // "node_modules/express/node_modules/debug" → depth 1
      const depth = Math.max(0, segments.length - 2);

      deps.push({
        name,
        version: info.version,
        ecosystem: "npm",
        depth,
      });
    }
    return deps;
  }

  // npm lockfile v1 fallback: uses "dependencies" map (flat, no depth info)
  if (lock.dependencies) {
    for (const [name, info] of Object.entries(lock.dependencies)) {
      if (!info.version) continue;
      deps.push({
        name,
        version: info.version,
        ecosystem: "npm",
        depth: 0, // v1 format doesn't encode depth reliably
      });
    }
    return deps;
  }

  return deps;
}

// ---------------------------------------------------------------------------
// yarn.lock (v1 classic format)
// ---------------------------------------------------------------------------

/**
 * Parse a yarn.lock (v1) file.
 *
 * Format: blocks of `"pkgname@^version":\n  version "resolved"\n`
 * Yarn classic doesn't encode dependency depth, so all entries are depth 0.
 */
export function parseYarnLock(content: string): ResolvedDep[] {
  const deps: ResolvedDep[] = [];
  const seen = new Set<string>();

  // Match blocks: "package@range":\n  version "x.y.z"
  const blockRe = /^"?([^@\s][^@]*?)@[^:]+:?\s*\n\s+version\s+"([^"]+)"/gm;

  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(content)) !== null) {
    const name = match[1].trim();
    const version = match[2];

    // Deduplicate by name (yarn.lock has multiple entries per package for different ranges)
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    deps.push({
      name,
      version,
      ecosystem: "npm",
      depth: 0, // yarn v1 doesn't encode tree depth
    });
  }

  return deps;
}

// ---------------------------------------------------------------------------
// pnpm-lock.yaml (basic support)
// ---------------------------------------------------------------------------

/**
 * Parse pnpm-lock.yaml using line-by-line regex (no YAML parser dependency).
 *
 * pnpm lockfiles list packages under either `packages:` or `importers:`.
 * We extract from the packages section: `/pkgname@version:` lines.
 */
export function parsePnpmLock(content: string): ResolvedDep[] {
  const deps: ResolvedDep[] = [];
  const seen = new Set<string>();

  // Match lines like: /lodash@4.17.21: or /@scope/pkg@1.0.0:
  // pnpm v6+ format: /package@version(peer_info):
  const pkgRe = /^\s+[/']?(@?[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?)@([^:()\s']+)/gm;

  let match: RegExpExecArray | null;
  while ((match = pkgRe.exec(content)) !== null) {
    const name = match[1];
    const version = match[2];

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    deps.push({
      name,
      version,
      ecosystem: "npm",
      depth: 0,
    });
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Unified parser
// ---------------------------------------------------------------------------

/**
 * Parse any supported lockfile based on filename.
 */
export function parseLockfile(filename: string, content: string): ResolvedDep[] {
  if (filename === "package-lock.json") return parsePackageLock(content);
  if (filename === "yarn.lock") return parseYarnLock(content);
  if (filename === "pnpm-lock.yaml") return parsePnpmLock(content);
  return [];
}
