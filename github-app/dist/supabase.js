"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.checkPackages = checkPackages;
const supabase_js_1 = require("@supabase/supabase-js");
exports.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
async function checkPackages(packages) {
    if (packages.length === 0)
        return [];
    const ecosystems = [...new Set(packages.map((p) => p.ecosystem))];
    // Step 1: get OSV rows — these have affected_packages but often no CVSS
    const { data: osvRows } = await exports.supabase
        .from("vulnerabilities")
        .select("osv_id, cve_id, summary, cvss_score, cvss_severity, combined_risk_score, in_kev, affected_packages")
        .eq("source", "osv")
        .in("ecosystem", ecosystems);
    const rows = osvRows ?? [];
    const vulns = [];
    for (const pkg of packages) {
        const matching = rows.filter((row) => {
            if (!row.affected_packages)
                return false;
            const pkgs = typeof row.affected_packages === "string"
                ? JSON.parse(row.affected_packages)
                : row.affected_packages;
            return pkgs.some((p) => p.name.toLowerCase() === pkg.name.toLowerCase() &&
                p.ecosystem?.toLowerCase() === pkg.ecosystem.toLowerCase());
        });
        for (const row of matching) {
            vulns.push({
                package: pkg.name,
                version: pkg.version,
                osv_id: row.osv_id,
                cve_id: row.cve_id,
                summary: row.summary,
                cvss_score: row.cvss_score,
                cvss_severity: row.cvss_severity,
                combined_risk_score: row.combined_risk_score,
                in_kev: row.in_kev ?? false,
            });
        }
    }
    // Step 2: enrich with NVD scores for any vuln that has a cve_id but no severity
    const missingScores = vulns.filter(v => v.cve_id && !v.cvss_severity);
    if (missingScores.length > 0) {
        const cveIds = [...new Set(missingScores.map(v => v.cve_id))];
        const { data: nvdRows } = await exports.supabase
            .from("vulnerabilities")
            .select("cve_id, cvss_score, cvss_severity, combined_risk_score, in_kev")
            .in("cve_id", cveIds);
        if (nvdRows && nvdRows.length > 0) {
            const nvdMap = new Map(nvdRows.map((r) => [r.cve_id, r]));
            for (const vuln of vulns) {
                if (vuln.cve_id && !vuln.cvss_severity) {
                    const nvd = nvdMap.get(vuln.cve_id);
                    if (nvd) {
                        vuln.cvss_score = nvd.cvss_score;
                        vuln.cvss_severity = nvd.cvss_severity;
                        vuln.combined_risk_score = nvd.combined_risk_score;
                        vuln.in_kev = nvd.in_kev ?? vuln.in_kev;
                    }
                }
            }
        }
    }
    return vulns.sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0));
}
