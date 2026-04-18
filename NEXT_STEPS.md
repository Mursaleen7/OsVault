# ✅ Setup Complete - Next Steps

## Current Status

✅ Dependencies installed (googleapis, xml2js, tsx)  
✅ Environment configured (.env.local created)  
✅ Service account loaded (1 account = 200 URLs/day)  
✅ API endpoints working  
✅ Dev server running at http://localhost:3000  

## 🚨 IMPORTANT: Add Service Account to Google Search Console

Your service account email is:
```
osvault-indexing-sa-1@osvault-indexing-1.iam.gserviceaccount.com
```

### Steps to Complete Setup:

1. **Go to Google Search Console**
   - Visit: https://search.google.com/search-console
   - Select your property: **osvault.com**

2. **Add Service Account as Owner**
   - Click **Settings** (left sidebar)
   - Click **Users and permissions**
   - Click **Add user** button
   - Paste this email: `osvault-indexing-sa-1@osvault-indexing-1.iam.gserviceaccount.com`
   - Set permission to: **Owner**
   - Click **Add**

3. **Wait 1-2 minutes** for permissions to propagate

4. **Test the integration**
   ```bash
   # Test indexing a real CVE URL
   curl -X POST http://localhost:3000/api/indexing \
     -H "Content-Type: application/json" \
     -d '{"urls": ["https://osvault.com"]}'
   ```

## 📊 Test Your Setup

Once you've added the service account to Search Console, run:

```bash
# Check quota status
curl http://localhost:3000/api/indexing | python3 -m json.tool

# Test indexing
./scripts/test-indexing.sh
```

## 🚀 Scale Up (Optional)

To increase capacity beyond 200 URLs/day:

1. Create more Google Cloud Projects (follow steps 1-4 in `scripts/setup-google-indexing.md`)
2. Add each service account JSON to `.env.local`:
   ```bash
   GOOGLE_SERVICE_ACCOUNT_2='{"type":"service_account",...}'
   GOOGLE_SERVICE_ACCOUNT_3='{"type":"service_account",...}'
   # etc.
   ```
3. Add each service account email as Owner in Search Console
4. Restart dev server: `npm run dev`

**Capacity calculation:**
- 1 account = 200 URLs/day
- 5 accounts = 1,000 URLs/day
- 10 accounts = 2,000 URLs/day

## 📝 Available Commands

```bash
# Check quota status
curl http://localhost:3000/api/indexing

# Index all CVE pages
npx tsx scripts/index-all-cves.ts

# Index from sitemap
npx tsx scripts/index-sitemap.ts

# Daily indexing (new/updated CVEs)
npx tsx scripts/schedule-indexing.ts

# Run all tests
./scripts/test-indexing.sh
```

## 🔄 Automation Options

### Option 1: Vercel Cron (Recommended)
Already configured in `vercel.json`. Just deploy to Vercel and add environment variables.

### Option 2: GitHub Actions
Already configured in `.github/workflows/indexing.yml`. Add secrets to your GitHub repo.

### Option 3: Manual Cron
```bash
# Add to crontab (runs daily at 2 AM)
crontab -e
0 2 * * * cd /path/to/OsVault && npx tsx scripts/schedule-indexing.ts
```

## 📚 Documentation

- **Main Setup Guide**: `INDEXING_SETUP.md`
- **Detailed Google Cloud Setup**: `scripts/setup-google-indexing.md`
- **Scripts Documentation**: `scripts/README.md`

## ⚠️ Current Error Explained

The "Permission denied" error you saw is **expected** until you add the service account to Google Search Console. Once added, indexing will work perfectly.

## 🎯 What Happens Next

After adding the service account to Search Console:
1. Google will verify ownership
2. Your API can submit URLs for indexing
3. Google will crawl and index your pages faster
4. You can monitor progress in Search Console

---

**Need help?** Check `scripts/setup-google-indexing.md` for troubleshooting.
