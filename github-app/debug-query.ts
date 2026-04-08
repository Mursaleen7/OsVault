import * as dotenv from "dotenv";
dotenv.config();
import { supabase } from "./src/supabase";

async function main() {
  const cveIds = ["CVE-2020-28500", "CVE-2021-23337", "CVE-2020-28168", "CVE-2019-10742", "CVE-2026-25639", "CVE-2025-58754"];

  const { data: nvd } = await supabase
    .from("vulnerabilities")
    .select("cve_id, source, cvss_score, cvss_severity")
    .in("cve_id", cveIds);

  console.log("NVD rows for these CVEs:");
  console.log(JSON.stringify(nvd, null, 2));

  // Also check what the OSV rows actually have
  const { data: osv } = await supabase
    .from("vulnerabilities")
    .select("cve_id, osv_id, source, cvss_score, cvss_severity, ecosystem")
    .in("cve_id", cveIds);

  console.log("\nAll rows for these CVEs:");
  console.log(JSON.stringify(osv, null, 2));
}

main().catch(console.error);
