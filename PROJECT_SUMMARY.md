# OsVault Project Summary

## Overview
OsVault is a comprehensive vulnerability management platform with three main components:

1. **Web Application** (`osvault-web/`) - Next.js app for CVE lookup and reporting
2. **GitHub App** (`github-app/`) - Automated PR vulnerability scanning with reachability analysis
3. **Data Ingestion** (`ingest-rs/`) - Rust-based CVE data ingestion pipeline

---

## 1. Web Application (osvault-web/)

**URL**: https://os-vault-kappa.vercel.app

### Features
- CVE vulnerability lookup and detailed reports
- Package vulnerability checker (npm packages)
- PDF report generation
- Google Search Console indexing integration
- Supabase database integration

### Key Files
- `src/app/page.tsx` - Landing page
- `src/app/cve/[id]/page.tsx` - CVE detail pages
- `src/app/npm/[package]/page.tsx` - Package vulnerability pages
- `src/app/api/check/route.ts` - Package checking API
- `src/app/api/report/route.ts` - PDF report generation
- `src/app/api/cron/smart-indexing/route.ts` - Automated Google indexing

### Utility Scripts
- `check-indexing-stats.ts` - Check Google indexing status
- `quick-index.ts` - Manually index URLs
- `smart-daily-indexing.ts` - Smart daily indexing script

---

## 2. GitHub App (github-app/)

**URL**: https://github-app-psi-plum.vercel.app
**Webhook**: https://github-app-psi-plum.vercel.app/webhook

### Features
- ✅ Automatic vulnerability scanning on PRs
- 🎯 Reachability analysis (detects if vulnerable packages are actually imported)
- 📊 Detailed check runs with CVE links and severity levels
- 🚀 Supports npm (package.json) and PyPI (requirements.txt)

### How It Works
1. Triggered when PR modifies `package.json` or `requirements.txt`
2. Extracts added/modified dependencies from git diff
3. Queries Supabase for known vulnerabilities
4. Analyzes repository code to detect imports
5. Posts GitHub check run with results:
   - **REACHABLE** 🔴 - Package is imported (action required)
   - **BYPASSED** ⚪ - Package not imported (safe to ignore)

### Key Files
- `src/index.ts` - Main webhook handler
- `src/checks.ts` - GitHub check run posting
- `src/diff.ts` - Dependency diff parsing
- `src/reachability.ts` - Import detection and reachability analysis
- `src/supabase.ts` - Vulnerability database queries
- `src/usage.ts` - Usage tracking for private repos

### Environment Variables (Vercel)
```
GITHUB_APP_ID=3305789
GITHUB_APP_PRIVATE_KEY=<single line with \n escapes>
GITHUB_WEBHOOK_SECRET=322feb5d4a...
SUPABASE_URL=https://elsqklexagjovwxseyba.supabase.co
SUPABASE_KEY=<service role key>
APP_URL=https://os-vault-kappa.vercel.app
```

---

## 3. Data Ingestion (ingest-rs/)

Rust-based pipeline for ingesting vulnerability data from multiple sources.

### Sources
- NVD (National Vulnerability Database)
- OSV (Open Source Vulnerabilities)
- EPSS (Exploit Prediction Scoring System)
- KEV (Known Exploited Vulnerabilities)

### Key Files
- `src/main.rs` - Main ingestion orchestrator
- `src/nvd.rs` - NVD data fetching
- `src/osv.rs` - OSV data fetching
- `src/epss.rs` - EPSS scoring
- `src/kev.rs` - KEV data
- `src/supabase.rs` - Database operations
- `src/score.rs` - Vulnerability scoring logic

---

## 4. Scripts Directory (scripts/)

### Google Indexing Scripts
- `index-all-cves.ts` - Index all CVE pages
- `index-sitemap.ts` - Index from sitemap
- `schedule-indexing.ts` - Schedule indexing jobs
- `show-service-account-emails.ts` - List service accounts
- `setup-google-indexing.md` - Setup documentation

### Database
- `migration-add-indexing-columns.sql` - Indexing tracking schema

---

## Database Schema (Supabase)

### Main Tables
- `vulnerabilities` - CVE data with severity, CVSS scores, descriptions
- `affected_packages` - Package-to-CVE mappings
- `indexing_metadata` - Google indexing status tracking
- `usage_tracking` - GitHub App usage for private repos

### Key Columns (vulnerabilities)
- `cve_id` - CVE identifier
- `severity` - LOW, MEDIUM, HIGH, CRITICAL
- `cvss_score` - CVSS v3 score
- `epss_score` - Exploit prediction score
- `is_kev` - Known exploited vulnerability flag
- `google_indexed_at` - Last indexed timestamp
- `google_index_status` - Indexing status

---

## Google Indexing System

### Features
- Multi-account rotation (bypass 200 URL/day limit)
- Smart prioritization (latest CVEs first)
- Duplicate detection (checks if already indexed)
- Automated daily indexing via Vercel cron

### Current Status
- **Service Accounts**: 1 configured (200 URLs/day capacity)
- **Total CVEs**: 39,877
- **Indexed**: 197 URLs
- **Estimated Completion**: 200 days (with 1 account)

### API Endpoints
- `POST /api/indexing` - Index single URL
- `POST /api/indexing/batch` - Index multiple URLs
- `GET /api/cron/smart-indexing` - Automated daily indexing

---

## Deployment

### Web App (osvault-web)
- Platform: Vercel
- URL: https://os-vault-kappa.vercel.app
- Auto-deploys from `main` branch

### GitHub App (github-app)
- Platform: Vercel
- URL: https://github-app-psi-plum.vercel.app
- Webhook: `/webhook` endpoint
- Auto-deploys from `main` branch

### Database
- Platform: Supabase
- Project: elsqklexagjovwxseyba
- Region: US East

---

## Development

### Web App
```bash
cd osvault-web
npm install
npm run dev  # http://localhost:3000
```

### GitHub App
```bash
cd github-app
npm install
npm run build
npm start    # http://localhost:3001
```

### Data Ingestion
```bash
cd ingest-rs
cargo build --release
cargo run
```

---

## Testing

### Test PR
- Repository: https://github.com/Mursaleen7/OsVault
- PR: https://github.com/Mursaleen7/OsVault/pull/1
- Test Package: lodash@4.17.20 (CVE-2021-23337)
- Expected: REACHABLE (imported in `osvault-web/src/app/test-reachable.ts`)

---

## Key Achievements

✅ Complete vulnerability database with 39,877 CVEs
✅ Google Indexing API integration with multi-account rotation
✅ GitHub App with reachability analysis (reduces false positives)
✅ Automated PR checks with detailed vulnerability reports
✅ Smart indexing system prioritizing latest CVEs
✅ PDF report generation for vulnerability assessments
✅ Clean, production-ready codebase

---

## Next Steps (Optional Enhancements)

1. Add more Google service accounts to speed up indexing
2. Expand reachability analysis to more languages (Go, Java, Ruby)
3. Add Slack/Discord notifications for critical vulnerabilities
4. Implement vulnerability trending and statistics dashboard
5. Add API rate limiting and authentication
6. Create browser extension for quick CVE lookups
