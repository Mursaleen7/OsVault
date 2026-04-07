use reqwest::Client;
use std::collections::HashSet;
use tracing::warn;

use crate::types::KevResponse;

const KEV_URL: &str =
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

/// Download CISA KEV catalog and return set of CVE ids.
pub async fn fetch_kev(client: &Client) -> HashSet<String> {
    match client.get(KEV_URL)
        .header("Accept", "application/json")
        .send().await
    {
        Err(e) => { warn!("KEV fetch failed: {}", e); HashSet::new() }
        Ok(resp) => {
            let text = match resp.text().await {
                Err(e) => { warn!("KEV read failed: {}", e); return HashSet::new(); }
                Ok(t) => t,
            };
            match serde_json::from_str::<KevResponse>(&text) {
                Err(e) => { warn!("KEV parse failed: {} (body prefix: {})", e, &text[..text.len().min(200)]); HashSet::new() }
                Ok(data) => data.vulnerabilities.into_iter().map(|v| v.cve_id).collect(),
            }
        }
    }
}
