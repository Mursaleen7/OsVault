mod epss;
mod kev;
mod nvd;
mod osv;
mod score;
mod supabase;
mod types;

use anyhow::Result;
use chrono::{Duration, Utc};
use reqwest::Client;
use tracing::info;

const OSV_ECOSYSTEMS: &[&str] = &["npm", "PyPI"];

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env if present (local dev)
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let supabase_url = std::env::var("SUPABASE_URL")
        .expect("SUPABASE_URL must be set");
    let supabase_key = std::env::var("SUPABASE_KEY")
        .expect("SUPABASE_KEY must be set");
    let nvd_api_key  = std::env::var("NVD_API_KEY").ok();

    // 24h in CI, 7 days locally
    let lookback_days = if std::env::var("CI").is_ok() { 1i64 } else { 7i64 };

    let now   = Utc::now();
    let since = now - Duration::days(lookback_days);

    info!("Ingestion window: {} → {}", since.to_rfc3339(), now.to_rfc3339());

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .user_agent("osvault-ingest/0.1")
        .build()?;

    // -----------------------------------------------------------------------
    // NVD
    // -----------------------------------------------------------------------
    let raw_nvd = nvd::fetch_nvd_cves(&client, nvd_api_key.as_deref(), &since, &now).await?;
    let mut nvd_rows: Vec<types::NvdRow> = raw_nvd
        .iter()
        .filter_map(|w| nvd::parse_nvd_item(w))
        .collect();

    // Enrich with EPSS + KEV
    info!("Enriching {} NVD records with EPSS + KEV...", nvd_rows.len());
    let cve_ids: Vec<String> = nvd_rows.iter().map(|r| r.cve_id.clone()).collect();

    let (epss_map, kev_set) = tokio::join!(
        epss::fetch_epss(&client, &cve_ids),
        kev::fetch_kev(&client),
    );
    info!("KEV catalog has {} entries.", kev_set.len());

    for row in &mut nvd_rows {
        if let Some(&(epss_score, epss_pct)) = epss_map.get(&row.cve_id) {
            row.epss_score      = Some(epss_score);
            row.epss_percentile = Some(epss_pct);
        }
        row.in_kev = kev_set.contains(&row.cve_id);

        // Use the v2 engine to get score + maturity tier + confidence band
        let risk = score::compute_risk_result(
            row.cvss_score,
            row.cvss_vector.as_deref(),
            row.epss_score,
            row.in_kev,
        );
        row.combined_risk_score = Some(risk.score);
        row.exploit_maturity    = Some(risk.maturity.as_str().to_string());
        row.risk_confidence     = Some(risk.confidence.as_str().to_string());
    }

    info!("Upserting {} NVD records...", nvd_rows.len());
    supabase::upsert(&client, &supabase_url, &supabase_key, "vulnerabilities", &nvd_rows, "cve_id").await?;
    info!("NVD upsert complete.");

    // -----------------------------------------------------------------------
    // OSV
    // -----------------------------------------------------------------------
    let mut osv_rows: Vec<types::OsvRow> = Vec::new();
    let mut osv_cve_links: Vec<(String, Option<String>)> = Vec::new();

    for eco in OSV_ECOSYSTEMS {
        let raw = osv::fetch_osv_bulk(&client, eco, &since).await?;
        for vuln in &raw {
            if let Some(row) = osv::parse_osv_item(vuln, eco) {
                // Collect (osv_id, cve_id) for back-fill step
                let cve_id = vuln.aliases.as_deref().unwrap_or(&[])
                    .iter()
                    .find(|a| a.starts_with("CVE-"))
                    .cloned();
                osv_cve_links.push((row.osv_id.clone(), cve_id));
                osv_rows.push(row);
            }
        }
    }

    // Deduplicate by osv_id
    let mut seen = std::collections::HashSet::new();
    osv_rows.retain(|r| seen.insert(r.osv_id.clone()));

    info!("Upserting {} OSV records...", osv_rows.len());
    supabase::upsert(&client, &supabase_url, &supabase_key, "vulnerabilities", &osv_rows, "osv_id").await?;
    info!("OSV upsert complete.");

    // Back-fill cve_id on OSV rows — skip if too many records to avoid timeout
    if osv_cve_links.len() < 500 {
        supabase::link_osv_cve_ids(&client, &supabase_url, &supabase_key, &osv_cve_links).await?;
    } else {
        info!("Skipping cve_id back-fill ({} records — too many for single run)", osv_cve_links.len());
    }

    info!(
        "Done. NVD={} OSV={} records ingested.",
        nvd_rows.len(),
        osv_rows.len()
    );

    Ok(())
}
