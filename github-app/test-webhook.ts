/**
 * Simulates a GitHub pull_request.opened webhook locally.
 * Run with: npx ts-node test-webhook.ts
 *
 * This bypasses signature verification so you can test the full
 * Supabase query + check output without a real GitHub PR.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { checkPackages } from "./src/supabase";
import { parseDiff } from "./src/diff";
import { buildSummary } from "./src/checks";

// Simulate a package.json diff that adds lodash and axios
const FAKE_DIFF = `
@@ -1,5 +1,7 @@
 {
   "dependencies": {
+    "lodash": "^4.17.20",
+    "axios": "^0.21.1",
+    "minimist": "^1.2.5"
   }
 }
`;

async function main() {
  console.log("=== OsVault GitHub App — Local Test ===\n");

  // 1. Parse the diff
  const packages = parseDiff("package.json", FAKE_DIFF);
  console.log("Parsed packages from diff:");
  packages.forEach(p => console.log(`  ${p.name}@${p.version} (${p.ecosystem})`));
  console.log();

  // 2. Query Supabase
  console.log("Querying Supabase for vulnerabilities...");
  const vulns = await checkPackages(packages);
  console.log(`Found ${vulns.length} vulnerabilities:\n`);
  vulns.forEach(v => {
    console.log(`  [${v.cvss_severity ?? "?"}] ${v.package} — ${v.cve_id ?? v.osv_id} (CVSS: ${v.cvss_score ?? "N/A"})${v.in_kev ? " 🚨 CISA KEV" : ""}`);
  });
  console.log();

  // 3. Build the check summary
  const { title, summary, conclusion } = buildSummary(vulns, packages.length, false, 12345);
  console.log("=== GitHub Check Output ===");
  console.log(`Title:      ${title}`);
  console.log(`Conclusion: ${conclusion}`);
  console.log("\nSummary (markdown):");
  console.log(summary);
}

main().catch(console.error);
