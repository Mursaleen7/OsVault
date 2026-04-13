use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// NVD row written to Supabase
// ---------------------------------------------------------------------------
#[derive(Debug, Serialize)]
pub struct NvdRow {
    pub cve_id:              String,
    pub description:         Option<String>,
    pub cvss_score:          Option<f64>,
    pub cvss_vector:         Option<String>,
    pub cvss_severity:       Option<String>,
    pub cpe_list:            Vec<String>,
    pub published_at:        Option<String>,
    pub modified_at:         Option<String>,
    pub epss_score:          Option<f64>,
    pub epss_percentile:     Option<f64>,
    pub in_kev:              bool,
    pub combined_risk_score: Option<f64>,
    pub exploit_maturity:    Option<String>,   // UNPROVEN | POC | FUNCTIONAL | WEAPONIZED
    pub risk_confidence:     Option<String>,    // LOW | MEDIUM | HIGH
    pub has_fix:             bool,
    pub source:              String,
}

// ---------------------------------------------------------------------------
// OSV row written to Supabase
// ---------------------------------------------------------------------------
#[derive(Debug, Serialize)]
pub struct OsvRow {
    pub osv_id:            String,
    pub ghsa_id:           Option<String>,
    pub ecosystem:         String,
    pub summary:           Option<String>,
    pub affected_packages: serde_json::Value,
    pub cvss_vector:       Option<String>,
    pub cvss_score:        Option<f64>,
    pub published_at:      Option<String>,
    pub modified_at:       Option<String>,
    pub source:            String,
}

// ---------------------------------------------------------------------------
// NVD API response shapes
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdResponse {
    pub total_results:   u64,
    pub vulnerabilities: Vec<NvdVulnWrapper>,
}

#[derive(Debug, Deserialize)]
pub struct NvdVulnWrapper {
    pub cve: NvdCve,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdCve {
    pub id:             String,
    pub published:      Option<String>,
    pub last_modified:  Option<String>,
    pub descriptions:   Vec<NvdDescription>,
    pub metrics:        Option<NvdMetrics>,
    pub configurations: Option<Vec<NvdConfiguration>>,
}

#[derive(Debug, Deserialize)]
pub struct NvdDescription {
    pub lang:  String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdMetrics {
    pub cvss_metric_v31: Option<Vec<NvdCvssEntry>>,
    pub cvss_metric_v30: Option<Vec<NvdCvssEntry>>,
    pub cvss_metric_v2:  Option<Vec<NvdCvssEntry>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdCvssEntry {
    pub cvss_data:     NvdCvssData,
    pub base_severity: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdCvssData {
    pub base_score:    Option<f64>,
    pub vector_string: Option<String>,
    pub base_severity: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NvdConfiguration {
    pub nodes: Vec<NvdNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvdNode {
    pub cpe_match: Vec<NvdCpeMatch>,
}

#[derive(Debug, Deserialize)]
pub struct NvdCpeMatch {
    pub vulnerable: bool,
    pub criteria:   Option<String>,
}

// ---------------------------------------------------------------------------
// EPSS API response
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct EpssResponse {
    pub data: Vec<EpssEntry>,
}

#[derive(Debug, Deserialize)]
pub struct EpssEntry {
    pub cve:        String,
    pub epss:       String,
    pub percentile: String,
}

// ---------------------------------------------------------------------------
// CISA KEV response
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct KevResponse {
    pub vulnerabilities: Vec<KevEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KevEntry {
    #[serde(rename = "cveID")]
    pub cve_id: String,
}

// ---------------------------------------------------------------------------
// OSV vulnerability (from bulk zip JSON files)
// ---------------------------------------------------------------------------
#[derive(Debug, Deserialize)]
pub struct OsvVuln {
    pub id:       Option<String>,
    pub aliases:  Option<Vec<String>>,
    pub summary:  Option<String>,
    pub details:  Option<String>,
    pub modified: Option<String>,
    pub published: Option<String>,
    pub affected: Option<Vec<OsvAffected>>,
    pub severity: Option<Vec<OsvSeverity>>,
}

#[derive(Debug, Deserialize)]
pub struct OsvAffected {
    pub package: Option<OsvPackage>,
    pub ranges:  Option<Vec<OsvRange>>,
}

#[derive(Debug, Deserialize)]
pub struct OsvPackage {
    pub name:      Option<String>,
    pub ecosystem: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OsvRange {
    pub events: Option<Vec<OsvEvent>>,
}

#[derive(Debug, Deserialize)]
pub struct OsvEvent {
    pub introduced: Option<String>,
    pub fixed:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OsvSeverity {
    #[serde(rename = "type")]
    pub kind:  String,
    pub score: Option<String>,
}
