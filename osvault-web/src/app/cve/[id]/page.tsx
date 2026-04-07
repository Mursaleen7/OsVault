import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { AFFILIATES } from "@/lib/affiliates";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `${id} | OsVault` };
}

export default async function CVEPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("vulnerabilities")
    .select("*")
    .eq("cve_id", id)
    .eq("source", "nvd")
    .single();

  if (error || !data) return notFound();

  return (
    <main>
      <h1>{data.cve_id}</h1>
      <p><strong>Severity:</strong> {data.cvss_severity ?? "N/A"}</p>
      <p><strong>CVSS Score:</strong> {data.cvss_score ?? "N/A"}</p>
      <p><strong>EPSS Score:</strong> {data.epss_score ?? "N/A"}</p>
      <p><strong>In CISA KEV:</strong> {data.in_kev ? "Yes" : "No"}</p>
      <p><strong>Combined Risk Score:</strong> {data.combined_risk_score ?? "N/A"}</p>
      <p><strong>Published:</strong> {data.published_at}</p>
      <p><strong>Description:</strong> {data.description}</p>
      <pre>{JSON.stringify(data, null, 2)}</pre>

      {(data.cvss_severity === "CRITICAL" || data.cvss_severity === "HIGH") && (
        <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
          <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
            {AFFILIATES.snyk.cta_critical(1)}{" "}
            <a href={AFFILIATES.snyk.href} target="_blank" rel="noopener noreferrer sponsored" style={{ fontWeight: 600 }}>
              Try {AFFILIATES.snyk.name} →
            </a>
          </div>
          <div style={{ padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13 }}>
            {AFFILIATES.socket.cta_general}{" "}
            <a href={AFFILIATES.socket.href} target="_blank" rel="noopener noreferrer sponsored" style={{ fontWeight: 600 }}>
              Try {AFFILIATES.socket.name} →
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
