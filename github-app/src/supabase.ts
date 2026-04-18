import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export interface VulnMatch {
  package: string;
  version: string;
  osv_id: string | null;
  cve_id: string | null;
  summary: string | null;
  cvss_score: number | null;
  cvss_severity: string | null;
  combined_risk_score: number | null;
  in_kev: boolean;
  /** Whether the package is actually imported in the source tree */
  isReachable: boolean;
  /** File paths where the import was detected (up to 5) */
  reachabilityEvidence: string[];
}

export async function checkPackages(
  packages: { name: string; version: string; ecosystem: "npm" | "PyPI" }[]
): Promise<VulnMatch[]> {
  if (packages.length === 0) return [];

  const ecosystems = [...new Set(packages.map((p) => p.ecosystem))];

  // Step 1: get OSV rows — these have affected_packages but often no CVSS
  const { data: osvRows } = await supabase
    .from("vulnerabilities")
    .select("osv_id, cve_id, summary, cvss_score, cvss_severity, combined_risk_score, in_kev, affected_packages")
    .eq("source", "osv")
    .in("ecosystem", ecosystems);

  const rows = osvRows ?? [];
  const vulns: VulnMatch[] = [];

  for (const pkg of packages) {
    const matching = rows.filter((row: Record<string, unknown>) => {
      if (!row.affected_packages) return false;
      const pkgs: { name: string; ecosystem: string }[] =
        typeof row.affected_packages === "string"
          ? JSON.parse(row.affected_packages as string)
          : row.affected_packages as { name: string; ecosystem: string }[];
      return pkgs.some(
        (p) =>
          p.name.toLowerCase() === pkg.name.toLowerCase() &&
          p.ecosystem?.toLowerCase() === pkg.ecosystem.toLowerCase()
      );
    });

    for (const row of matching) {
      vulns.push({
        package:             pkg.name,
        version:             pkg.version,
        osv_id:              row.osv_id as string | null,
        cve_id:              row.cve_id as string | null,
        summary:             row.summary as string | null,
        cvss_score:          row.cvss_score as number | null,
        cvss_severity:       row.cvss_severity as string | null,
        combined_risk_score: row.combined_risk_score as number | null,
        in_kev:              (row.in_kev as boolean) ?? false,
        isReachable:         true,           // default — reachability engine will override
        reachabilityEvidence: [],
      });
    }
  }

  // Step 2: enrich with NVD scores for any vuln that has a cve_id but no severity
  const missingScores = vulns.filter(v => v.cve_id && !v.cvss_severity);
  if (missingScores.length > 0) {
    const cveIds = [...new Set(missingScores.map(v => v.cve_id as string))];

    const { data: nvdRows } = await supabase
      .from("vulnerabilities")
      .select("cve_id, cvss_score, cvss_severity, combined_risk_score, in_kev")
      .in("cve_id", cveIds);

    if (nvdRows && nvdRows.length > 0) {
      const nvdMap = new Map(nvdRows.map((r: Record<string, unknown>) => [r.cve_id, r]));
      for (const vuln of vulns) {
        if (vuln.cve_id && !vuln.cvss_severity) {
          const nvd = nvdMap.get(vuln.cve_id);
          if (nvd) {
            vuln.cvss_score          = nvd.cvss_score as number | null;
            vuln.cvss_severity       = nvd.cvss_severity as string | null;
            vuln.combined_risk_score = nvd.combined_risk_score as number | null;
            vuln.in_kev              = (nvd.in_kev as boolean) ?? vuln.in_kev;
          }
        }
      }
    }
  }

  return vulns.sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0));
}
