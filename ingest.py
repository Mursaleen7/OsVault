"""
Local MVP ingestion script
Pulls CVE data from NVD + OSV.dev and upserts into Supabase.

Sources:
  - NVD (https://nvd.nist.gov/developers/vulnerabilities) — CVSS scores, base CVE data
  - OSV.dev (https://api.osv.dev/v1/query) — npm/PyPI ecosystem mappings

Usage:
  pip install requests supabase python-dotenv
  cp .env.example .env  # fill in your Supabase creds
  python ingest.py
"""

import os
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from score import enrich_records

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]  # service role key recommended

NVD_API_KEY = os.environ.get("NVD_API_KEY")  # optional but raises rate limit 5→50 req/30s
NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0"
OSV_BASE = "https://api.osv.dev/v1"

# 24h window in CI, 7 days locally
LOOKBACK_DAYS = 1 if os.environ.get("CI") else 7
OSV_ECOSYSTEMS = ["npm", "PyPI"]

# ---------------------------------------------------------------------------
# NVD helpers
# ---------------------------------------------------------------------------

def nvd_headers() -> dict:
    h = {"Accept": "application/json"}
    if NVD_API_KEY:
        h["apiKey"] = NVD_API_KEY
    return h


def fetch_nvd_cves(start: datetime, end: datetime) -> list[dict]:
    """
    Pages through NVD CVE API for the given time window.
    Returns a flat list of raw CVE items.
    """
    fmt = "%Y-%m-%dT%H:%M:%S.000"
    params = {
        "pubStartDate": start.strftime(fmt),
        "pubEndDate": end.strftime(fmt),
        "resultsPerPage": 2000,
        "startIndex": 0,
    }

    items = []
    while True:
        log.info("NVD fetch startIndex=%d", params["startIndex"])
        resp = requests.get(NVD_BASE, headers=nvd_headers(), params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        vulnerabilities = data.get("vulnerabilities", [])
        items.extend(vulnerabilities)

        total = data.get("totalResults", 0)
        params["startIndex"] += len(vulnerabilities)

        if params["startIndex"] >= total or not vulnerabilities:
            break

        # NVD rate limit: 5 req/30s without key, 50 req/30s with key
        time.sleep(1 if NVD_API_KEY else 7)

    log.info("NVD: fetched %d CVEs", len(items))
    return items


def parse_nvd_item(item: dict) -> Optional[dict]:
    """Extract the fields we care about from a raw NVD CVE item."""
    cve = item.get("cve", {})
    cve_id = cve.get("id")
    if not cve_id:
        return None

    # Description (prefer English)
    descriptions = cve.get("descriptions", [])
    description = next(
        (d["value"] for d in descriptions if d.get("lang") == "en"), None
    )

    # CVSS — prefer v3.1, fall back to v3.0, then v2
    metrics = cve.get("metrics", {})
    cvss_score = None
    cvss_vector = None
    cvss_severity = None

    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
        entries = metrics.get(key, [])
        if entries:
            cvss_data = entries[0].get("cvssData", {})
            cvss_score = cvss_data.get("baseScore")
            cvss_vector = cvss_data.get("vectorString")
            cvss_severity = cvss_data.get("baseSeverity") or entries[0].get("baseSeverity")
            break

    # Affected packages / CPEs
    configurations = cve.get("configurations", [])
    cpe_list = []
    for config in configurations:
        for node in config.get("nodes", []):
            for match in node.get("cpeMatch", []):
                if match.get("vulnerable"):
                    cpe_list.append(match.get("criteria"))

    published = cve.get("published")
    modified = cve.get("lastModified")

    return {
        "cve_id": cve_id,
        "description": description,
        "cvss_score": cvss_score,
        "cvss_vector": cvss_vector,
        "cvss_severity": cvss_severity,
        "cpe_list": cpe_list,
        "published_at": published,
        "modified_at": modified,
        "source": "nvd",
    }


# ---------------------------------------------------------------------------
# OSV helpers
# ---------------------------------------------------------------------------

def fetch_osv_for_ecosystem(ecosystem: str, since: datetime) -> list[dict]:
    """
    OSV bulk download via GCS JSON — the only reliable way to get all vulns
    for an ecosystem. Downloads the all.zip for the ecosystem and filters
    by modified date.
    """
    import zipfile
    import json
    import io

    url = f"https://osv-vulnerabilities.storage.googleapis.com/{ecosystem}/all.zip"
    log.info("OSV downloading bulk zip for %s ...", ecosystem)

    resp = requests.get(url, timeout=120, stream=True)
    if resp.status_code == 404:
        log.warning("OSV: no bulk zip found for ecosystem %s", ecosystem)
        return []
    resp.raise_for_status()

    items = []
    since_naive = since.replace(tzinfo=None)

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for name in zf.namelist():
            if not name.endswith(".json"):
                continue
            with zf.open(name) as f:
                try:
                    vuln = json.load(f)
                except Exception:
                    continue
                # Filter to only records modified in our window
                modified_str = vuln.get("modified", "")
                if modified_str:
                    try:
                        modified_dt = datetime.fromisoformat(
                            modified_str.replace("Z", "+00:00")
                        ).replace(tzinfo=None)
                        if modified_dt < since_naive:
                            continue
                    except ValueError:
                        pass
                items.append(vuln)

    log.info("OSV: fetched %d vulns for %s", len(items), ecosystem)
    return items


def parse_osv_item(item: dict, ecosystem: str) -> Optional[dict]:
    """Extract fields from a raw OSV vulnerability record."""
    osv_id = item.get("id")
    if not osv_id:
        return None

    # Map OSV id back to CVE id if available
    aliases = item.get("aliases", [])
    cve_id = next((a for a in aliases if a.startswith("CVE-")), None)

    summary = item.get("summary") or item.get("details", "")[:500]

    # Affected packages
    affected = item.get("affected", [])
    packages = []
    for aff in affected:
        pkg = aff.get("package", {})
        if pkg.get("ecosystem", "").lower() == ecosystem.lower():
            packages.append({
                "name": pkg.get("name"),
                "ecosystem": pkg.get("ecosystem"),
                "versions": [
                    r.get("introduced") or r.get("fixed")
                    for event in aff.get("ranges", [])
                    for r in event.get("events", [])
                    if r.get("introduced") or r.get("fixed")
                ],
            })

    # CVSS from OSV severity field
    cvss_score = None
    cvss_vector = None
    for sev in item.get("severity", []):
        if sev.get("type") in ("CVSS_V3", "CVSS_V2"):
            cvss_vector = sev.get("score")
            # Parse base score from vector string if present
            # e.g. CVSS:3.1/AV:N/.../S:U/C:H/I:H/A:H  — score not embedded, skip
            break

    modified = item.get("modified")
    published = item.get("published")

    return {
        "osv_id": osv_id,
        "cve_id": cve_id,
        "ecosystem": ecosystem,
        "summary": summary,
        "packages": packages,
        "cvss_vector": cvss_vector,
        "cvss_score": cvss_score,
        "published_at": published,
        "modified_at": modified,
        "source": "osv",
    }


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upsert_nvd_records(sb: Client, records: list[dict]) -> None:
    if not records:
        return
    log.info("Upserting %d NVD records into vulnerabilities...", len(records))
    rows = [
        {
            "cve_id":              r["cve_id"],
            "description":         r["description"],
            "cvss_score":          r["cvss_score"],
            "cvss_vector":         r["cvss_vector"],
            "cvss_severity":       r["cvss_severity"],
            "cpe_list":            r["cpe_list"],
            "published_at":        r["published_at"],
            "modified_at":         r["modified_at"],
            "epss_score":          r.get("epss_score"),
            "epss_percentile":     r.get("epss_percentile"),
            "in_kev":              r.get("in_kev", False),
            "combined_risk_score": r.get("combined_risk_score"),
            "source":              "nvd",
        }
        for r in records
    ]
    for chunk in _chunks(rows, 500):
        sb.table("vulnerabilities").upsert(chunk, on_conflict="cve_id").execute()
    log.info("NVD upsert complete.")


def upsert_osv_records(sb: Client, records: list[dict]) -> None:
    if not records:
        return
    log.info("Upserting %d OSV records into vulnerabilities...", len(records))

    # Split: records that have a cve_id (may already exist from NVD) vs osv-only
    has_cve = [r for r in records if r.get("cve_id")]
    no_cve  = [r for r in records if not r.get("cve_id")]

    def _row(r):
        return {
            "osv_id":            r["osv_id"],
            "cve_id":            r.get("cve_id"),
            "ghsa_id":           r["osv_id"] if r["osv_id"].startswith("GHSA-") else None,
            "ecosystem":         r["ecosystem"],
            "summary":           r["summary"],
            "affected_packages": r["packages"],
            "cvss_vector":       r["cvss_vector"],
            "cvss_score":        r["cvss_score"],
            "published_at":      r["published_at"],
            "modified_at":       r["modified_at"],
            "source":            "osv",
        }

    # For records with a cve_id, upsert on cve_id (merges with NVD rows)
    if has_cve:
        rows = [_row(r) for r in has_cve]
        # Deduplicate by cve_id — keep last occurrence
        deduped = {r["cve_id"]: r for r in rows}.values()
        for chunk in _chunks(list(deduped), 500):
            sb.table("vulnerabilities").upsert(chunk, on_conflict="cve_id").execute()

    # For OSV-only records (no cve_id), upsert on osv_id
    if no_cve:
        rows = [_row(r) for r in no_cve]
        # Deduplicate by osv_id
        deduped = {r["osv_id"]: r for r in rows}.values()
        for chunk in _chunks(list(deduped), 500):
            sb.table("vulnerabilities").upsert(chunk, on_conflict="osv_id").execute()

    log.info("OSV upsert complete.")


def _chunks(lst: list, n: int):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)

    log.info("Ingestion window: %s → %s", since.isoformat(), now.isoformat())

    sb = get_supabase()

    # --- NVD ---
    raw_nvd = fetch_nvd_cves(since, now)
    nvd_records = [r for item in raw_nvd if (r := parse_nvd_item(item))]

    log.info("Enriching NVD records with EPSS + KEV scoring...")
    nvd_records = enrich_records(nvd_records)

    upsert_nvd_records(sb, nvd_records)

    # --- OSV ---
    osv_records = []
    for eco in OSV_ECOSYSTEMS:
        raw_osv = fetch_osv_for_ecosystem(eco, since)
        osv_records.extend(
            r for item in raw_osv if (r := parse_osv_item(item, eco))
        )
    upsert_osv_records(sb, osv_records)

    log.info(
        "Done. NVD=%d OSV=%d records ingested.",
        len(nvd_records),
        len(osv_records),
    )


if __name__ == "__main__":
    main()
