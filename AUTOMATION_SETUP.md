# 🤖 Automation Setup Guide

## Current Status

✅ **Configuration Complete** - All files are ready  
⚠️ **Deployment Pending** - You need to choose and deploy one method

---

## Option 1: Vercel Cron (Easiest - Recommended)

### Why Vercel?
- ✅ Easiest to set up
- ✅ No server management
- ✅ Automatic scaling
- ✅ Built-in monitoring
- ✅ Free tier available

### Setup Steps

**1. Deploy to Vercel**

```bash
cd osvault-web

# Install Vercel CLI (if not already installed)
npm install -g vercel

# Deploy
vercel --prod
```

**2. Add Environment Variables**

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

Add these variables:

```
SUPABASE_URL=https://elsqklexagjovwxseyba.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_BASE_URL=https://os-vault-kappa.vercel.app
GOOGLE_SERVICE_ACCOUNT_1={"type":"service_account",...}
CRON_SECRET=<generate-random-string>
```

**3. Generate CRON_SECRET**

```bash
# Generate a random secret
openssl rand -base64 32
```

**4. Verify Cron Job**

Go to: https://vercel.com/dashboard → Your Project → Cron Jobs

You should see:
- Path: `/api/cron/smart-indexing`
- Schedule: `0 2 * * *` (daily at 2 AM)
- Status: Active

**5. Test It**

```bash
# Trigger manually
curl -X GET https://your-domain.vercel.app/api/cron/smart-indexing \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### ✅ Done!

The cron job will run automatically every day at 2 AM.

---

## Option 2: GitHub Actions

### Why GitHub Actions?
- ✅ Free for public repos
- ✅ Runs on GitHub's infrastructure
- ✅ Easy to monitor
- ✅ Version controlled

### Setup Steps

**1. Add Secrets to GitHub**

Go to: https://github.com/YOUR_USERNAME/OsVault/settings/secrets/actions

Click **New repository secret** and add:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://elsqklexagjovwxseyba.supabase.co` |
| `SUPABASE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `NEXT_PUBLIC_BASE_URL` | `https://os-vault-kappa.vercel.app` |
| `INDEXING_API_URL` | `https://os-vault-kappa.vercel.app` |
| `GOOGLE_SERVICE_ACCOUNT_1` | `{"type":"service_account",...}` |

**2. Push to GitHub**

```bash
git add .
git commit -m "Add smart daily indexing automation"
git push origin main
```

**3. Verify Workflow**

Go to: https://github.com/YOUR_USERNAME/OsVault/actions

You should see:
- Workflow: "Daily Google Indexing"
- Schedule: Daily at 2 AM UTC
- Status: Active

**4. Test It**

Go to: Actions → Daily Google Indexing → Run workflow

Click **Run workflow** to test manually.

### ✅ Done!

The workflow will run automatically every day at 2 AM UTC.

---

## Option 3: Manual Cron Job (Self-Hosted)

### Why Manual Cron?
- ✅ Full control
- ✅ No external dependencies
- ✅ Runs on your server

### Setup Steps

**1. Edit Crontab**

```bash
crontab -e
```

**2. Add Cron Job**

```bash
# Run daily at 2 AM
0 2 * * * cd /Users/mursaleensakoskar/Desktop/OsVault/osvault-web && npx tsx smart-daily-indexing.ts >> /var/log/indexing.log 2>&1
```

**3. Verify Cron Job**

```bash
# List cron jobs
crontab -l

# Check logs
tail -f /var/log/indexing.log
```

### ✅ Done!

The cron job will run automatically every day at 2 AM.

---

## Comparison

| Feature | Vercel Cron | GitHub Actions | Manual Cron |
|---------|-------------|----------------|-------------|
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Cost** | Free tier | Free (public) | Free |
| **Monitoring** | Built-in | GitHub UI | Manual |
| **Reliability** | Very High | High | Depends on server |
| **Maintenance** | None | None | Manual |
| **Recommended** | ✅ Yes | ✅ Yes | For advanced users |

---

## Monitoring

### Check if Automation is Working

**Vercel:**
```bash
# Check logs
vercel logs --follow
```

**GitHub Actions:**
- Go to: Repository → Actions → Latest run
- Check logs and status

**Manual Cron:**
```bash
# Check logs
tail -f /var/log/indexing.log

# Check if cron is running
ps aux | grep cron
```

### Daily Verification

Run this command to check progress:

```bash
cd osvault-web && npx tsx check-indexing-stats.ts
```

You should see:
- "Indexed" count increasing daily
- "Pending" count decreasing daily
- "Used Today" showing ~200 URLs

---

## Troubleshooting

### Vercel Cron Not Running

**Check:**
1. Cron job is enabled in Vercel dashboard
2. Environment variables are set correctly
3. CRON_SECRET matches in both places
4. Check Vercel logs for errors

### GitHub Actions Not Running

**Check:**
1. Workflow file is in `.github/workflows/`
2. Secrets are added to repository
3. Repository has Actions enabled
4. Check Actions tab for errors

### Manual Cron Not Running

**Check:**
1. Cron service is running: `sudo service cron status`
2. Crontab syntax is correct: `crontab -l`
3. Script has execute permissions
4. Check logs: `tail -f /var/log/indexing.log`

---

## Next Steps

1. **Choose one method** (Vercel recommended)
2. **Follow the setup steps** above
3. **Test it** manually first
4. **Monitor** for the first few days
5. **Check stats** daily to verify it's working

---

## Quick Commands

```bash
# Check statistics
cd osvault-web && npx tsx check-indexing-stats.ts

# Run manually (for testing)
cd osvault-web && npx tsx smart-daily-indexing.ts

# Quick index (skip status checking)
cd osvault-web && npx tsx quick-index.ts 200
```

---

## Expected Behavior

### Tomorrow (Day 2):
- **12:00 AM PT** - Quota resets to 200 URLs
- **2:00 AM** - Automation runs
- **2:05 AM** - 200 CVEs indexed
- **2:06 AM** - Database updated

### Daily:
- Indexes 200 latest unindexed CVEs
- Updates database with status
- Skips already-indexed pages
- Retries failed attempts

### After 200 Days:
- All 39,877 CVEs indexed
- New CVEs indexed automatically
- System maintains itself

---

## 🎯 Recommendation

**Use Vercel Cron** - It's the easiest and most reliable option:

```bash
cd osvault-web
vercel --prod
```

Then add environment variables in Vercel dashboard.

**Done! Your automation is set up and will run daily at 2 AM.**

---

Built for OsVault 🚀
