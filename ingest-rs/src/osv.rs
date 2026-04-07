use anyhow::Result;
use bytes::Bytes;
use chrono::{DateTime, NaiveDateTime, Utc};
use reqwest::Client;
use std::io::Read;
use tracing::{info, warn};

use crate::types::*;

pub async fn fetch_osv_bulk(
    client: &Client,
    ecosystem: &str,
    since: &DateTime<Utc>,
) -> Result<Vec<OsvVuln>> {
    let url = format!(
        "https://osv-vulnerabilities.storage.googleapis.com/{}/all.zip",
        ecosystem
    );
    info!("OSV downloading bulk zip for {} ...", ecosystem);

    let resp = client.get(&url).send().await?;
    if resp.status() == 404 {
        warn!("OSV: no bulk zip for ecosystem {}", ecosystem);
        return Ok(vec![]);
    }
    resp.error_for_status_ref()?;

    let bytes: Bytes = resp.bytes().await?;
    let cursor = std::io::Cursor::new(bytes);
    let mut zip = zip::ZipArchive::new(cursor)?;

    let since_naive = since.naive_utc();
    let mut items: Vec<OsvVuln> = Vec::new();

    for i in 0..zip.len() {
        let mut file = zip.by_index(i)?;
        if !file.name().ends_with(".json") {
            continue;
        }

        let mut buf = String::new();
        if file.read_to_string(&mut buf).is_err() {
            continue;
        }

        let vuln: OsvVuln = match serde_json::from_str(&buf) {
            Ok(v)  => v,
            Err(_) => continue,
        };

        // Filter by modified date
        if let Some(modified_str) = &vuln.modified {
            let normalized = modified_str.trim_end_matches('Z');
            if let Ok(dt) = NaiveDateTime::parse_from_str(normalized, "%Y-%m-%dT%H:%M:%S") {
                if dt < since_naive {
                    continue;
                }
            }
        }

        items.push(vuln);
    }

    info!("OSV: fetched {} vulns for {}", items.len(), ecosystem);
    Ok(items)
}

pub fn parse_osv_item(vuln: &OsvVuln, ecosystem: &str) -> Option<OsvRow> {
    let osv_id = vuln.id.clone()?;

    // Linked CVE id from aliases
    let _cve_id = vuln.aliases.as_deref().unwrap_or(&[])
        .iter()
        .find(|a| a.starts_with("CVE-"))
        .cloned();

    let summary = vuln.summary.clone()
        .or_else(|| vuln.details.as_ref().map(|d| d.chars().take(500).collect()));

    // Affected packages for this ecosystem
    let mut packages: Vec<serde_json::Value> = Vec::new();
    for aff in vuln.affected.as_deref().unwrap_or(&[]) {
        let pkg = match &aff.package {
            Some(p) => p,
            None    => continue,
        };
        let eco = pkg.ecosystem.as_deref().unwrap_or("");
        if eco.to_lowercase() != ecosystem.to_lowercase() {
            continue;
        }

        let versions: Vec<String> = aff.ranges.as_deref().unwrap_or(&[])
            .iter()
            .flat_map(|r| r.events.as_deref().unwrap_or(&[]))
            .filter_map(|e| e.introduced.clone().or_else(|| e.fixed.clone()))
            .collect();

        packages.push(serde_json::json!({
            "name":      pkg.name,
            "ecosystem": pkg.ecosystem,
            "versions":  versions,
        }));
    }

    // CVSS vector from severity field
    let cvss_vector = vuln.severity.as_deref().unwrap_or(&[])
        .iter()
        .find(|s| s.kind == "CVSS_V3" || s.kind == "CVSS_V2")
        .and_then(|s| s.score.clone());

    let ghsa_id = if osv_id.starts_with("GHSA-") {
        Some(osv_id.clone())
    } else {
        None
    };

    Some(OsvRow {
        osv_id,
        ghsa_id,
        ecosystem: ecosystem.to_string(),
        summary,
        affected_packages: serde_json::Value::Array(packages),
        cvss_vector,
        cvss_score: None,
        published_at: vuln.published.clone(),
        modified_at:  vuln.modified.clone(),
        source: "osv".to_string(),
    })
}
