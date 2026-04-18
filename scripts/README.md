# Google Indexing API Scripts

Automation scripts for managing Google Indexing API with multi-account rotation.

## Quick Start

1. Follow the setup guide: `setup-google-indexing.md`
2. Configure your service accounts in `.env.local`
3. Run the scripts below

## Available Scripts

### 1. Check Quota Status
```bash
curl http://localhost:3000/api/indexing
```

### 2. Index All CVE Pages
```bash
npx tsx scripts/index-all-cves.ts
```
Indexes all CVE pages from your database.

### 3. Index from Sitemap
```bash
npx tsx scripts/index-sitemap.ts
```
Fetches and indexes all URLs from your sitemap.xml.

### 4. Daily Scheduled Indexing
```bash
npx tsx scripts/schedule-indexing.ts
```
Indexes new and updated CVEs from the last 24 hours.

**Setup as cron job:**
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /path/to/osvault && npx tsx scripts/schedule-indexing.ts >> /var/log/indexing.log 2>&1
```

### 5. Convert Service Account JSON to ENV
```bash
./scripts/convert-json-to-env.sh service-account-*.json >> .env.local
```
Converts downloaded JSON files to environment variables.

## Environment Variables

```bash
# Required for scripts
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
NEXT_PUBLIC_BASE_URL=https://osvault.com
INDEXING_API_URL=http://localhost:3000

# Service accounts (add as many as needed)
GOOGLE_SERVICE_ACCOUNT_1='{"type":"service_account",...}'
GOOGLE_SERVICE_ACCOUNT_2='{"type":"service_account",...}'
GOOGLE_SERVICE_ACCOUNT_3='{"type":"service_account",...}'
```

## Production Deployment

### Option 1: Vercel Cron Jobs
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/indexing",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Option 2: GitHub Actions
Create `.github/workflows/indexing.yml`:
```yaml
name: Daily Indexing
on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npx tsx scripts/schedule-indexing.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          INDEXING_API_URL: ${{ secrets.INDEXING_API_URL }}
```

### Option 3: Self-hosted Cron
```bash
# Install dependencies
npm install -g tsx

# Add to crontab
0 2 * * * cd /path/to/osvault && npx tsx scripts/schedule-indexing.ts
```

## Monitoring

### Check Daily Usage
```bash
curl http://localhost:3000/api/indexing | jq
```

### View Logs
```bash
tail -f /var/log/indexing.log
```

## Troubleshooting

See `setup-google-indexing.md` for detailed troubleshooting steps.
