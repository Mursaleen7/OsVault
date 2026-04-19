import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { App } from "@octokit/app";
import { checkPackages } from "./supabase";
import { parseDiff, DEP_FILES } from "./diff";
import { parseLockfile, LOCKFILE_NAMES } from "./lockfile";
import { postCheckRun } from "./checks";
import { isOverLimit, recordUsage } from "./usage";
import { analyzeReachability } from "./reachability";

const app = express();
app.use(express.json());

// Log ALL incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Webhook endpoint — GitHub posts here
// All GitHub App logic is initialised lazily inside the request handler
// so the server starts even before credentials are filled in.
// ---------------------------------------------------------------------------
app.post("/webhook", async (req, res) => {
  console.log("🔔 Webhook received!");
  console.log("  Event:", req.headers["x-github-event"]);
  console.log("  Delivery ID:", req.headers["x-github-delivery"]);
  console.log("  Signature:", req.headers["x-hub-signature-256"] ? "present" : "missing");
  
  const appId      = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const secret     = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey || !secret) {
    console.error("❌ GitHub App env vars not set — fill in GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET");
    res.status(500).send("GitHub App not configured");
    return;
  }
  
  console.log("✅ Environment variables loaded");
  console.log("  App ID:", appId);
  console.log("  Webhook secret:", secret.substring(0, 10) + "...");

  const githubApp = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    webhooks: { secret },
  });

  githubApp.webhooks.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async ({ payload, octokit }) => {
      console.log("📦 Processing pull_request event");
      const { pull_request: pr, repository, installation } = payload as any;
      const owner          = repository.owner.login as string;
      const repo           = repository.name as string;
      const headSha        = pr.head.sha as string;
      const prNumber       = pr.number as number;
      const isPrivate      = repository.private as boolean;
      const installationId = installation?.id as number;
      
      console.log(`  PR #${prNumber} in ${owner}/${repo}`);
      console.log(`  SHA: ${headSha.slice(0, 7)}`);
      console.log(`  Private: ${isPrivate}`);

      if (isPrivate && await isOverLimit(installationId)) {
        await postCheckRun(octokit as any, owner, repo, headSha, [], 0, true, installationId);
        return;
      }

      const { data: files } = await (octokit as any).request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        { owner, repo, pull_number: prNumber }
      );

      console.log(`  Files changed: ${files.length}`);
      console.log(`  Files: ${(files as any[]).map((f: any) => f.filename).join(', ')}`);

      const depFiles = (files as any[]).filter((f: any) => {
        const filename = f.filename;
        const basename = filename.split('/').pop();
        return DEP_FILES.includes(basename) && f.patch;
      });

      console.log(`  Dependency files found: ${depFiles.length}`);
      if (depFiles.length === 0) {
        console.log(`  ⏭️  No dependency files changed, skipping check`);
        return;
      }

      const packages = depFiles.flatMap((f: any) => {
        const basename = f.filename.split('/').pop();
        console.log(`  Processing ${f.filename}, patch length: ${f.patch?.length || 0}`);
        console.log(`  Patch preview: ${f.patch?.substring(0, 200)}`);
        const parsed = parseDiff(basename, f.patch);
        console.log(`  Parsed ${parsed.length} packages from ${f.filename}`);
        return parsed;
      });
      console.log(`  Packages extracted from diff: ${packages.length}`);
      if (packages.length === 0) {
        console.log(`  ⏭️  No packages found in diff, skipping check`);
        return;
      }

      // ── Step 0.5: Lockfile resolution (full transitive tree) ─────────
      // Fetch lockfiles from the repo at the HEAD SHA to capture ALL deps,
      // not just those changed in this PR's diff.
      let lockfileDeps: { name: string; version: string; ecosystem: "npm" | "PyPI" | "Go" | "Maven" | "Cargo"; depth: number }[] = [];
      try {
        for (const lockName of LOCKFILE_NAMES) {
          try {
            const { data: fileData } = await (octokit as any).request(
              "GET /repos/{owner}/{repo}/contents/{path}",
              { owner, repo, path: lockName, ref: headSha }
            );

            if (fileData && fileData.content) {
              const content = Buffer.from(fileData.content, "base64").toString("utf-8");
              const resolved = parseLockfile(lockName, content);
              if (resolved.length > 0) {
                lockfileDeps = resolved;
                console.log(`  📦 Parsed ${resolved.length} deps from ${lockName} (depths 0-${Math.max(...resolved.map(d => d.depth))})`);
                break; // Use the first lockfile found
              }
            }
          } catch {
            // File not found in repo — try next lockfile type
            continue;
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Lockfile resolution failed, continuing with diff-only scan:`, err);
      }

      // Merge: diff packages (direct changes) + lockfile packages (full tree)
      // Diff packages take priority (more specific version from the PR)
      const diffPkgNames = new Set(packages.map(p => p.name.toLowerCase()));
      const mergedPackages = [
        ...packages,
        ...lockfileDeps.filter(ld => !diffPkgNames.has(ld.name.toLowerCase())),
      ];
      console.log(`  Total packages for scanning: ${mergedPackages.length} (${packages.length} from diff + ${mergedPackages.length - packages.length} transitive from lockfile)`);

      // ── Step 1: Check Supabase for known vulnerabilities ──────────────
      const vulns = await checkPackages(mergedPackages);

      // ── Step 2: Reachability analysis ─────────────────────────────────
      // Only analyse reachability if we actually found vulnerabilities
      if (vulns.length > 0) {
        const vulnerablePackageNames = [...new Set(vulns.map((v) => v.package))];

        try {
          const reachabilityResults = await analyzeReachability(
            octokit as any,
            owner,
            repo,
            headSha,
            vulnerablePackageNames
          );

          // Merge reachability results back into the vuln objects
          for (const vuln of vulns) {
            const result = reachabilityResults.get(vuln.package);
            if (result) {
              vuln.isReachable = result.isReachable;
              vuln.reachabilityEvidence = result.evidence;
            }
          }

          console.log(
            `[reachability] ${owner}/${repo}@${headSha.slice(0, 7)}: ` +
            `${vulnerablePackageNames.length} packages checked, ` +
            `${vulns.filter((v) => v.isReachable).length} reachable, ` +
            `${vulns.filter((v) => !v.isReachable).length} bypassed`
          );
        } catch (err) {
          // If reachability analysis fails, all vulns stay as isReachable=true
          // (safety-first — we never accidentally suppress a real threat)
          console.error("[reachability] Analysis failed, defaulting to all reachable:", err);
        }
      }

      // ── Step 3: Record usage & post check run ─────────────────────────
      if (isPrivate) {
        await recordUsage(installationId, `${owner}/${repo}`, prNumber);
      }

      await postCheckRun(
        octokit as any,
        owner,
        repo,
        headSha,
        vulns,
        mergedPackages.length,
        false,
        installationId
      );
    }
  );

  try {
    console.log("🔐 Verifying webhook signature...");
    await githubApp.webhooks.verifyAndReceive({
      id:        req.headers["x-github-delivery"] as string,
      name:      req.headers["x-github-event"] as any,
      signature: req.headers["x-hub-signature-256"] as string,
      payload:   JSON.stringify(req.body),
    });
    console.log("✅ Webhook processed successfully");
    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(400).send("Bad request");
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Test endpoint to verify server is receiving requests
app.all("*", (req, res, next) => {
  console.log(`📨 Incoming request: ${req.method} ${req.path}`);
  if (req.path === "/webhook") {
    next();
  } else {
    res.status(404).json({ error: "Not found", path: req.path });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`OsVault GitHub App listening on :${PORT}`));
