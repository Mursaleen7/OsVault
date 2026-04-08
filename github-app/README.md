# OsVault GitHub App

Posts a native GitHub Check on every PR that touches `package.json` or `requirements.txt`.
Fails the check if CRITICAL or CISA KEV vulnerabilities are detected.

## Setup

### 1. Create the GitHub App

Go to https://github.com/settings/apps/new and set:

- **Webhook URL**: `https://your-service.railway.app/webhook`
- **Webhook secret**: any random string (set as `GITHUB_WEBHOOK_SECRET`)
- **Permissions**:
  - Pull requests: Read
  - Checks: Read & Write
  - Contents: Read
- **Subscribe to events**: Pull request

Download the private key and note the App ID.

### 2. Run the DB migration

In Supabase SQL editor, run the `github_usage` table block from `schema.sql`.

### 3. Deploy to Railway / Render

```bash
cd github-app
npm install
npm run build
npm start
```

Set env vars from `.env.example`.

### 4. Install the App

From your GitHub App page → Install App → select repos.

## Monetization

- Public repos: unlimited checks
- Private repos: 10 free checks/month, then a paywall link appears in the PR
- Upgrade page: `/upgrade` on your web app (not yet built — wire up Stripe there)
