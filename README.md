# OsVault

Vulnerability intelligence platform for npm and PyPI packages. Tracks CVEs from NVD, advisories from OSV.dev, EPSS exploit probability scores, and CISA KEV data — updated daily.

## What's in here

```
osvault-web/     Next.js frontend — CVE browser, dependency scanner, package pages
ingest-rs/       Rust ingestion service — pulls NVD, OSV, EPSS, KEV into Supabase
github-app/      GitHub App — posts security check runs on PRs touching dependencies
```

## How it works

1. `ingest-rs` runs daily (via CI), fetching the last 24h of CVEs from NVD and OSV advisories for npm + PyPI. Each record is enriched with EPSS scores and CISA KEV membership, then a combined risk score (0–100) is computed and upserted into Supabase.
2. `osvault-web` serves the public site — a CVE detail page, per-package vulnerability history, and a free dependency scanner that accepts `package.json` or `requirements.txt` and returns a security grade + PDF report.
3. `github-app` listens for PR webhooks, diffs dependency files, queries Supabase for matches, and posts a native GitHub Check Run. Private repos get 10 free checks/month.

## Stack

- Frontend: Next.js 16, React 19, Supabase JS client, Upstash Redis (rate limiting)
- Ingest: Rust (tokio, reqwest, serde), Supabase REST API
- GitHub App: Node.js, Express, Octokit
- Database: Supabase (Postgres)

## Local setup

### Prerequisites

- Node.js 20+
- Rust (stable)
- A Supabase project with the schema from `schema.sql` applied

### Web app

```bash
cd osvault-web
cp .env.local.example .env.local   # fill in SUPABASE_URL + SUPABASE_ANON_KEY
npm install
npm run dev
```

### Ingest service

```bash
cd ingest-rs
cp ../.env.example .env            # fill in SUPABASE_URL, SUPABASE_KEY, NVD_API_KEY
cargo run --bin ingest
```

Set `CI=true` to limit the lookback window to 24h (default is 7 days locally).

### GitHub App

See [`github-app/README.md`](github-app/README.md) for full setup instructions.

```bash
cd github-app
cp .env.example .env               # fill in GitHub App credentials + Supabase vars
npm install
npm run build
npm start
```

## Environment variables

| Variable | Used by | Description |
|---|---|---|
| `SUPABASE_URL` | ingest, github-app | Supabase project URL |
| `SUPABASE_KEY` | ingest, github-app | Service role key |
| `NVD_API_KEY` | ingest | Optional — raises NVD rate limit to 50 req/30s |
| `GITHUB_APP_ID` | github-app | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | github-app | PEM private key (newlines as `\n`) |
| `GITHUB_WEBHOOK_SECRET` | github-app | Webhook secret |
| `NEXT_PUBLIC_SUPABASE_URL` | osvault-web | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | osvault-web | Anon/public key |

See `.env.example` and `github-app/.env.example` for full reference.

## Database

Run `schema.sql` in the Supabase SQL editor to create/migrate the `vulnerabilities`, `packages`, `package_vulnerabilities`, and `github_usage` tables.

## Data sources

- [NVD](https://nvd.nist.gov/) — CVE details and CVSS scores
- [OSV.dev](https://osv.dev/) — npm and PyPI advisories
- [FIRST EPSS](https://www.first.org/epss/) — exploit prediction scores
- [CISA KEV](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) — actively exploited vulnerabilities
