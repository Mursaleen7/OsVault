import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

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
    </main>
  );
}
