# Google Indexing API - Complete Setup Guide

This guide provides everything you need to set up Google Indexing API with multi-account rotation to bypass the 200 URL/day limit.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [API Usage](#api-usage)
5. [Automation](#automation)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### How It Works

- **Standard Limit**: 200 URLs per day per Google Cloud Project
- **Workaround**: Create multiple Google Cloud Projects with service accounts
- **Result**: 10 accounts = 2,000 URLs/day capacity

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your Application (OsVault)                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │  API Endpoint: /api/indexing                      │  │
│  │  - Automatic account rotation                     │  │
│  │  - Quota tracking                                 │  │
│  │  - Batch processing                               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Google Cloud Projects (Multiple)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Project 1   │  │  Project 2   │  │  Project 3   │  │
│  │  200/day     │  │  200/day     │  │  200/day     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Google Search Console                                  │
│  - All service accounts added as "Owner"                │
│  - Single website: osvault.com                          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd osvault-web
npm install googleapis xml2js
npm install -D tsx @types/xml2js
```

### 2. Create Service Accounts

Follow the detailed steps in [scripts/setup-google-indexing.md](scripts/setup-google-indexing.md)

**Summary:**
1. Create 5-10 Google Cloud Projects
2. Enable Indexing API in each project
3. Create service account in each project
4. Download JSON keys
5. Add service accounts as "Owner" in Google Search Console

### 3. Configure Environment

```bash
# Copy example
cp .env.example osvault-web/.env.local

# Add your service accounts
nano osvault-web/.env.local
```

Add your service account JSON (one line per account):
```bash
GOOGLE_SERVICE_ACCOUNT_1='{"type":"service_account",...}'
GOOGLE_SERVICE_ACCOUNT_2='{"type":"service_account",...}'
# ... add more
```

### 4. Test the Setup

```bash
# Start dev server
cd osvault-web
npm run dev

# In another terminal, run tests
./scripts/test-indexing.sh
```

---

## Detailed Setup

See [scripts/setup-google-indexing.md](scripts/setup-google-indexing.md) for:
- Step-by-step Google Cloud setup
- Service account creation
- Search Console configuration
- Environment variable setup
- Troubleshooting common issues

---

## API Usage

### Check Quota Status

```bash
curl http://localhost:3000/api/indexing
```

**Response:**
```json
{
  "totalAccounts": 10,
  "totalCapacity": 2000,
  "totalUsed": 150,
  "totalRemaining": 1850,
  "accounts": [
    {
      "id": "account_1",
      "used": 15,
      "remaining": 185,
      "quota": 200
    }
  ]
}
```

### Index Single or Multiple URLs

```bash
curl -X POST http://localhost:3000/api/indexing \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://osvault.com/cve/CVE-2024-1234",
      "https://osvault.com/cve/CVE-2024-5678"
    ],
    "type": "URL_UPDATED"
  }'
```

### Batch Index with Rate Limiting

```bash
curl -X POST http://localhost:3000/api/indexing/batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["url1", "url2", "..."],
    "batchSize": 50,
    "delayMs": 1000
  }'
```

---

## Automation

### Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `index-all-cves.ts` | Index all CVE pages | `npx tsx scripts/index-all-cves.ts` |
| `index-sitemap.ts` | Index from sitemap | `npx tsx scripts/index-sitemap.ts` |
| `schedule-indexing.ts` | Daily new/updated CVEs | `npx tsx scripts/schedule-indexing.ts` |
| `test-indexing.sh` | Test API endpoints | `./scripts/test-indexing.sh` |

### Manual Cron Setup

```bash
# Edit crontab
crontab -e

# Add daily job at 2 AM
0 2 * * * cd /path/to/osvault && npx tsx scripts/schedule-indexing.ts >> /var/log/indexing.log 2>&1
```

---

## Production Deployment

### Option 1: Vercel Cron Jobs (Recommended)

Already configured in `vercel.json`:

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

**Setup:**
1. Deploy to Vercel
2. Add environment variables in Vercel dashboard
3. Cron runs automatically

### Option 2: GitHub Actions

Already configured in `.github/workflows/indexing.yml`

**Setup:**
1. Add secrets to GitHub repository:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `NEXT_PUBLIC_BASE_URL`
   - `INDEXING_API_URL`
   - `GOOGLE_SERVICE_ACCOUNT_1` through `GOOGLE_SERVICE_ACCOUNT_10`
2. Workflow runs daily at 2 AM UTC
3. Can be triggered manually from Actions tab

### Option 3: Self-Hosted Server

```bash
# Install tsx globally
npm install -g tsx

# Add to crontab
0 2 * * * cd /path/to/osvault && npx tsx scripts/schedule-indexing.ts
```

---

## Troubleshooting

### "No service accounts configured"

**Cause**: Environment variables not loaded

**Fix**:
```bash
# Check if variables are set
echo $GOOGLE_SERVICE_ACCOUNT_1

# Verify JSON format
node -e "console.log(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_1))"
```

### "Permission denied"

**Cause**: Service account not added to Search Console

**Fix**:
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Settings → Users and permissions
4. Add service account email as "Owner"

### "Quota exceeded"

**Cause**: All accounts used their daily quota

**Fix**:
- Wait until next day (resets at midnight PT)
- Add more service accounts
- Check quota: `curl http://localhost:3000/api/indexing`

### "Invalid credentials"

**Cause**: Malformed JSON in environment variable

**Fix**:
```bash
# Ensure JSON is on single line
# Ensure wrapped in single quotes
# No line breaks in the JSON
GOOGLE_SERVICE_ACCOUNT_1='{"type":"service_account",...}'
```

---

## Cost & Limits

### Cost
- ✅ **FREE** - Google Indexing API is completely free
- ✅ No credit card required
- ✅ No billing setup needed

### Limits
- 200 requests per day per Google Cloud Project
- Unlimited number of projects per Google Account
- Quota resets at midnight Pacific Time (PT)
- No rate limiting between requests

---

## Monitoring

### Daily Usage Dashboard

```bash
# Check current status
curl http://localhost:3000/api/indexing | jq

# Watch in real-time
watch -n 60 'curl -s http://localhost:3000/api/indexing | jq'
```

### Logs

```bash
# View cron logs
tail -f /var/log/indexing.log

# View Vercel logs
vercel logs

# View GitHub Actions logs
# Go to Actions tab in GitHub
```

---

## Next Steps

1. ✅ Complete the setup in [scripts/setup-google-indexing.md](scripts/setup-google-indexing.md)
2. ✅ Test with `./scripts/test-indexing.sh`
3. ✅ Run initial indexing: `npx tsx scripts/index-all-cves.ts`
4. ✅ Deploy to production (Vercel/GitHub Actions)
5. ✅ Monitor daily with `/api/indexing` endpoint

---

## Support

- **Setup Guide**: [scripts/setup-google-indexing.md](scripts/setup-google-indexing.md)
- **Scripts README**: [scripts/README.md](scripts/README.md)
- **Google Indexing API Docs**: https://developers.google.com/search/apis/indexing-api/v3/quickstart

---

Built for OsVault - The Next-Generation Vulnerability Intelligence Platform
