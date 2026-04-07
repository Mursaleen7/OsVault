import { supabase } from "@/lib/supabase";

const BASE_URL = "https://os-vault-kappa.vercel.app";

export async function generateMetadata({ params }: { params: Promise<{ package: string }> }) {
  const { package: pkg } = await params;
  const name = decodeURIComponent(pkg);
  return {
    title: `${name} Security Vulnerabilities | OsVault`,
    description: `Known CVEs and security vulnerabilities affecting the ${name} npm package. CVSS scores, risk ratings, and affected versions.`,
    alternates: { canonical: `${BASE_URL}/npm/${pkg}` },
    openGraph: {
      title: `${name} npm Package Vulnerabilities`,
      description: `Security vulnerability report for ${name}`,
      url: `${BASE_URL}/npm/${pkg}`,
      siteName: "OsVault",
    },
  };
}

export default async function NpmPackagePage({ params }: { params: Promise<{ package: string }> }) {
  const { package: raw } = await params;
  const packageName = decodeURIComponent(raw);

  const { data: byPackages } = await supabase
    .from("vulnerabilities")
    .select("*")
    .eq("source", "osv")
    .eq("ecosystem", "npm")
    .contains("affected_packages", JSON.stringify([{ name: packageName }]));

  const { data: bySummary } = await supabase
    .from("vulnerabilities")
    .select("*")
    .eq("source", "osv")
    .eq("ecosystem", "npm")
    .ilike("summary", `%${packageName}%`);

  const combined = [...(byPackages ?? []), ...(bySummary ?? [])];
  const seen = new Set<number>();
  const vulns = combined.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${packageName} npm Security Vulnerabilities`,
    "description": `${vulns.length} known vulnerabilities affecting ${packageName}`,
    "url": `${BASE_URL}/npm/${raw}`,
  };

  if (vulns.length === 0) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace" }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <a href="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← OsVault</a>
        <h1 style={{ margin: "8px 0 16px" }}>{packageName}</h1>
        <p style={{ color: "#16a34a" }}>✓ No known vulnerabilities found for this package.</p>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 16 }}>
          <a href="/checker">Check your full dependency tree →</a>
        </p>
      </main>
    );
  }

  const criticalCount = vulns.filter(v => v.cvss_severity === "CRITICAL").length;
  const highCount     = vulns.filter(v => v.cvss_severity === "HIGH").length;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <a href="/" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>← OsVault</a>
      <h1 style={{ margin: "8px 0 4px" }}>{packageName}</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        {vulns.length} known vulnerabilit{vulns.length === 1 ? "y" : "ies"}
        {criticalCount > 0 && <span style={{ color: "#dc2626", fontWeight: 600 }}> · {criticalCount} critical</span>}
        {highCount > 0 && <span style={{ color: "#ea580c", fontWeight: 600 }}> · {highCount} high</span>}
      </p>

      {vulns.map((v) => (
        <article key={v.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>
            {v.cve_id
              ? <a href={`/cve/${v.cve_id}`}>{v.cve_id}</a>
              : v.osv_id ?? v.id}
          </h2>
          <p style={{ fontSize: 13, color: "#374151", margin: "0 0 8px" }}>{v.summary ?? "No summary available."}</p>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
            {v.cvss_severity && <span>Severity: <strong style={{ color: v.cvss_severity === "CRITICAL" ? "#dc2626" : v.cvss_severity === "HIGH" ? "#ea580c" : "#374151" }}>{v.cvss_severity}</strong></span>}
            {v.cvss_score && <span>CVSS: {v.cvss_score}</span>}
            {v.combined_risk_score && <span>Risk: {v.combined_risk_score}/100</span>}
            {v.published_at && <span>Published: {new Date(v.published_at).toLocaleDateString()}</span>}
          </div>
        </article>
      ))}

      <div style={{ marginTop: 32, borderTop: "1px solid #e5e7eb", paddingTop: 16, fontSize: 13, color: "#6b7280" }}>
        <a href="/checker">Check your full package.json for vulnerabilities →</a>
      </div>
    </main>
  );
}
