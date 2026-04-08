"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSummary = buildSummary;
exports.postCheckRun = postCheckRun;
const APP_URL = process.env.APP_URL ?? "https://osvault.dev";
const SEVERITY_EMOJI = {
    CRITICAL: "🔴",
    HIGH: "🟠",
    MEDIUM: "🟡",
    LOW: "🟢",
};
/** Build the markdown summary for the GitHub Check */
function buildSummary(vulns, totalScanned, isOverLimit, installationId) {
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
    if (vulns.length === 0) {
        return {
            title: `OsVault — ✅ No vulnerabilities found (${totalScanned} packages scanned)`,
            summary: `## OsVault Security Check\n\n✅ **${totalScanned} packages scanned. No known vulnerabilities found.**`,
            conclusion: "success",
        };
    }
    const kevVulns = vulns.filter((v) => v.in_kev);
    const criticalVulns = vulns.filter((v) => v.cvss_severity === "CRITICAL");
    const highVulns = vulns.filter((v) => v.cvss_severity === "HIGH");
    // Fail the check if any CISA KEV or CRITICAL vulns are present
    const shouldFail = kevVulns.length > 0 || criticalVulns.length > 0;
    const title = shouldFail
        ? `OsVault — ❌ ${criticalVulns.length} critical, ${kevVulns.length} CISA-exploited vulnerabilities found`
        : `OsVault — ⚠️ ${vulns.length} vulnerabilit${vulns.length === 1 ? "y" : "ies"} found`;
    const rows = vulns.slice(0, 20).map((v) => {
        const id = v.cve_id ? `[${v.cve_id}](${APP_URL}/cve/${v.cve_id})` : (v.osv_id ?? "—");
        const sev = `${SEVERITY_EMOJI[v.cvss_severity ?? ""] ?? "⚪"} ${v.cvss_severity ?? "—"}`;
        const kev = v.in_kev ? " 🚨 **CISA KEV**" : "";
        const desc = v.summary?.slice(0, 80) ?? "—";
        return `| \`${v.package}\` | ${id}${kev} | ${sev} | ${v.cvss_score ?? "—"} | ${desc} |`;
    });
    const table = [
        "| Package | CVE / OSV ID | Severity | CVSS | Summary |",
        "|---------|-------------|----------|------|---------|",
        ...rows,
        ...(vulns.length > 20 ? [`| … | +${vulns.length - 20} more | | | |`] : []),
    ].join("\n");
    const kevWarning = kevVulns.length > 0
        ? `\n> 🚨 **${kevVulns.length} CISA Known Exploited Vulnerabilit${kevVulns.length === 1 ? "y" : "ies"} detected.** These are actively exploited in the wild. Merge is blocked until resolved.\n`
        : "";
    const summary = [
        "## OsVault Security Check",
        "",
        kevWarning,
        `**${totalScanned}** packages scanned · **${vulns.length}** vulnerable · **${criticalVulns.length}** critical · **${highVulns.length}** high`,
        "",
        table,
        "",
        `---`,
        `[View full report on OsVault](${APP_URL}/checker) · [Docs](${APP_URL})`,
    ].join("\n");
    return { title, summary, conclusion: shouldFail ? "failure" : "success" };
}
/** Create a GitHub Check Run and post results */
async function postCheckRun(octokit, owner, repo, headSha, vulns, totalScanned, overLimit, installationId) {
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
