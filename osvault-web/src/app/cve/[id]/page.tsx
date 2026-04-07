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
    title: `${id} — ${severity} Severity Vulnerability`,
    description: desc,
    alternates: { canonical: `${BASE_URL}/cve/${id}` },
    openGraph: { title: `${id} ${severity} Vulnerability`, description: desc, url: `${BASE_URL}/cve/${id}`, siteName: "OsVault", type: "article" },
  };
}

const SEV: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "#ef4444", bg: "#ef444412", border: "#ef444430" },
  HIGH:     { color: "#f97316", bg: "#f9731612", border: "#f9731630" },
  MEDIUM:   { color: "#eab308", bg: "#eab30812", border: "#eab30830" },
  LOW:      { color: "#22c55e", bg: "#22c55e12", border: "#22c55e30" },
};

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, color, background: bg, border: `1px solid ${border}`, letterSpacing: "0.04em" }}>
      {label}
    </span>
  );
}

function ScoreCard({ label, value, sub, color }: { label: string; value: string | number | null; sub: string; color?: string }) {
  return (
    <div style={{ padding: "20px 24px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: color ?? "var(--text)" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export default async function CVEPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("vulnerabilities")
    .select("*")
    .eq("cve_id", id)
    .single();

  if (error || !data) return notFound();

  const sev = SEV[data.cvss_severity ?? ""] ?? { color: "var(--text-2)", bg: "var(--bg-card)", border: "var(--border)" };
  const publishedDate = data.published_at ? new Date(data.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;
  const modifiedDate  = data.modified_at  ? new Date(data.modified_at).toLocaleDateString("en-US",  { year: "numeric", month: "long", day: "numeric" }) : null;

  const affectedPackages: { name: string; ecosystem: string; versions?: string[] }[] =
    Array.isArray(data.affected_packages) ? data.affected_packages :
    typeof data.affected_packages === "string" ? JSON.parse(data.affected_packages) : [];

  const isCriticalOrHigh = data.cvss_severity === "CRITICAL" || data.cvss_severity === "HIGH";
  const riskColor = (data.combined_risk_score ?? 0) >= 70 ? "#ef4444" : (data.combined_risk_score ?? 0) >= 40 ? "#f97316" : "#22c55e";

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Article",
    "headline": `${data.cve_id} — ${data.cvss_severity ?? "CVE"} Severity Vulnerability`,
    "description": data.description?.slice(0, 200),
    "datePublished": data.published_at, "dateModified": data.modified_at,
    "url": `${BASE_URL}/cve/${data.cve_id}`,
    "publisher": { "@type": "Organization", "name": "OsVault", "url": BASE_URL },
  };

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <a href="/" style={{ color: "var(--text-3)" }}>OsVault</a>
        <span>/</span>
        <span>CVE</span>
        <span>/</span>
        <span style={{ color: "var(--text-2)" }}>{data.cve_id}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <Badge label={data.cvss_severity ?? "UNKNOWN"} {...sev} />
          {data.in_kev && <Badge label="⚠ CISA KEV" color="#fca5a5" bg="#450a0a" border="#dc2626" />}
          {publishedDate && <span style={{ fontSize: 13, color: "var(--text-3)" }}>Published {publishedDate}</span>}
        </div>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>{data.cve_id}</h1>
        <p style={{ fontSize: 15, color: "var(--text-2)", lineHeight: 1.75, maxWidth: 720 }}>{data.description ?? "No description available."}</p>
      </div>

      {/* Score cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <ScoreCard label="CVSS Score" value={data.cvss_score} sub="Base severity score" color={sev.color} />
        <ScoreCard label="EPSS" value={data.epss_score ? `${(data.epss_score * 100).toFixed(2)}%` : null} sub="Exploit probability" color={data.epss_score && data.epss_score > 0.5 ? "#ef4444" : "var(--text)"} />
        <ScoreCard label="Risk Score" value={data.combined_risk_score ? `${data.combined_risk_score}/100` : null} sub="OsVault composite" color={riskColor} />
        <ScoreCard label="KEV Status" value={data.in_kev ? "Active" : "Not listed"} sub="CISA exploitation" color={data.in_kev ? "#ef4444" : "#22c55e"} />
      </div>

      {/* CVSS Vector */}
      {data.cvss_vector && (
        <div style={{ marginBottom: 32, padding: "16px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>CVSS Vector</div>
          <code style={{ fontSize: 13, color: "var(--accent-2)" }}>{data.cvss_vector}</code>
        </div>
      )}

      {/* Affected Packages */}
      {affectedPackages.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>Affected Packages</h2>
          <div style={{ borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Package</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ecosystem</th>
                  <th style={{ padding: "10px 16px", textAlign: "left", color: "var(--text-3)", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Affected Versions</th>
                </tr>
              </thead>
              <tbody>
                {affectedPackages.map((pkg, i) => (
                  <tr key={i} style={{ borderBottom: i < affectedPackages.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {pkg.ecosystem?.toLowerCase() === "npm"
                        ? <a href={`/npm/${encodeURIComponent(pkg.name)}`} style={{ color: "var(--accent-2)" }}>{pkg.name}</a>
                        : pkg.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-3)" }}>{pkg.ecosystem}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-2)", fontFamily: "monospace", fontSize: 12 }}>
                      {pkg.versions?.slice(0, 5).join(", ") ?? "—"}
                      {(pkg.versions?.length ?? 0) > 5 && <span style={{ color: "var(--text-3)" }}> +{pkg.versions!.length - 5} more</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CPE */}
      {data.cpe_list?.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.01em" }}>CPE Identifiers</h2>
          <div style={{ padding: 16, borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", maxHeight: 180, overflowY: "auto" }}>
            {data.cpe_list.slice(0, 20).map((cpe: string, i: number) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-3)", padding: "3px 0", fontFamily: "monospace" }}>{cpe}</div>
            ))}
            {data.cpe_list.length > 20 && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>+{data.cpe_list.length - 20} more entries</div>}
          </div>
        </div>
      )}

      {/* Meta */}
      <div style={{ marginBottom: 32, padding: "16px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", gap: 24, flexWrap: "wrap", fontSize: 13, color: "var(--text-3)" }}>
        {modifiedDate && <span>Modified: <span style={{ color: "var(--text-2)" }}>{modifiedDate}</span></span>}
        <span>Source: <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>NVD ↗</a></span>
        <span><a href="/checker" style={{ color: "var(--accent-2)" }}>Check your dependencies →</a></span>
      </div>

      {/* Affiliate CTAs */}
      {isCriticalOrHigh && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "16px 20px", borderRadius: "var(--radius)", border: "1px solid #ef444430", background: "#ef444408", fontSize: 14 }}>
            <span style={{ color: "var(--text-2)" }}>{AFFILIATES.snyk.cta_critical(1)}</span>{" "}
            <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#ef4444", fontWeight: 600 }}>Try {AFFILIATES.snyk.name} →</a>
          </div>
          <div style={{ padding: "16px 20px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 14 }}>
            <span style={{ color: "var(--text-2)" }}>{AFFILIATES.socket.cta_general}</span>{" "}
            <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "var(--accent-2)", fontWeight: 600 }}>Try {AFFILIATES.socket.name} →</a>
          </div>
        </div>
      )}
    </main>
  );
}
