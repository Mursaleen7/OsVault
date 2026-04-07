use anyhow::Result;
use reqwest::Client;
use serde::Serialize;
use tracing::{info, warn};

/// Upsert a batch of rows into a Supabase table via the REST API.
/// `on_conflict` is the column name used for upsert resolution.
pub async fn upsert<T: Serialize>(
    client: &Client,
    supabase_url: &str,
    supabase_key: &str,
    table: &str,
    rows: &[T],
    on_conflict: &str,
) -> Result<()> {
    if rows.is_empty() {
        return Ok(());
    }

    let url = format!("{}/rest/v1/{}", supabase_url, table);

    for chunk in rows.chunks(500) {
        let resp = client
            .post(&url)
            .header("apikey",        supabase_key)
            .header("Authorization", format!("Bearer {}", supabase_key))
            .header("Content-Type",  "application/json")
            .header("Prefer",        format!("resolution=merge-duplicates,return=minimal"))
            .query(&[("on_conflict", on_conflict)])
            .json(chunk)
            .send()
            .await?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            warn!("Supabase upsert {} failed {}: {}", table, status, body);
        }
    }

    Ok(())
}

/// Fetch all cve_ids owned by NVD rows (for OSV back-fill logic).
pub async fn fetch_nvd_cve_ids(
    client: &Client,
    supabase_url: &str,
    supabase_key: &str,
) -> std::collections::HashSet<String> {
    let url = format!("{}/rest/v1/vulnerabilities", supabase_url);
    let resp = client
        .get(&url)
        .header("apikey",        supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .query(&[("select", "cve_id"), ("source", "eq.nvd"), ("limit", "10000")])
        .send()
        .await;

    match resp {
        Err(e) => { warn!("fetch_nvd_cve_ids failed: {}", e); Default::default() }
        Ok(r)  => {
            let rows: Vec<serde_json::Value> = r.json().await.unwrap_or_default();
            rows.iter()
                .filter_map(|r| r["cve_id"].as_str().map(|s| s.to_string()))
                .collect()
        }
    }
}

/// Back-fill cve_id on OSV rows that don't conflict with NVD rows.
pub async fn link_osv_cve_ids(
    client: &Client,
    supabase_url: &str,
    supabase_key: &str,
    osv_records: &[(String, Option<String>)], // (osv_id, cve_id)
) -> Result<()> {
    let nvd_ids = fetch_nvd_cve_ids(client, supabase_url, supabase_key).await;
    let url = format!("{}/rest/v1/vulnerabilities", supabase_url);
    let mut updated = 0usize;
    let mut seen_cves = nvd_ids.clone();

    for (osv_id, maybe_cve) in osv_records {
        let cve_id = match maybe_cve {
            Some(c) => c,
            None    => continue,
        };
        if seen_cves.contains(cve_id) {
            continue;
        }

        let patch = serde_json::json!({ "cve_id": cve_id });
        let resp = client
            .patch(&url)
            .header("apikey",        supabase_key)
            .header("Authorization", format!("Bearer {}", supabase_key))
            .header("Content-Type",  "application/json")
            .header("Prefer",        "return=minimal")
            .query(&[("osv_id", format!("eq.{}", osv_id))])
            .json(&patch)
            .send()
            .await;

        match resp {
            Err(e) => warn!("link cve_id {} → {}: {}", cve_id, osv_id, e),
            Ok(r) if !r.status().is_success() => {
                warn!("link cve_id {} → {} status {}", cve_id, osv_id, r.status());
            }
            Ok(_) => {
                seen_cves.insert(cve_id.clone());
                updated += 1;
            }
        }
    }

    info!("Linked cve_id on {} OSV records.", updated);
    Ok(())
}
