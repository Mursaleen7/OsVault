"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const express_1 = __importDefault(require("express"));
const app_1 = require("@octokit/app");
const supabase_1 = require("./supabase");
const diff_1 = require("./diff");
const checks_1 = require("./checks");
const usage_1 = require("./usage");
const reachability_1 = require("./reachability");
const app = (0, express_1.default)();
app.use(express_1.default.json());
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
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!appId || !privateKey || !secret) {
        console.error("❌ GitHub App env vars not set — fill in GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET");
        res.status(500).send("GitHub App not configured");
        return;
    }
    console.log("✅ Environment variables loaded");
    console.log("  App ID:", appId);
    console.log("  Webhook secret:", secret.substring(0, 10) + "...");
    const githubApp = new app_1.App({
        appId,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        webhooks: { secret },
    });
    githubApp.webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload, octokit }) => {
        console.log("📦 Processing pull_request event");
        const { pull_request: pr, repository, installation } = payload;
        const owner = repository.owner.login;
        const repo = repository.name;
        const headSha = pr.head.sha;
        const prNumber = pr.number;
        const isPrivate = repository.private;
        const installationId = installation?.id;
        console.log(`  PR #${prNumber} in ${owner}/${repo}`);
        console.log(`  SHA: ${headSha.slice(0, 7)}`);
        console.log(`  Private: ${isPrivate}`);
        if (isPrivate && await (0, usage_1.isOverLimit)(installationId)) {
            await (0, checks_1.postCheckRun)(octokit, owner, repo, headSha, [], 0, true, installationId);
            return;
        }
        const { data: files } = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", { owner, repo, pull_number: prNumber });
        console.log(`  Files changed: ${files.length}`);
        console.log(`  Files: ${files.map((f) => f.filename).join(', ')}`);
        const depFiles = files.filter((f) => {
            const filename = f.filename;
            const basename = filename.split('/').pop();
            return diff_1.DEP_FILES.includes(basename) && f.patch;
        });
        console.log(`  Dependency files found: ${depFiles.length}`);
        if (depFiles.length === 0) {
            console.log(`  ⏭️  No dependency files changed, skipping check`);
            return;
        }
        const packages = depFiles.flatMap((f) => {
            const basename = f.filename.split('/').pop();
            console.log(`  Processing ${f.filename}, patch length: ${f.patch?.length || 0}`);
            console.log(`  Patch preview: ${f.patch?.substring(0, 200)}`);
            const parsed = (0, diff_1.parseDiff)(basename, f.patch);
            console.log(`  Parsed ${parsed.length} packages from ${f.filename}`);
            return parsed;
        });
        console.log(`  Packages extracted: ${packages.length}`);
        if (packages.length === 0) {
            console.log(`  ⏭️  No packages found in diff, skipping check`);
            return;
        }
        // ── Step 1: Check Supabase for known vulnerabilities ──────────────
        const vulns = await (0, supabase_1.checkPackages)(packages);
        // ── Step 2: Reachability analysis ─────────────────────────────────
        // Only analyse reachability if we actually found vulnerabilities
        if (vulns.length > 0) {
            const vulnerablePackageNames = [...new Set(vulns.map((v) => v.package))];
            try {
                const reachabilityResults = await (0, reachability_1.analyzeReachability)(octokit, owner, repo, headSha, vulnerablePackageNames);
                // Merge reachability results back into the vuln objects
                for (const vuln of vulns) {
                    const result = reachabilityResults.get(vuln.package);
                    if (result) {
                        vuln.isReachable = result.isReachable;
                        vuln.reachabilityEvidence = result.evidence;
                    }
                }
                console.log(`[reachability] ${owner}/${repo}@${headSha.slice(0, 7)}: ` +
                    `${vulnerablePackageNames.length} packages checked, ` +
                    `${vulns.filter((v) => v.isReachable).length} reachable, ` +
                    `${vulns.filter((v) => !v.isReachable).length} bypassed`);
            }
            catch (err) {
                // If reachability analysis fails, all vulns stay as isReachable=true
                // (safety-first — we never accidentally suppress a real threat)
                console.error("[reachability] Analysis failed, defaulting to all reachable:", err);
            }
        }
        // ── Step 3: Record usage & post check run ─────────────────────────
        if (isPrivate) {
            await (0, usage_1.recordUsage)(installationId, `${owner}/${repo}`, prNumber);
        }
        await (0, checks_1.postCheckRun)(octokit, owner, repo, headSha, vulns, packages.length, false, installationId);
    });
    try {
        console.log("🔐 Verifying webhook signature...");
        await githubApp.webhooks.verifyAndReceive({
            id: req.headers["x-github-delivery"],
            name: req.headers["x-github-event"],
            signature: req.headers["x-hub-signature-256"],
            payload: JSON.stringify(req.body),
        });
        console.log("✅ Webhook processed successfully");
        res.status(200).send("ok");
    }
    catch (err) {
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
    }
    else {
        res.status(404).json({ error: "Not found", path: req.path });
    }
});
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`OsVault GitHub App listening on :${PORT}`));
