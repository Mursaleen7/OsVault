# 🚀 Quick Start - Get Automation Working in 5 Minutes

## Current Situation

✅ **Your scripts work perfectly!** You've already indexed 197 URLs today.  
⚠️ **Vercel deployment is having issues** - Let's use GitHub Actions instead.

---

## ✅ FASTEST SOLUTION: GitHub Actions

Your scripts already work locally. Let's just run them on GitHub's servers automatically every day.

### Step 1: Push to GitHub (2 minutes)

```bash
cd /Users/mursaleensakoskar/Desktop/OsVault

# Add all files
git add .

# Commit
git commit -m "Add automated daily indexing"

# Push (replace YOUR_USERNAME with your GitHub username)
git push origin main
```

If you don't have a GitHub repository yet:

```bash
# Create new repo on GitHub first, then:
git init
git add .
git commit -m "Initial commit with automated indexing"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/OsVault.git
git push -u origin main
```

---

### Step 2: Add Secrets to GitHub (3 minutes)

1. **Go to your GitHub repository**
2. **Click:** Settings → Secrets and variables → Actions
3. **Click:** "New repository secret"
4. **Add these 5 secrets:**

#### Secret 1: SUPABASE_URL
```
https://elsqklexagjovwxseyba.supabase.co
```

#### Secret 2: SUPABASE_KEY
Open your `.env.local` file and copy the value of `SUPABASE_KEY`

#### Secret 3: NEXT_PUBLIC_BASE_URL
```
https://os-vault-kappa.vercel.app
```

#### Secret 4: INDEXING_API_URL
```
https://os-vault-kappa.vercel.app
```

#### Secret 5: GOOGLE_SERVICE_ACCOUNT_1
Open your `.env.local` file and copy the entire JSON value of `GOOGLE_SERVICE_ACCOUNT_1`

**Important:** Make sure it's on a single line (no line breaks)

---

### Step 3: Test It! (30 seconds)

1. **Go to:** https://github.com/YOUR_USERNAME/OsVault/actions
2. **Click:** "Daily Google Indexing" workflow
3. **Click:** "Run workflow" button (top right)
4. **Select:** main branch
5. **Click:** "Run workflow"

Watch it run! It should:
- ✅ Install dependencies
- ✅ Run your script
- ✅ Index CVEs
- ✅ Update database
- ✅ Complete in ~2 minutes

---

## 🎉 Done!

Your automation is now set up! It will run automatically every day at 2 AM UTC.

### What Happens Next:

**Tomorrow at 2 AM UTC:**
- GitHub Actions triggers automatically
- Runs your `smart-daily-indexing.ts` script
- Indexes 200 CVEs
- Updates database
- Repeats daily

**Progress:**
- Day 1: 200 CVEs (0.5%)
- Week 1: 1,400 CVEs (3.5%)
- Month 1: 6,000 CVEs (15%)
- ~200 days: All 39,877 CVEs (100%)

---

## 📊 Monitor Progress

### Check GitHub Actions:
https://github.com/YOUR_USERNAME/OsVault/actions

### Check Indexing Stats:
```bash
cd osvault-web
npx tsx check-indexing-stats.ts
```

### Check Google Search Console:
https://search.google.com/search-console

**Note:** Google takes 24-48 hours to show indexed pages in Search Console.

---

## 🔧 Troubleshooting

### "Secret not found" error
- Make sure you added all 5 secrets to GitHub
- Check spelling matches exactly (case-sensitive)

### "Module not found" error
- The workflow installs dependencies automatically
- Check the workflow file is correct

### "Quota exceeded" error
- This is normal! You used 197 URLs today
- Wait until tomorrow (quota resets at midnight PT)

---

## 🎯 Alternative: Manual Cron (If You Don't Want GitHub)

If you prefer to run it on your Mac instead:

```bash
# Edit crontab
crontab -e

# Add this line (press 'i' to insert, then paste):
0 2 * * * cd /Users/mursaleensakoskar/Desktop/OsVault/osvault-web && npx tsx smart-daily-indexing.ts >> /tmp/indexing.log 2>&1

# Save and exit (press ESC, then type :wq and press ENTER)

# Verify it's added
crontab -l
```

**Note:** Your Mac must be on and awake at 2 AM for this to work.

---

## ✅ Success Checklist

- [ ] Push code to GitHub
- [ ] Add 5 secrets to GitHub repository
- [ ] Test workflow manually
- [ ] Verify it completes successfully
- [ ] Check stats tomorrow to confirm it ran

---

## 📝 Quick Commands

```bash
# Check stats
cd osvault-web && npx tsx check-indexing-stats.ts

# Run manually (for testing)
cd osvault-web && npx tsx smart-daily-indexing.ts

# View GitHub Actions
# Go to: https://github.com/YOUR_USERNAME/OsVault/actions
```

---

## 🎉 You're All Set!

Your automation is ready. Just push to GitHub, add the secrets, and test it!

**Next command:**
```bash
cd /Users/mursaleensakoskar/Desktop/OsVault
git add .
git commit -m "Add automated daily indexing"
git push origin main
```

Then add the 5 secrets and you're done! 🚀

---

Built for OsVault 🚀

**Questions? Everything is working locally, so GitHub Actions will work too!**
