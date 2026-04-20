import { supabase } from "@/lib/supabase";
import { MetadataRoute } from "next";

const BASE_URL = "https://os-vault-kappa.vercel.app";

export const revalidate = 3600; // regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const static_routes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/checker`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
  ];

  // All CVE pages (both NVD and OSV sources)
  const { data: nvd } = await supabase
    .from("vulnerabilities")
    .select("cve_id, modified_at")
    .not("cve_id", "is", null)
    .limit(49000);

  const cve_routes: MetadataRoute.Sitemap = (nvd ?? []).map((r) => ({
    url: `${BASE_URL}/cve/${r.cve_id}`,
    lastModified: r.modified_at ? new Date(r.modified_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // npm package pages from OSV
  const { data: osv } = await supabase
    .from("vulnerabilities")
    .select("affected_packages, modified_at")
    .eq("source", "osv")
    .eq("ecosystem", "npm")
    .not("affected_packages", "is", null)
    .limit(10000);

  const pkgSet = new Set<string>();
  for (const row of osv ?? []) {
    const pkgs = row.affected_packages as { name?: string }[];
    if (Array.isArray(pkgs)) {
      pkgs.forEach((p) => { if (p.name) pkgSet.add(p.name); });
    }
  }

  const npm_routes: MetadataRoute.Sitemap = [...pkgSet].map((name) => ({
    url: `${BASE_URL}/npm/${encodeURIComponent(name)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...static_routes, ...cve_routes, ...npm_routes];
}
