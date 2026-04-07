"""
Risk scoring module.

combined_risk_score (0–100) formula:
  - CVSS base score  → 50% weight  (normalized: cvss/10 * 50)
  - EPSS score       → 30% weight  (epss * 100 * 0.30)
  - CISA KEV bonus   → 20% flat    (20 if in KEV, else 0)

Rationale:
  - CVSS tells you how bad it *could* be (severity)
  - EPSS tells you how likely it is to be exploited *in the wild* (probability)
  - KEV confirms it *is already* being exploited (ground truth)

A critical CVE (CVSS 10) with high EPSS (0.95) that's in KEV scores:
  (10/10 * 50) + (0.95 * 30) + 20 = 50 + 28.5 + 20 = 98.5 ✓

A medium CVE (CVSS 5) with low EPSS (0.01) not in KEV scores:
  (5/10 * 50) + (0.01 * 30) + 0 = 25 + 0.3 + 0 = 25.3 ✓
"""

import logging
import requests
import time

log = logging.getLogger(__name__)

EPSS_API = "https://api.first.org/data/v1/epss"
KEV_URL  = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

# ---------------------------------------------------------------------------
# EPSS
# ---------------------------------------------------------------------------

def fetch_epss(cve_ids: list[str]) -> dict[str, dict]:
    """
    Fetch EPSS scores for a list of CVE ids.
    Returns {cve_id: {epss_score, epss_percentile}}.
    FIRST API accepts up to 100 CVE ids per request.
    """
    result = {}
    for i in range(0, len(cve_ids), 100):
        batch = cve_ids[i:i+100]
        params = {"cve": ",".join(batch)}
        try:
            resp = requests.get(EPSS_API, params=params, timeout=15)
            resp.raise_for_status()
            for item in resp.json().get("data", []):
                result[item["cve"]] = {
                    "epss_score":       float(item.get("epss", 0)),
                    "epss_percentile":  float(item.get("percentile", 0)),
                }
        except Exception as e:
            log.warning("EPSS fetch failed for batch: %s", e)
        time.sleep(0.3)
    return result


# ---------------------------------------------------------------------------
# CISA KEV
# ---------------------------------------------------------------------------

def fetch_kev() -> set[str]:
    """
    Download CISA Known Exploited Vulnerabilities catalog.
    Returns a set of CVE ids that are actively exploited.
    """
    try:
        resp = requests.get(KEV_URL, timeout=20)
        resp.raise_for_status()
        vulns = resp.json().get("vulnerabilities", [])
        return {v["cveID"] for v in vulns}
    except Exception as e:
        log.warning("KEV fetch failed: %s", e)
        return set()


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def compute_risk_score(
    cvss_score: float | None,
    epss_score: float | None,
    in_kev: bool,
) -> float:
    cvss_component = ((cvss_score or 0) / 10) * 50
    epss_component = (epss_score or 0) * 30
    kev_component  = 20 if in_kev else 0
    return round(cvss_component + epss_component + kev_component, 2)


def enrich_records(records: list[dict]) -> list[dict]:
    """
    Takes parsed NVD records, fetches EPSS + KEV, adds scoring fields.
    Returns enriched records ready for upsert.
    """
    cve_ids = [r["cve_id"] for r in records if r.get("cve_id")]

    log.info("Fetching EPSS scores for %d CVEs...", len(cve_ids))
    epss_map = fetch_epss(cve_ids)

    log.info("Fetching CISA KEV catalog...")
    kev_set = fetch_kev()
    log.info("KEV catalog has %d entries.", len(kev_set))

    for r in records:
        cve_id = r.get("cve_id")
        epss   = epss_map.get(cve_id, {})
        r["epss_score"]        = epss.get("epss_score")
        r["epss_percentile"]   = epss.get("epss_percentile")
        r["in_kev"]            = cve_id in kev_set
        r["combined_risk_score"] = compute_risk_score(
            r.get("cvss_score"),
            r.get("epss_score"),
            r["in_kev"],
        )

    return records
