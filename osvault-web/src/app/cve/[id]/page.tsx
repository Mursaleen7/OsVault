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
  CRITICAL: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.2)" },
  HIGH:     { color: "#f97316", bg: "rgba(249, 115, 22, 0.1)", border: "rgba(249, 115, 22, 0.2)" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234, 179, 8, 0.1)", border: "rgba(234, 179, 8, 0.2)" },
  LOW:      { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", border: "rgba(34, 197, 94, 0.2)" },
};

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ 
      display: "inline-flex", alignItems: "center", padding: "2px 0", 
      fontSize: 12, fontWeight: 600, color,
      fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em",
      textTransform: "uppercase", marginRight: 16
    }}>
      {label}
    </span>
  );
}

function MetricBlock({ label, value, sub, color }: { label: string; value: string | number | null; sub: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 160, paddingBottom: 24 }}>
      <div style={{ width: 24, height: 2, background: color ?? "var(--border-2)", marginBottom: 12 }} />
      <div style={{ fontSize: 11, color: "var(--slate-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: color ?? "var(--text)", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 12 }}>{sub}</div>
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

  const sev = SEV[data.cvss_severity ?? ""] ?? { color: "var(--text-2)", bg: "rgba(255,255,255,0.05)", border: "var(--border)" };
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
    <article style={{ maxWidth: 780, margin: "0 auto", padding: "80px 24px 120px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Article Header */}
      <header style={{ marginBottom: 48, paddingBottom: 40, borderBottom: "1px solid var(--border)" }}>
        <nav style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "var(--slate-dim)", marginBottom: 32, display: "flex", gap: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <a href="/" style={{ color: "var(--slate)", textDecoration: "none", transition: "color 0.2s" }}>Root</a>
          <span>/</span>
          <span>Advisories</span>
          <span>/</span>
          <span style={{ color: "var(--white-pure)" }}>{data.cve_id}</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <Badge label={`${data.cvss_severity ?? "UNKNOWN"} SEVERITY`} {...sev} />
          {data.in_kev && <Badge label="⚠ CISA KEV (KNOWN EXPLOITED)" color="#fca5a5" bg="#450a0a" border="#dc2626" />}
        </div>
        
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--white-pure)", marginBottom: 24, lineHeight: 1.1 }}>
          {data.cve_id}
        </h1>
        
        <p style={{ fontSize: 18, color: "var(--text-2)", lineHeight: 1.6, fontWeight: 400, maxWidth: 720 }}>
          {data.description ?? "No detailed description available for this vulnerability."}
        </p>

        {publishedDate && (
          <div style={{ marginTop: 24, fontSize: 14, color: "var(--slate-dim)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--border-2)" }} />
            Published to NVD on {publishedDate}
          </div>
        )}
      </header>

      {/* Metrics Section */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginBottom: 56 }}>
        <MetricBlock label="CVSS Base" value={data.cvss_score} sub="Vulnerability severity" color={sev.color} />
        <MetricBlock label="EPSS Prob." value={data.epss_score ? `${(data.epss_score * 100).toFixed(1)}%` : null} sub="Real-world exploitability" color={data.epss_score && data.epss_score > 0.5 ? "#ef4444" : "var(--text)"} />
        <MetricBlock label="Risk Score" value={data.combined_risk_score} sub="OsVault unified metric" color={riskColor} />
      </div>

      {/* Security Vector */}
      {data.cvss_vector && (
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.01em", color: "var(--white-pure)" }}>Attack Vector Profile</h2>
          <div style={{ padding: "12px 0" }}>
            <code style={{ fontSize: 14, color: "var(--green)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
              {data.cvss_vector}
            </code>
          </div>
        </section>
      )}

      {/* Affected Packages */}
      {affectedPackages.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, letterSpacing: "-0.01em", color: "var(--white-pure)" }}>Vulnerable Packages</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "0 16px 12px 0", textAlign: "left", color: "var(--slate-dim)", fontWeight: 500, fontSize: 12, width: "40%" }}>Ecosystem & Package</th>
                  <th style={{ padding: "0 0 12px 0", textAlign: "left", color: "var(--slate-dim)", fontWeight: 500, fontSize: 12 }}>Affected Versions</th>
                </tr>
              </thead>
              <tbody>
                {affectedPackages.map((pkg, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-2)" }}>
                    <td style={{ padding: "20px 16px 20px 0", verticalAlign: "top" }}>
                      <span style={{ fontSize: 11, color: "var(--slate-dim)", display: "block", marginBottom: 4, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>{pkg.ecosystem}</span>
                      <strong style={{ fontWeight: 500, color: "var(--text)" }}>
                        {pkg.ecosystem?.toLowerCase() === "npm"
                          ? <a href={`/npm/${encodeURIComponent(pkg.name)}`} style={{ textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--border)" }}>{pkg.name}</a>
                          : pkg.name}
                      </strong>
                    </td>
                    <td style={{ padding: "20px 0", verticalAlign: "top", color: "var(--text-2)", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6 }}>
                      {pkg.versions?.slice(0, 8).join(", ") ?? "All or unspecified versions"}
                      {(pkg.versions?.length ?? 0) > 8 && <span style={{ color: "var(--slate-dim)", display: "inline-block", marginTop: 4 }}> +{pkg.versions!.length - 8} more variants</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CPE */}
      {data.cpe_list?.length > 0 && (
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, letterSpacing: "-0.01em", color: "var(--white-pure)" }}>Affected Configurations (CPE)</h2>
          <div style={{ paddingLeft: 24, borderLeft: "2px solid var(--border)", fontFamily: "'JetBrains Mono', monospace", overflowX: "auto" }}>
            <pre style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.7 }}>
              {data.cpe_list.slice(0, 15).join('\n')}
              {data.cpe_list.length > 15 && `\n\n... and ${data.cpe_list.length - 15} more records.`}
            </pre>
          </div>
        </section>
      )}

      {/* Meta Footer */}
      <footer style={{ marginBottom: 64, paddingTop: 40, borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", justifyContext: "space-between", gap: 48, fontSize: 14, color: "var(--text-2)" }}>
        <div>
          <span style={{ color: "var(--slate-dim)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Last Modified</span>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>{modifiedDate ?? "Unknown"}</span>
        </div>
        <div>
          <span style={{ color: "var(--slate-dim)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Authoritative Source</span>
          <a href={`https://nvd.nist.gov/vuln/detail/${data.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>NVD NIST Database ↗</a>
        </div>
        <div style={{ marginLeft: "auto", alignSelf: "center" }}>
          <a href="/checker" style={{ display: "inline-block", color: "var(--text)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 4, textDecorationColor: "var(--border)" }}>Scan Project Settings →</a>
        </div>
      </footer>

      {/* Recommended Fixes */}
      {isCriticalOrHigh && (
        <section style={{ paddingTop: 40, borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--slate-dim)", marginBottom: 24, fontWeight: 600 }}>Recommended Security Tools</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, color: "var(--text)", fontWeight: 500, marginBottom: 8 }}>Vulnerability Remediation Engine</div>
                <div style={{ fontSize: 14, color: "var(--text-2)", maxWidth: "500px", lineHeight: 1.6 }}>{AFFILIATES.snyk.cta_critical(1)}</div>
              </div>
              <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "#ef4444", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Try {AFFILIATES.snyk.name} ↗</a>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, paddingTop: 24, borderTop: "1px solid var(--border-2)" }}>
              <div>
                <div style={{ fontSize: 16, color: "var(--text)", fontWeight: 500, marginBottom: 8 }}>Proactive Dependency Protection</div>
                <div style={{ fontSize: 14, color: "var(--text-2)", maxWidth: "500px", lineHeight: 1.6 }}>{AFFILIATES.socket.cta_general}</div>
              </div>
              <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Try {AFFILIATES.socket.name} ↗</a>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
