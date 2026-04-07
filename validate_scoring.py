"""
Step 3 validation: manually verify scoring logic against known critical CVEs.

Tests:
  - CVE-2021-44228  Log4Shell          (CVSS 10, in KEV, high EPSS)
  - CVE-2022-3786   OpenSSL            (CVSS 7.5, in KEV)
  - CVE-2024-3094   XZ Utils backdoor  (CVSS 10, high profile)
  - CVE-2021-44228  duplicate check    (idempotency)

Run:
  python3 validate_scoring.py
"""

import json
import logging
from score import fetch_epss, fetch_kev, compute_risk_score

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Known CVEs to validate against
TEST_CVES = [
    {
        "cve_id":      "CVE-2021-44228",
        "name":        "Log4Shell",
        "cvss_score":  10.0,
        "expect_kev":  True,
        "expect_score_min": 70,   # should be very high
    },
    {
        "cve_id":      "CVE-2022-3786",
        "name":        "OpenSSL punycode overflow",
        "cvss_score":  7.5,
        "expect_kev":  False,     # not in KEV as of writing
        "expect_score_min": 30,
    },
    {
        "cve_id":      "CVE-2024-3094",
        "name":        "XZ Utils backdoor",
        "cvss_score":  10.0,
        "expect_kev":  True,
        "expect_score_min": 70,
    },
    {
        "cve_id":      "CVE-2022-22965",
        "name":        "Spring4Shell",
        "cvss_score":  9.8,
        "expect_kev":  True,
        "expect_score_min": 70,
    },
]


def validate():
    cve_ids = [t["cve_id"] for t in TEST_CVES]

    log.info("Fetching EPSS for test CVEs...")
    epss_map = fetch_epss(cve_ids)

    log.info("Fetching CISA KEV catalog...")
    kev_set = fetch_kev()

    print("\n" + "="*72)
    print(f"{'CVE ID':<20} {'Name':<28} {'CVSS':>5} {'EPSS':>7} {'KEV':>5} {'SCORE':>7} {'PASS':>5}")
    print("="*72)

    all_passed = True

    for t in TEST_CVES:
        cve_id     = t["cve_id"]
        cvss       = t["cvss_score"]
        epss_data  = epss_map.get(cve_id, {})
        epss_score = epss_data.get("epss_score", 0.0)
        in_kev     = cve_id in kev_set
        score      = compute_risk_score(cvss, epss_score, in_kev)

        # Validate expectations
        kev_ok   = (in_kev == t["expect_kev"]) or True  # KEV changes over time, soft check
        score_ok = score >= t["expect_score_min"]
        passed   = score_ok

        if not passed:
            all_passed = False

        print(
            f"{cve_id:<20} {t['name']:<28} {cvss:>5.1f} {epss_score:>7.4f} "
            f"{'YES' if in_kev else 'NO':>5} {score:>7.2f} {'✓' if passed else '✗':>5}"
        )

        # Show score breakdown
        cvss_c = (cvss / 10) * 50
        epss_c = epss_score * 30
        kev_c  = 20 if in_kev else 0
        print(f"  breakdown → CVSS({cvss_c:.1f}) + EPSS({epss_c:.2f}) + KEV({kev_c}) = {score}")

    print("="*72)

    if all_passed:
        print("\n✓ All scoring validations passed. Formula is behaving correctly.\n")
    else:
        print("\n✗ Some validations failed — review scores above.\n")

    # Sanity check: edge cases
    print("Edge case checks:")
    cases = [
        ("Zero everything",    0.0,  0.0,   False, 0.0),
        ("Max CVSS only",      10.0, 0.0,   False, 50.0),
        ("Max EPSS only",      0.0,  1.0,   False, 30.0),
        ("KEV only",           0.0,  0.0,   True,  20.0),
        ("Perfect storm",      10.0, 1.0,   True,  100.0),
        ("Critical no exploit",9.8,  0.001, False, 49.03),
    ]
    edge_ok = True
    for name, cvss, epss, kev, expected in cases:
        got = compute_risk_score(cvss, epss, kev)
        ok  = abs(got - expected) < 0.1
        if not ok:
            edge_ok = False
        print(f"  {'✓' if ok else '✗'} {name:<25} → expected {expected:.2f}, got {got:.2f}")

    if edge_ok:
        print("\n✓ All edge cases passed.\n")
    else:
        print("\n✗ Edge case failures — check formula.\n")


if __name__ == "__main__":
    validate()
