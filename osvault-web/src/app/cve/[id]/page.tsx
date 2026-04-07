import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { AFFILIATES } from "@/lib/affiliates";

const BASE_URL = "https://os-vault-kappa.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabase
    .from("vulnerabilities")
    .select("cvss_severity, description")
    .eq("cve_id", id)
    .single();

  const severity = data?.cvss_severity ?? "CVE";
  const desc = data?.description?.slice(0, 155) ?? `Security vulnerability details, CVSS score, and risk analysis for ${id}.`;

  return {
    title: `${id} — ${severity} Severity Vulnerability | OsVault`,
    description: desc,
    alternates: { canonical: `${BASE_URL}/cve/${id}` },
    openGraph: {
      title: `${id} ${severity} Vulnerability`,
      description: desc,
      url: `${BASE_URL}/cve/${id}`,
      siteName: "OsVault",
      type: "article",
    },
  };
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a",
};
const SEVERITY_BG: Record<string, string> = {
  CRITICAL: "#fef2f2", HIGH: "#fff7ed", MEDIUM: "#fefce8", LOW: "#f0fdf4",
};

function SeverityBadge({ severity }: { severity: string | null }) {
  if (!severity) return <span style={{ color: "#6b7280" }}>N/A</span>;
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 13, fontWeight: 700, background: SEVERITY_BG[severity] ?? "#f3f4f6", color: SEVERITY_COLOR[severity] ?? "#374151", border: `1px solid ${SEVERITY_COLOR[severity] ?? "#d1d5db"}` }}>
      {severity}
    </span>
  );
}

function ScoreBar({ score, max = 10, label }: { score: number | null; max?: number; label: string }) {
  if (score == null) return <span style={{ color: "#6b7280" }}>N/A</span>;
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 90 ? "#dc2626" : pct >= 70 ? "#ea580c" : pct >= 40 ? "#ca8a04" : "#16a34a";
  return (
    <div>
      <span style={{ fontWeight: 600 }}>{score}</span>
      <div style={{ marginTop: 4, height: 6, background: "#e5e7eb", borderRadius: 3, width: 160 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
    </div>
  );
}

export default async function CVEPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("vulnerabilities")
    .select("cve_id, description, cvss_score, cvss_vector, cvss_severity, epss_score, epss_percentile, in_kev, combined_risk_score, published_at, modified_at, cpe_list, affected_packages, ecosystem")
    .eq("cve_id", id)
    .single();

  if (error || !data) return notFound();

  const publishedDate = data.published_at
    ? new Date(data.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const modifiedDate = data.modified_at
    ? new Date(data.modified_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  const affectedPackages: { name: string; ecosystem: string; versions?: string[] }[] =
    Array.isArray(data.affected_packages) ? data.affected_packages :
    typeof data.affected_packages === "string" ? JSON.parse(data.affected_packages) : [];

  const isCriticalOrHigh = data.cvss_severity === "CRITICAL" || data.cvss_severity === "HIGH";

  // JSON-LD structured data for Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": `${data.cve_id} — ${data.cvss_severity ?? "CVE"} Severity Vulnerability`,
    "description": data.description?.slice(0, 200),
    "datePublished": data.published_at,
    "dateModified": data.modified_at,
    "url": `${BASE_URL}/cve/${data.cve_id}`,
    "publisher": { "@type": "Organization", "name": "OsVault", "url": BASE_URL },
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ marginBottom: 24 }}>
        <a href="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← OsVault</a>
        <h1 style={{ margin: "8px 0 4px", fontSize: 28 }}>{data.cve_id}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SeverityBadge severity={data.cvss_severity} />
          {data.in_kev && (
            <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, background: "#450a0a", color: "#fca5a5", border: "1px solid #dc2626" }}>
              ⚠ CISA KEV — Actively Exploited
            </span>
          )}
          {publishedDate && <span style={{ fontSize: 13, color: "#6b7280" }}>Published {publishedDate}</span>}
        </div>
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, marginBottom: 8 }}>Description</h2>
        <p style={{ lineHeight: 1.7, color: "#374151", fontSize: 14 }}>{data.description ?? "No description available."}</p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Risk Scores</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>CVSS Score</div>
            <ScoreBar score={data.cvss_score} max={10} label="/ 10" />
          </div>
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>EPSS Score</div>
            <ScoreBar score={data.epss_score ? parseFloat((data.epss_score * 100).toFixed(1)) : null} max={100} label="% exploit probability" />
          </div>
          <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>OsVault Risk Score</div>
            <ScoreBar score={data.combined_risk_score} max={100} label="/ 100" />
          </div>
        </div>
        {data.cvss_vector && (
          <p style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            Vector: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 3 }}>{data.cvss_vector}</code>
          </p>
        )}
      </section>

      {affectedPackages.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Affected Packages</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                <th style={{ padding: "6px 8px" }}>Package</th>
                <th style={{ padding: "6px 8px" }}>Ecosystem</th>
                <th style={{ padding: "6px 8px" }}>Affected Versions</th>
              </tr>
            </thead>
            <tbody>
              {affectedPackages.map((pkg, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                    {pkg.ecosystem?.toLowerCase() === "npm"
                      ? <a href={`/npm/${encodeURIComponent(pkg.name)}`}>{pkg.name}</a>
                      : pkg.name}
                  </td>
                  <td style={{ padding: "6px 8px", color: "#6b7280" }}>{pkg.ecosystem}</td>
                  <td style={{ padding: "6px 8px", color: "#6b7280" }}>
                    {pkg.versions?.slice(0, 6).join(", ") ?? "—"}
                    {(pkg.versions?.length ?? 0) > 6 && ` +${pkg.versions!.length - 6} more`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.cpe_list && data.cpe_list.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>CPE Identifiers</h2>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: 12, maxHeight: 160, overflowY: "auto" }}>
            {data.cpe_list.slice(0, 20).map((cpe: string, i: number) => (
              <div key={i} style={{ fontSize: 12, color: "#374151", padding: "2px 0" }}>{cpe}</div>
            ))}
            {data.cpe_list.length > 20 && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>+{data.cpe_list.length - 20} more</div>}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 28, fontSize: 13, color: "#6b7280" }}>
        {modifiedDate && <p style={{ margin: "4px 0" }}>Last modified: {modifiedDate}</p>}
        <p style={{ margin: "4px 0" }}>
          Source: <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer">NVD ↗</a>
          {" · "}<a href="/checker">Check your dependencies →</a>
        </p>
      </section>

      {isCriticalOrHigh && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
            {AFFILIATES.snyk.cta_critical(1)}{" "}
            <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ fontWeight: 600 }}>Try {AFFILIATES.snyk.name} →</a>
          </div>
          <div style={{ padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}>
            {AFFILIATES.socket.cta_general}{" "}
            <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ fontWeight: 600 }}>Try {AFFILIATES.socket.name} →</a>
          </div>
        </div>
      )}
    </main>
  );
}
