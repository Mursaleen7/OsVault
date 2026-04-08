import { supabase } from "@/lib/supabase";
import LandingClient from "./LandingClient";

async function getStats() {
  const [nvd, osv, kev] = await Promise.all([
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("source", "nvd"),
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("source", "osv"),
    supabase.from("vulnerabilities").select("id", { count: "exact", head: true }).eq("in_kev", true),
  ]);
  return { nvd: nvd.count ?? 0, osv: osv.count ?? 0, kev: kev.count ?? 0 };
}

async function getRecentCritical() {
  const { data } = await supabase
    .from("vulnerabilities")
    .select("cve_id, description, cvss_score, cvss_severity, combined_risk_score, published_at")
    .eq("source", "nvd")
    .in("cvss_severity", ["CRITICAL", "HIGH"])
    .order("published_at", { ascending: false })
    .limit(6);
  return data ?? [];
}

export default async function Home() {
  const [stats, recent] = await Promise.all([getStats(), getRecentCritical()]);

  return (
    <LandingClient
      stats={stats}
      recent={recent}
    />
  );
}
