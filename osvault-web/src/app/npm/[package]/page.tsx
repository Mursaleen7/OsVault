import { supabase } from "@/lib/supabase";

export async function generateMetadata({ params }: { params: Promise<{ package: string }> }) {
  const { package: pkg } = await params;
  return { title: `${pkg} vulnerabilities | OsVault` };
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

  if (vulns.length === 0) {
    return (
      <main>
        <h1>{packageName}</h1>
        <p>No known vulnerabilities found for this package.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{packageName}</h1>
      <p>{vulns.length} vulnerabilit{vulns.length === 1 ? "y" : "ies"} found</p>
      {vulns.map((v) => (
        <article key={v.id} style={{ borderTop: "1px solid #ccc", marginTop: "1rem", paddingTop: "1rem" }}>
          <h2>{v.osv_id ?? v.cve_id ?? v.id}</h2>
          <p><strong>Summary:</strong> {v.summary ?? "N/A"}</p>
          <p><strong>CVSS Score:</strong> {v.cvss_score ?? "N/A"}</p>
          <p><strong>Combined Risk Score:</strong> {v.combined_risk_score ?? "N/A"}</p>
          <p><strong>Published:</strong> {v.published_at}</p>
          {v.cve_id && <p><a href={`/cve/${v.cve_id}`}>View CVE details →</a></p>}
          <pre>{JSON.stringify(v.affected_packages, null, 2)}</pre>
        </article>
      ))}
    </main>
  );
}
