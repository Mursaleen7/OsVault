import { supabase } from "@/lib/supabase";

const BASE_URL = "https://os-vault-kappa.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ package: string }> }) {
  const { package: pkg } = await params;
  const name = decodeURIComponent(pkg);
  return {
    title: `${name} Security Vulnerabilities`,
    description: `Known CVEs and security advisories affecting the ${name} npm package. CVSS scores, risk ratings, and affected versions.`,
    alternates: { canonical: `${BASE_URL}/npm/${pkg}` },
  };
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};

export default async function NpmPackagePage({ params }: { params: Promise<{ package: string }> }) {
  const { package: raw } = await params;
  const packageName = decodeURIComponent(raw);

  const { data: byPackages } = await supabase
    .from("vulnerabilities").select("*").eq("source", "osv").eq("ecosystem", "npm")
    .contains("affected_packages", JSON.stringify([{ name: packageName }]));

  const { data: bySummary } = await supabase
    .from("vulnerabilities").select("*").eq("source", "osv").eq("ecosystem", "npm")
    .ilike("summary", `%${packageName}%`);

  const combined = [...(byPackages ?? []), ...(bySummary ?? [])];
  const seen = new Set<number>();
  const vulns = combined.filter((v) => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
  const sorted = vulns.sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0));

  const criticalCount = vulns.filter(v => v.cvss_severity === "CRITICAL").length;
  const highCount     = vulns.filter(v => v.cvss_severity === "HIGH").length;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 80px" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
        <a href="/" style={{ color: "var(--text-3)" }}>OsVault</a>
        <span>/</span><span>npm</span><span>/</span>
        <span style={{ color: "var(--text-2)" }}>{packageName}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#f9731612", color: "#f97316", border: "1px solid #f9731630" }}>npm</span>
          {criticalCount > 0 && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#ef444412", color: "#ef4444", border: "1px solid #ef444430" }}>{criticalCount} critical</span>}
        </div>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>{packageName}</h1>
        <p style={{ fontSize: 15, color: "var(--text-2)" }}>
          {vulns.length === 0
            ? "No known vulnerabilities found."
            : `${vulns.length} known vulnerabilit${vulns.length === 1 ? "y" : "ies"} · ${criticalCount} critical · ${highCount} high`}
        </p>
      </div>

      {vulns.length === 0 ? (
        <div style={{ padding: 32, borderRadius: "var(--radius)", border: "1px solid #22c55e30", background: "#22c55e08", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <p style={{ color: "#22c55e", fontWeight: 600, marginBottom: 8 }}>No known vulnerabilities</p>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>This package has no recorded CVEs in our database.</p>
          <a href="/checker" style={{ display: "inline-block", marginTop: 16, padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            Check your full dependency tree →
          </a>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((v) => (
            <div key={v.id} style={{ padding: "20px 24px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    {v.cve_id
                      ? <a href={`/cve/${v.cve_id}`} style={{ color: "var(--accent-2)" }}>{v.cve_id}</a>
                      : <span style={{ color: "var(--text-2)" }}>{v.osv_id}</span>}
                  </span>
                  {v.cvss_severity && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: `${SEV_COLOR[v.cvss_severity] ?? "#374151"}18`, color: SEV_COLOR[v.cvss_severity] ?? "var(--text-2)", border: `1px solid ${SEV_COLOR[v.cvss_severity] ?? "#374151"}30` }}>
                      {v.cvss_severity}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {v.cvss_score && <div style={{ fontSize: 22, fontWeight: 800, color: SEV_COLOR[v.cvss_severity ?? ""] ?? "var(--text)", letterSpacing: "-0.02em" }}>{v.cvss_score}</div>}
                  {v.combined_risk_score && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Risk: {v.combined_risk_score}/100</div>}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>{v.summary ?? "No summary available."}</p>
              {v.published_at && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-3)" }}>
                  Published {new Date(v.published_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 40, padding: "20px 24px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 14, color: "var(--text-2)" }}>Check your entire dependency tree at once</span>
        <a href="/checker" style={{ padding: "8px 20px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
          Run dependency scan →
        </a>
      </div>
    </main>
  );
}
