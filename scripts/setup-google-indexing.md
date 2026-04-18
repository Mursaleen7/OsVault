# Google Indexing API Setup Guide

This guide walks you through setting up multiple Google Cloud Projects with Service Accounts to bypass the 200 URL/day quota limit.

## Architecture Overview

- **Quota**: 200 URLs per day per Google Cloud Project
- **Workaround**: Create multiple projects with multiple service accounts
- **Example**: 10 service accounts = 2,000 URLs/day capacity

## Step-by-Step Setup

### 1. Create Google Cloud Projects

For each service account you want (recommended: 5-10 accounts):

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown → **New Project**
3. Name it: `osvault-indexing-1`, `osvault-indexing-2`, etc.
4. Click **Create**

### 2. Enable the Indexing API

For each project:

1. Select the project from the dropdown
2. Go to **APIs & Services** → **Library**
3. Search for "**Indexing API**"
4. Click **Enable**

### 3. Create Service Accounts

For each project:

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Name: `osvault-indexing-sa-1`
4. Click **Create and Continue**
5. Skip the optional steps → **Done**

### 4. Generate JSON Keys

For each service account:

1. Click on the service account email
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Click **Create** (downloads the JSON file)
6. Save as `service-account-1.json`, `service-account-2.json`, etc.

### 5. Grant Search Console Access

For each service account:

1. Open the downloaded JSON file
2. Copy the `client_email` value (looks like: `osvault-indexing-sa-1@project-id.iam.gserviceaccount.com`)
3. Go to [Google Search Console](https://search.google.com/search-console)
4. Select your property (osvault.com)
5. Click **Settings** (left sidebar)
6. Click **Users and permissions**
7. Click **Add user**
8. Paste the service account email
9. Set permission to **Owner**
10. Click **Add**

Repeat for all service accounts.

### 6. Configure Environment Variables

Add the service account credentials to your `.env.local`:

```bash
# Service Account 1
GOOGLE_SERVICE_ACCOUNT_1='{"type":"service_account","project_id":"osvault-indexing-1","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"osvault-indexing-sa-1@osvault-indexing-1.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# Service Account 2
GOOGLE_SERVICE_ACCOUNT_2='{"type":"service_account",...}'

# Service Account 3
GOOGLE_SERVICE_ACCOUNT_3='{"type":"service_account",...}'

# Add more as needed (up to 10 recommended)
```

**Important**: The entire JSON content must be on a single line and wrapped in single quotes.

### 7. Install Dependencies

```bash
cd osvault-web
npm install googleapis
```

### 8. Test the Setup

```bash
# Check status
curl http://localhost:3000/api/indexing

# Index a single URL
curl -X POST http://localhost:3000/api/indexing \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://osvault.com/cve/CVE-2024-1234"]}'

# Batch index multiple URLs
curl -X POST http://localhost:3000/api/indexing/batch \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://osvault.com/cve/CVE-2024-1234", "https://osvault.com/cve/CVE-2024-5678"]}'
```

## API Endpoints

### GET /api/indexing
Check quota status for all service accounts.

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

### POST /api/indexing
Index URLs with automatic account rotation.

**Request:**
```json
{
  "urls": ["https://osvault.com/page1", "https://osvault.com/page2"],
  "type": "URL_UPDATED"
}
```

**Response:**
```json
{
  "success": true,
  "indexed": 2,
  "failed": 0,
  "results": [
    {
      "url": "https://osvault.com/page1",
      "success": true,
      "accountUsed": "account_1"
    }
  ],
  "errors": [],
  "totalCapacity": 2000,
  "remainingToday": 1998
}
```

### POST /api/indexing/batch
Index large batches with rate limiting.

**Request:**
```json
{
  "urls": ["url1", "url2", "..."],
  "batchSize": 50,
  "delayMs": 1000
}
```

## Automation Scripts

See the `scripts/` directory for automation tools:
- `index-all-cves.ts` - Index all CVE pages
- `index-sitemap.ts` - Index from sitemap
- `schedule-indexing.ts` - Daily cron job

## Production Considerations

### 1. Persistent Usage Tracking
The current implementation uses in-memory tracking. For production:
- Use Redis for distributed tracking
- Or use a database table to persist usage counts
- Reset counts daily at midnight UTC

### 2. Rate Limiting
- Add rate limiting per IP to prevent abuse
- Implement authentication for the API endpoints
- Consider using API keys for access control

### 3. Error Handling
- Implement retry logic for failed requests
- Log all indexing attempts to a database
- Set up monitoring and alerts

### 4. Scaling
- Deploy as a separate microservice
- Use a queue system (Bull, BullMQ) for background processing
- Implement webhook callbacks for completion notifications

## Troubleshooting

### "Service account not found"
- Verify the JSON is properly formatted in `.env.local`
- Check that the service account email is correct
- Ensure the service account has Owner access in Search Console

### "Quota exceeded"
- Check `/api/indexing` to see usage status
- Add more service accounts
- Wait until the next day for quota reset

### "Permission denied"
- Verify the service account has Owner role in Search Console
- Check that the Indexing API is enabled in the Google Cloud Project
- Ensure the private key is valid and not expired

## Cost
- Google Indexing API is **free**
- Google Cloud Projects are **free** (no billing required for this API)
- No credit card needed for basic usage

## Limits
- 200 requests per day per project
- No limit on number of projects per Google Account
- Requests reset at midnight Pacific Time (PT)
