"""
One-time backfill: fetch CVSS scores from NVD for OSV rows that have
a cve_id but null cvss_severity.

Usage:
  pip install requests supabase python-dotenv
  python backfill_cvss.py
"""

import os
import time
import logging
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
NVD_API_KEY = os.environ.get("NVD_API_KEY")
NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"

def nvd_headers():
    h = {"Accept": "application/json"}
    if NVD_API_KEY:
        h["apiKey"] = NVD_API_KEY
    return h

def fetch_cvss(cve_id: str):
    try:
        resp = requests.get(NVD_BASE, headers=nvd_headers(), params={"cveId": cve_id}, timeout=15)
        resp.raise_for_status()
        vulns = resp.json().get("vulnerabilities", [])
        if not vulns:
            return None
        metrics = vulns[0]["cve"].get("metrics", {})
        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            entries = metrics.get(key, [])
            if entries:
                d = entries[0].get("cvssData", {})
                return {
                    "cvss_score":    d.get("baseScore"),
                    "cvss_severity": d.get("baseSeverity") or entries[0].get("baseSeverity"),
                    "cvss_vector":   d.get("vectorString"),
                }
    except Exception as e:
        log.warning("NVD fetch failed for %s: %s", cve_id, e)
    return None

def main():
    # Fetch all OSV rows with a cve_id but no severity
    resp = sb.table("vulnerabilities") \
        .select("id, cve_id") \
        .eq("source", "osv") \
        .is_("cvss_severity", "null") \
        .not_.is_("cve_id", "null") \
        .execute()

    rows = resp.data or []
    log.info("Found %d OSV rows missing CVSS scores", len(rows))

    updated = 0
    for i, row in enumerate(rows):
        cve_id = row["cve_id"]
        scores = fetch_cvss(cve_id)
        if scores and scores.get("cvss_score"):
            sb.table("vulnerabilities").update(scores).eq("id", row["id"]).execute()
            log.info("[%d/%d] Updated %s → %s %s", i+1, len(rows), cve_id, scores["cvss_severity"], scores["cvss_score"])
            updated += 1
        else:
            log.info("[%d/%d] No NVD data for %s", i+1, len(rows), cve_id)

        # Rate limit: 50 req/30s with key, 5 req/30s without
        time.sleep(0.7 if NVD_API_KEY else 7)

    log.info("Done. Updated %d / %d records.", updated, len(rows))

if __name__ == "__main__":
    main()
