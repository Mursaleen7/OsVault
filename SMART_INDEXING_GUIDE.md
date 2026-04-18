# 🤖 Smart Daily Indexing - Complete Guide

## Overview

The smart indexing system automatically indexes your CVE pages to Google with these features:

✅ **Prioritizes latest CVEs first**  
✅ **Checks Google indexing status before submitting**  
✅ **Uses full daily quota (200 URLs per account)**  
✅ **Tracks indexing status in database**  
✅ **Skips already indexed pages**  
✅ **Retries failed pages automatically**  
✅ **Runs daily at 2 AM automatically**

---

## 🚀 Quick Setup

### Step 1: Run Database Migration

Copy and run this SQL in your Supabase SQL Editor:

```sql
-- Add indexing tracking columns to vulnerabilities table
ALTER TABLE vulnerabilities
  ADD COLUMN IF NOT EXISTS google_indexed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_index_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS google_index_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS google_last_attempt_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vuln_index_status ON vulnerabilities (google_index_status);
CREATE INDEX IF NOT EXISTS idx_vuln_indexed_at ON vulnerabilities (google_indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vuln_last_attempt ON vulnerabilities (google_last_attempt_at DESC);
```

Or run the migration file:
```bash
# Copy the SQL from scripts/migration-add-indexing-columns.sql
# Paste into Supabase SQL Editor and run
```

### Step 2: Test the Smart Indexing

```bash
# Run manually to test
npx tsx scripts/smart-daily-indexing.ts
```

### Step 3: Check Statistics

```bash
# View indexing statistics
npx tsx scripts/check-indexing-stats.ts
```

---

## 📊 How It Works

### Priority System

The script indexes CVEs in this order:

1. **New CVEs** (never attempted) - Latest first
2. **Recently modified CVEs** (not indexed yet)
3. **Failed attempts** (retry with exponential backoff)

### Smart Checking

Before submitting each URL:
1. Checks if already indexed in Google
2. Updates database if found indexed
3. Only submits URLs that need indexing
4. Saves quota for new CVEs

### Database Tracking

Each CVE has these tracking fields:

| Field | Type | Description |
|-------|------|-------------|
| `google_indexed_at` | timestamp | When successfully indexed |
| `google_index_status` | text | `pending` \| `indexed` \| `failed` |
| `google_index_attempts` | int | Number of attempts made |
| `google_last_attempt_at` | timestamp | Last attempt time |

---

## 🤖 Automation Options

### Option 1: Vercel Cron (Recommended)

Already configured in `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/smart-indexing",
    "schedule": "0 2 * * *"
  }]
}
```

**Setup:**
1. Deploy to Vercel: `vercel --prod`
2. Add environment variables in Vercel dashboard
3. Cron runs automatically daily at 2 AM

**Test the cron endpoint:**
```bash
curl -X GET https://your-domain.vercel.app/api/cron/smart-indexing \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 2: GitHub Actions

Already configured in `.github/workflows/indexing.yml`:

**Setup:**
1. Add secrets to GitHub repo (Settings → Secrets)
2. Workflow runs daily at 2 AM UTC
3. Can trigger manually from Actions tab

**Required secrets:**
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `INDEXING_API_URL`
- `GOOGLE_SERVICE_ACCOUNT_1` through `GOOGLE_SERVICE_ACCOUNT_10`

### Option 3: Self-Hosted Cron

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /path/to/OsVault && npx tsx scripts/smart-daily-indexing.ts >> /var/log/smart-indexing.log 2>&1
```

---

## 📈 Monitoring

### Check Statistics

```bash
npx tsx scripts/check-indexing-stats.ts
```

**Output:**
```
📊 DATABASE STATISTICS

   Total CVEs:           5,234
   ✅ Indexed:           4,890 (93.4%)
   ⏳ Pending:           300 (5.7%)
   ❌ Failed:            44 (0.8%)

📈 QUOTA STATUS

   Total Accounts:       1
   Daily Capacity:       200 URLs
   Used Today:           150
   Remaining Today:      50

🕐 RECENTLY INDEXED (Last 5)

   1. CVE-2024-1234 - 5 minutes ago
   2. CVE-2024-5678 - 10 minutes ago
   ...

⏱️  ESTIMATED COMPLETION

   Days to index all:    2 days
   At current capacity:  200 URLs/day
```

### View in Database

```sql
-- Check indexing status
SELECT 
  google_index_status,
  COUNT(*) as count
FROM vulnerabilities
GROUP BY google_index_status;

-- Recently indexed CVEs
SELECT 
  cve_id,
  google_indexed_at,
  google_index_attempts
FROM vulnerabilities
WHERE google_index_status = 'indexed'
ORDER BY google_indexed_at DESC
LIMIT 10;

-- Failed attempts
SELECT 
  cve_id,
  google_index_attempts,
  google_last_attempt_at
FROM vulnerabilities
WHERE google_index_status = 'failed'
ORDER BY google_index_attempts DESC;
```

---

## 🎯 Usage Examples

### Manual Run

```bash
# Run the smart indexing script
npx tsx scripts/smart-daily-indexing.ts
```

**Output:**
```
╔════════════════════════════════════════════════════════════════════════════╗
║  Smart Daily Indexing - Google Indexing API                               ║
╚════════════════════════════════════════════════════════════════════════════╝

⏰ Started at: 2024-01-15T02:00:00.000Z

📊 Available quota today: 200 URLs

📋 Fetching CVEs to index (limit: 200)...

📝 Found 200 CVEs to index
   - New (never attempted): 180
   - Retries: 20

🔍 Checking Google indexing status...
   ✅ Already indexed: 15 CVEs
   📤 Need to submit: 185 CVEs

📤 Submitting 185 URLs to Google...

═══════════════════════════════════════════════════════════════════════════
  INDEXING RESULTS
═══════════════════════════════════════════════════════════════════════════
  ✅ Successfully indexed: 185
  ❌ Failed: 0
  📊 Already indexed: 15
  📈 Total processed: 200
═══════════════════════════════════════════════════════════════════════════

💾 Updating database...

📊 Remaining quota: 15/200

✅ Smart daily indexing complete!
⏰ Finished at: 2024-01-15T02:05:23.456Z
```

### Check Statistics

```bash
npx tsx scripts/check-indexing-stats.ts
```

### Force Re-index Failed CVEs

```sql
-- Reset failed CVEs to pending
UPDATE vulnerabilities
SET google_index_status = 'pending'
WHERE google_index_status = 'failed';
```

Then run the script again.

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
NEXT_PUBLIC_BASE_URL=https://os-vault-kappa.vercel.app

# Service accounts (add as many as needed)
GOOGLE_SERVICE_ACCOUNT_1='{"type":"service_account",...}'
GOOGLE_SERVICE_ACCOUNT_2='{"type":"service_account",...}'

# Optional
INDEXING_API_URL=http://localhost:3000  # For local testing
```

### Adjust Batch Size

Edit `scripts/smart-daily-indexing.ts`:

```typescript
// Change the limit multiplier
const { data, error } = await supabase
  .from('vulnerabilities')
  .select('...')
  .limit(limit * 2); // Increase to fetch more candidates
```

### Change Priority Logic

Edit the sorting logic in `scripts/smart-daily-indexing.ts`:

```typescript
const sorted = data.sort((a, b) => {
  // Customize priority here
  // Example: Prioritize high severity
  if (a.cvss_severity === 'CRITICAL' && b.cvss_severity !== 'CRITICAL') return -1;
  if (b.cvss_severity === 'CRITICAL' && a.cvss_severity !== 'CRITICAL') return 1;
  
  // Then by date
  return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
});
```

---

## 📊 Performance

### Typical Run Times

- **Checking 200 CVEs**: ~30 seconds
- **Submitting 200 URLs**: ~2 minutes
- **Database updates**: ~10 seconds
- **Total**: ~3-4 minutes per run

### Optimization Tips

1. **Add more service accounts** to increase daily capacity
2. **Run during off-peak hours** (2 AM is optimal)
3. **Monitor failed attempts** and investigate patterns
4. **Use database indexes** for faster queries

---

## 🆘 Troubleshooting

### "No quota available"

**Cause**: All service accounts used their daily quota

**Solution:**
- Add more service accounts
- Wait until tomorrow (resets at midnight PT)
- Check quota: `curl http://localhost:3000/api/indexing`

### "All CVEs are already indexed"

**Cause**: Everything is indexed!

**Solution:**
- This is success! 🎉
- Script will automatically index new CVEs as they're added
- Check stats: `npx tsx scripts/check-indexing-stats.ts`

### High failure rate

**Cause**: Permission issues or invalid URLs

**Solution:**
1. Verify service account is Owner in Search Console
2. Check that URLs are accessible
3. Review error messages in output
4. Check failed CVEs:
   ```sql
   SELECT cve_id, google_index_attempts
   FROM vulnerabilities
   WHERE google_index_status = 'failed'
   ORDER BY google_index_attempts DESC;
   ```

### Script hangs on status checking

**Cause**: Rate limiting from Google API

**Solution:**
- Increase delay between checks (currently 100ms)
- Edit `scripts/smart-daily-indexing.ts`:
  ```typescript
  await new Promise(resolve => setTimeout(resolve, 200)); // Increase to 200ms
  ```

---

## 📈 Scaling

### Add More Service Accounts

To index more than 200 URLs/day:

1. Create more Google Cloud Projects
2. Add service accounts to `.env.local`:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_2='...'
   GOOGLE_SERVICE_ACCOUNT_3='...'
   ```
3. Add each to Search Console as Owner
4. Restart the application

**Capacity:**
- 1 account = 200 URLs/day
- 5 accounts = 1,000 URLs/day
- 10 accounts = 2,000 URLs/day
- 20 accounts = 4,000 URLs/day

### Multiple Daily Runs

Run the script multiple times per day:

```bash
# Crontab example (every 6 hours)
0 */6 * * * cd /path/to/OsVault && npx tsx scripts/smart-daily-indexing.ts
```

---

## 🎉 Success Metrics

You'll know it's working when:

1. ✅ Statistics show increasing "Indexed" count
2. ✅ "Pending" count decreases daily
3. ✅ CVEs appear in Google Search within 24-48 hours
4. ✅ No errors in the output
5. ✅ Quota is being used efficiently

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `scripts/smart-daily-indexing.ts` | Main smart indexing script |
| `scripts/check-indexing-stats.ts` | Statistics viewer |
| `scripts/migration-add-indexing-columns.sql` | Database migration |
| `osvault-web/src/app/api/cron/smart-indexing/route.ts` | Vercel cron endpoint |
| `.github/workflows/indexing.yml` | GitHub Actions workflow |

---

Built for OsVault 🚀
