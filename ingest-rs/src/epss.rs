use reqwest::Client;
use std::collections::HashMap;
use tracing::warn;

use crate::types::EpssResponse;

const EPSS_API: &str = "https://api.first.org/data/v1/epss";

/// Fetch EPSS scores for up to N CVE ids (batched at 100).
/// Returns map of cve_id → (epss_score, epss_percentile).
pub async fn fetch_epss(
    client: &Client,
    cve_ids: &[String],
) -> HashMap<String, (f64, f64)> {
    let mut result: HashMap<String, (f64, f64)> = HashMap::new();

    for batch in cve_ids.chunks(100) {
        let cve_param = batch.join(",");
        match client
            .get(EPSS_API)
            .query(&[("cve", &cve_param)])
            .send()
            .await
        {
            Err(e) => { warn!("EPSS request failed: {}", e); }
            Ok(resp) => {
                match resp.json::<EpssResponse>().await {
                    Err(e) => { warn!("EPSS parse failed: {}", e); }
                    Ok(data) => {
                        for entry in data.data {
                            let epss: f64 = entry.epss.parse().unwrap_or(0.0);
                            let pct:  f64 = entry.percentile.parse().unwrap_or(0.0);
                            result.insert(entry.cve, (epss, pct));
                        }
                    }
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    }

    result
}
