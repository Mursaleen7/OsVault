use reqwest::Client;
use std::collections::HashSet;
use tracing::warn;

use crate::types::KevResponse;

const KEV_URL: &str =
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

/// Download CISA KEV catalog and return set of CVE ids.
pub async fn fetch_kev(client: &Client) -> HashSet<String> {
    match client.get(KEV_URL).send().await {
        Err(e) => { warn!("KEV fetch failed: {}", e); HashSet::new() }
        Ok(resp) => {
            match resp.json::<KevResponse>().await {
                Err(e) => { warn!("KEV parse failed: {}", e); HashSet::new() }
                Ok(data) => data.vulnerabilities.into_iter().map(|v| v.cve_id).collect(),
            }
        }
    }
}
