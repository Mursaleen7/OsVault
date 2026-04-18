import type { Octokit } from "@octokit/core";
import type { VulnMatch } from "./supabase";

const APP_URL = process.env.APP_URL ?? "https://osvault.dev";

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH:     "🟠",
  MEDIUM:   "🟡",
  LOW:      "🟢",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Partition vulnerabilities into reachable and unreachable buckets */
function partitionByReachability(vulns: VulnMatch[]): {
  reachable: VulnMatch[];
  unreachable: VulnMatch[];
} {
  const reachable: VulnMatch[] = [];
  const unreachable: VulnMatch[] = [];
  for (const v of vulns) {
    if (v.isReachable) {
      reachable.push(v);
    } else {
      unreachable.push(v);
    }
  }
  return { reachable, unreachable };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

/** Build the markdown summary for the GitHub Check */
export function buildSummary(
  vulns: VulnMatch[],
  totalScanned: number,
  isOverLimit: boolean,
  installationId: number
): { title: string; summary: string; conclusion: "success" | "failure" } {
  // Paywall gate
  if (isOverLimit) {
    return {
      title: "OsVault — Usage limit reached",
      summary: [
        "## OsVault Security Check",
        "",
        "Your installation has reached the **10 free checks/month** limit for private repositories.",
        "",
        `[Upgrade to OsVault Pro](${APP_URL}/upgrade?ref=github&installation=${installationId}) to unlock unlimited checks.`,
      ].join("\n"),
      conclusion: "success", // don't block the PR, just notify
    };
  }

  // No vulnerabilities at all
  if (vulns.length === 0) {
    return {
      title: `OsVault — ✅ No vulnerabilities found (${totalScanned} packages scanned)`,
      summary: `## OsVault Security Check\n\n✅ **${totalScanned} packages scanned. No known vulnerabilities found.**`,
      conclusion: "success",
    };
  }

  // ── Partition by reachability ──────────────────────────────────────────
  const { reachable, unreachable } = partitionByReachability(vulns);

  // Only reachable vulnerabilities should block the PR
  const kevVulns      = reachable.filter((v) => v.in_kev);
  const criticalVulns = reachable.filter((v) => v.cvss_severity === "CRITICAL");
  const highVulns     = reachable.filter((v) => v.cvss_severity === "HIGH");

  // Fail only if there are reachable CISA KEV or CRITICAL vulns
  const shouldFail = kevVulns.length > 0 || criticalVulns.length > 0;

  // ── Title ─────────────────────────────────────────────────────────────
  let title: string;
  if (shouldFail) {
    title = `OsVault — ❌ ${criticalVulns.length} critical, ${kevVulns.length} CISA-exploited vulnerabilities (reachable)`;
  } else if (reachable.length > 0) {
    title = `OsVault — ⚠️ ${reachable.length} reachable vulnerabilit${reachable.length === 1 ? "y" : "ies"} found`;
  } else {
    // All vulns are unreachable!
    title = `OsVault — ✅ ${unreachable.length} vulnerabilit${unreachable.length === 1 ? "y" : "ies"} found but ALL are unreachable`;
  }

  // ── Reachable table ───────────────────────────────────────────────────
  let reachableSection = "";
  if (reachable.length > 0) {
    const rows = reachable.slice(0, 20).map((v) => {
      const id   = v.cve_id ? `[${v.cve_id}](${APP_URL}/cve/${v.cve_id})` : (v.osv_id ?? "—");
      const sev  = `${SEVERITY_EMOJI[v.cvss_severity ?? ""] ?? "⚪"} ${v.cvss_severity ?? "—"}`;
      const kev  = v.in_kev ? " 🚨 **CISA KEV**" : "";
      const desc = v.summary?.slice(0, 80) ?? "—";
      return `| \`${v.package}\` | ${id}${kev} | ${sev} | ${v.cvss_score ?? "—"} | 🚨 REACHABLE | ${desc} |`;
    });

    reachableSection = [
      "",
      "### 🚨 Reachable Vulnerabilities — Action Required",
      "",
      "These packages are **directly imported** in your source code. The vulnerability is exploitable.",
      "",
      "| Package | CVE / OSV ID | Severity | CVSS | Status | Summary |",
      "|---------|-------------|----------|------|--------|---------|",
      ...rows,
      ...(reachable.length > 20 ? [`| … | +${reachable.length - 20} more | | | | |`] : []),
    ].join("\n");
  }

  // ── Unreachable table ─────────────────────────────────────────────────
  let unreachableSection = "";
  if (unreachable.length > 0) {
    const rows = unreachable.slice(0, 15).map((v) => {
      const id   = v.cve_id ? `[${v.cve_id}](${APP_URL}/cve/${v.cve_id})` : (v.osv_id ?? "—");
      const sev  = `${SEVERITY_EMOJI[v.cvss_severity ?? ""] ?? "⚪"} ~~${v.cvss_severity ?? "—"}~~`;
      const desc = v.summary?.slice(0, 80) ?? "—";
      return `| ~~\`${v.package}\`~~ | ${id} | ${sev} | ~~${v.cvss_score ?? "—"}~~ | 🛡️ BYPASSED | ${desc} |`;
    });

    unreachableSection = [
      "",
      `### 🛡️ ${unreachable.length} Vulnerabilit${unreachable.length === 1 ? "y" : "ies"} Bypassed — Proven Unreachable`,
      "",
      "> **OsVault scanned your source code and confirmed these packages are never imported.** These vulnerabilities cannot affect your application and have been automatically excluded from the security gate.",
      "",
      "| Package | CVE / OSV ID | Severity | CVSS | Status | Summary |",
      "|---------|-------------|----------|------|--------|---------|",
      ...rows,
      ...(unreachable.length > 15 ? [`| … | +${unreachable.length - 15} more bypassed | | | | |`] : []),
    ].join("\n");
  }

  // ── KEV warning ───────────────────────────────────────────────────────
  const kevWarning = kevVulns.length > 0
    ? `\n> 🚨 **${kevVulns.length} CISA Known Exploited Vulnerabilit${kevVulns.length === 1 ? "y" : "ies"} detected.** These are actively exploited in the wild and are imported in your code. Merge is blocked until resolved.\n`
    : "";

  // ── Compose final summary ─────────────────────────────────────────────
  const statsLine = [
    `**${totalScanned}** packages scanned`,
    `**${vulns.length}** vulnerable`,
    `**${reachable.length}** reachable`,
    `**${unreachable.length}** bypassed`,
    `**${criticalVulns.length}** critical`,
    `**${highVulns.length}** high`,
  ].join(" · ");

  const summary = [
    "## OsVault Security Check",
    "",
    kevWarning,
    statsLine,
    reachableSection,
    unreachableSection,
    "",
    "---",
    `[View full report on OsVault](${APP_URL}/checker) · [Docs](${APP_URL})`,
  ].join("\n");

  return { title, summary, conclusion: shouldFail ? "failure" : "success" };
}

// ---------------------------------------------------------------------------
// Post Check Run
// ---------------------------------------------------------------------------

/** Create a GitHub Check Run and post results */
export async function postCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
  vulns: VulnMatch[],
  totalScanned: number,
  overLimit: boolean,
  installationId: number
) {
  const { title, summary, conclusion } = buildSummary(vulns, totalScanned, overLimit, installationId);

  await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
    owner,
    repo,
    name: "OsVault Security",
    head_sha: headSha,
    status: "completed",
    conclusion,
    completed_at: new Date().toISOString(),
    output: { title, summary },
  });
}
