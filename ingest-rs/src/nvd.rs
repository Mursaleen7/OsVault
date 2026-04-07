use anyhow::Result;
use chrono::{DateTime, Utc};
use reqwest::Client;
use tracing::{info, warn};

use crate::types::*;

const NVD_BASE: &str = "https://services.nvd.nist.gov/rest/json/cves/2.0";

pub async fn fetch_nvd_cves(
    client: &Client,
    api_key: Option<&str>,
    start: &DateTime<Utc>,
    end: &DateTime<Utc>,
) -> Result<Vec<NvdVulnWrapper>> {
    let fmt = "%Y-%m-%dT%H:%M:%S%.3f+00:00";
    let mut start_index: u64 = 0;
    let mut all: Vec<NvdVulnWrapper> = Vec::new();

    loop {
        info!("NVD fetch startIndex={}", start_index);

        let mut req = client
            .get(NVD_BASE)
            .query(&[
                ("pubStartDate",    start.format(fmt).to_string()),
                ("pubEndDate",      end.format(fmt).to_string()),
                ("resultsPerPage",  "2000".to_string()),
                ("startIndex",      start_index.to_string()),
            ]);

        if let Some(key) = api_key {
            req = req.header("apiKey", key);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            warn!("NVD returned {}", resp.status());
            break;
        }

        let data: NvdResponse = resp.json().await?;
        let count = data.vulnerabilities.len() as u64;
        let total = data.total_results;
        all.extend(data.vulnerabilities);
        start_index += count;

        if start_index >= total || count == 0 {
            break;
        }

        // Rate limit: 1s with key, 7s without
        let delay = if api_key.is_some() { 1 } else { 7 };
        tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
    }

    info!("NVD: fetched {} CVEs", all.len());
    Ok(all)
}

pub fn parse_nvd_item(wrapper: &NvdVulnWrapper) -> Option<crate::types::NvdRow> {
    let cve = &wrapper.cve;
    let cve_id = cve.id.clone();

    // English description
    let description = cve.descriptions.iter()
        .find(|d| d.lang == "en")
        .map(|d| d.value.clone());

    // CVSS — prefer v3.1 → v3.0 → v2
    let mut cvss_score    = None;
    let mut cvss_vector   = None;
    let mut cvss_severity = None;

    if let Some(metrics) = &cve.metrics {
        let candidates = [
            metrics.cvss_metric_v31.as_deref(),
            metrics.cvss_metric_v30.as_deref(),
            metrics.cvss_metric_v2.as_deref(),
        ];
        'outer: for entries in candidates.iter().flatten() {
            if let Some(entry) = entries.first() {
                cvss_score    = entry.cvss_data.base_score;
                cvss_vector   = entry.cvss_data.vector_string.clone();
                cvss_severity = entry.cvss_data.base_severity.clone()
                    .or_else(|| entry.base_severity.clone());
                break 'outer;
            }
        }
    }

    // CPE list
    let cpe_list: Vec<String> = cve.configurations
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .flat_map(|c| &c.nodes)
        .flat_map(|n| &n.cpe_match)
        .filter(|m| m.vulnerable)
        .filter_map(|m| m.criteria.clone())
        .collect();

    Some(NvdRow {
        cve_id,
        description,
        cvss_score,
        cvss_vector,
        cvss_severity,
        cpe_list,
        published_at: cve.published.clone(),
        modified_at:  cve.last_modified.clone(),
        epss_score:          None,
        epss_percentile:     None,
        in_kev:              false,
        combined_risk_score: None,
        source: "nvd".to_string(),
    })
}
