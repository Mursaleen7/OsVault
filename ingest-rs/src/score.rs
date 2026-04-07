/// combined_risk_score (0–100):
///   CVSS  → 50%  (cvss/10 * 50)
///   EPSS  → 30%  (epss * 30)
///   KEV   → 20   (flat bonus if in CISA KEV)
pub fn compute_risk_score(cvss: Option<f64>, epss: Option<f64>, in_kev: bool) -> f64 {
    let cvss_c = (cvss.unwrap_or(0.0) / 10.0) * 50.0;
    let epss_c = epss.unwrap_or(0.0) * 30.0;
    let kev_c  = if in_kev { 20.0 } else { 0.0 };
    let raw    = cvss_c + epss_c + kev_c;
    (raw * 100.0).round() / 100.0
}
