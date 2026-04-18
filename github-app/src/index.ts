import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import { App } from "@octokit/app";
import { checkPackages } from "./supabase";
import { parseDiff, DEP_FILES } from "./diff";
import { postCheckRun } from "./checks";
import { isOverLimit, recordUsage } from "./usage";
import { analyzeReachability } from "./reachability";

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------------
// Webhook endpoint — GitHub posts here
// All GitHub App logic is initialised lazily inside the request handler
// so the server starts even before credentials are filled in.
// ---------------------------------------------------------------------------
app.post("/webhook", async (req, res) => {
  const appId      = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const secret     = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey || !secret) {
    console.error("GitHub App env vars not set — fill in GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET");
    res.status(500).send("GitHub App not configured");
    return;
  }

  const githubApp = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    webhooks: { secret },
  });

  githubApp.webhooks.on(
    ["pull_request.opened", "pull_request.synchronize"],
    async ({ payload, octokit }) => {
      const { pull_request: pr, repository, installation } = payload as any;
      const owner          = repository.owner.login as string;
      const repo           = repository.name as string;
      const headSha        = pr.head.sha as string;
      const prNumber       = pr.number as number;
      const isPrivate      = repository.private as boolean;
      const installationId = installation?.id as number;

      if (isPrivate && await isOverLimit(installationId)) {
        await postCheckRun(octokit as any, owner, repo, headSha, [], 0, true, installationId);
        return;
      }

      const { data: files } = await (octokit as any).request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
        { owner, repo, pull_number: prNumber }
      );

      const depFiles = (files as any[]).filter((f: any) =>
        DEP_FILES.includes(f.filename) && f.patch
      );

      if (depFiles.length === 0) return;

      const packages = depFiles.flatMap((f: any) => parseDiff(f.filename, f.patch));
      if (packages.length === 0) return;

      // ── Step 1: Check Supabase for known vulnerabilities ──────────────
      const vulns = await checkPackages(packages);

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
        packages.length,
        false,
        installationId
      );
    }
  );

  try {
    await githubApp.webhooks.verifyAndReceive({
      id:        req.headers["x-github-delivery"] as string,
      name:      req.headers["x-github-event"] as any,
      signature: req.headers["x-hub-signature-256"] as string,
      payload:   JSON.stringify(req.body),
    });
    res.status(200).send("ok");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).send("Bad request");
  }
});

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`OsVault GitHub App listening on :${PORT}`));
