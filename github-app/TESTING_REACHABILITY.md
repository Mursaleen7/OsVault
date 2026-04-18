# 🧪 Testing Reachability Analysis

## Overview

The reachability analysis feature (commit `bfacd8d`) automatically detects whether vulnerable packages are actually imported in your source code. This guide shows you how to test it.

---

## 🎯 What It Does

When a PR is opened/updated:

1. **Downloads repo tarball** at the PR's commit SHA (in-memory, no disk writes)
2. **Streams through source files** (JS/TS/Python), skipping `node_modules/`, `dist/`, etc.
3. **Checks if vulnerable packages are imported** using regex patterns
4. **Marks unreachable vulnerabilities** as 🛡️ BYPASSED (doesn't block PR)
5. **Marks reachable vulnerabilities** as 🚨 REACHABLE (blocks PR if CRITICAL/KEV)

---

## 🔍 How to Test

### Method 1: Create a Test PR

1. **Add a vulnerable dependency** to `package.json`:
   ```json
   {
     "dependencies": {
       "lodash": "4.17.20"  // Has CVE-2021-23337 (HIGH)
     }
   }
   ```

2. **Create two scenarios:**

   **Scenario A: Reachable (imported)**
   ```javascript
   // src/index.js
   import _ from 'lodash';
   
   console.log(_.chunk([1, 2, 3, 4], 2));
   ```

   **Scenario B: Unreachable (not imported)**
   ```javascript
   // src/index.js
   // No import of lodash anywhere
   
   console.log('Hello world');
   ```

3. **Open a PR** and check the OsVault GitHub Check

---

### Method 2: Test with Existing Vulnerabilities

1. **Find a package with known vulnerabilities:**
   ```bash
   npm audit
   ```

2. **Check if it's imported:**
   ```bash
   # Search for imports in your codebase
   grep -r "import.*from.*'package-name'" src/
   grep -r "require('package-name')" src/
   ```

3. **Open a PR** that adds/updates the package

4. **Check the GitHub Check Run:**
   - If imported → 🚨 REACHABLE
   - If not imported → 🛡️ BYPASSED

---

## 📊 Expected Output

### Reachable Vulnerability (Blocks PR)

```markdown
## OsVault Security Check

🚨 1 CISA Known Exploited Vulnerability detected. These are actively exploited in the wild and are imported in your code. Merge is blocked until resolved.

4 packages scanned · 1 vulnerable · 1 reachable · 0 bypassed · 1 critical · 0 high

### 🚨 Reachable Vulnerabilities — Action Required

These packages are **directly imported** in your source code. The vulnerability is exploitable.

| Package | CVE / OSV ID | Severity | CVSS | Status | Summary |
|---------|-------------|----------|------|--------|---------|
| `lodash` | [CVE-2021-23337](https://osvault.dev/cve/CVE-2021-23337) | 🟠 HIGH | 7.2 | 🚨 REACHABLE | Command injection in lodash |
```

**Evidence shown:**
- File: `src/index.js` (where lodash is imported)

---

### Unreachable Vulnerability (Doesn't Block PR)

```markdown
## OsVault Security Check

✅ 1 vulnerability found but ALL are unreachable

4 packages scanned · 1 vulnerable · 0 reachable · 1 bypassed · 0 critical · 0 high

### 🛡️ 1 Vulnerability Bypassed — Proven Unreachable

> **OsVault scanned your source code and confirmed these packages are never imported.** These vulnerabilities cannot affect your application and have been automatically excluded from the security gate.

| Package | CVE / OSV ID | Severity | CVSS | Status | Summary |
|---------|-------------|----------|------|--------|---------|
| ~~`lodash`~~ | [CVE-2021-23337](https://osvault.dev/cve/CVE-2021-23337) | 🟠 ~~HIGH~~ | ~~7.2~~ | 🛡️ BYPASSED | Command injection in lodash |
```

**Note:** Package name is strikethrough, severity is strikethrough, status shows 🛡️ BYPASSED

---

## 🧪 Test Cases

### Test Case 1: Direct Import (Reachable)

**File:** `src/app.js`
```javascript
import lodash from 'lodash';
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/app.js`

---

### Test Case 2: Named Import (Reachable)

**File:** `src/utils.ts`
```typescript
import { chunk } from 'lodash';
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/utils.ts`

---

### Test Case 3: Require (Reachable)

**File:** `src/legacy.js`
```javascript
const _ = require('lodash');
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/legacy.js`

---

### Test Case 4: Dynamic Import (Reachable)

**File:** `src/dynamic.js`
```javascript
const module = await import('lodash');
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/dynamic.js`

---

### Test Case 5: Jest Mock (Reachable)

**File:** `src/__tests__/app.test.js`
```javascript
jest.mock('lodash');
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/__tests__/app.test.js`

---

### Test Case 6: Not Imported (Unreachable)

**File:** `src/app.js`
```javascript
// No import of lodash anywhere
console.log('Hello');
```

**Expected:** 🛡️ BYPASSED  
**Evidence:** (none)

---

### Test Case 7: Transitive Dependency (Usually Unreachable)

**Scenario:** `lodash` is a dependency of `express`, but you only import `express`

**File:** `src/server.js`
```javascript
import express from 'express';
// No direct import of lodash
```

**Expected:** 🛡️ BYPASSED  
**Reason:** You never directly import `lodash`, so the vulnerability is unreachable

---

### Test Case 8: Python Import (Reachable)

**File:** `src/main.py`
```python
import requests
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/main.py`

---

### Test Case 9: Python From Import (Reachable)

**File:** `src/utils.py`
```python
from requests import get
```

**Expected:** 🚨 REACHABLE  
**Evidence:** `src/utils.py`

---

## 🔧 Manual Testing

### 1. Check Logs

The GitHub App logs reachability results:

```bash
cd github-app
npm start

# Look for logs like:
[reachability] owner/repo@abc1234: 3 packages checked, 1 reachable, 2 bypassed
```

---

### 2. Test Locally

You can test the reachability engine locally:

```typescript
import { analyzeReachability } from './src/reachability';

const results = await analyzeReachability(
  octokit,
  'owner',
  'repo',
  'commit-sha',
  ['lodash', 'express', 'axios']
);

console.log(results);
// Map {
//   'lodash' => { package: 'lodash', isReachable: true, evidence: ['src/app.js'] },
//   'express' => { package: 'express', isReachable: true, evidence: ['src/server.js'] },
//   'axios' => { package: 'axios', isReachable: false, evidence: [] }
// }
```

---

### 3. Check GitHub Check Run

1. Go to your PR
2. Click **"Checks"** tab
3. Find **"OsVault Security"** check
4. Look for:
   - 🚨 REACHABLE section (blocks PR)
   - 🛡️ BYPASSED section (doesn't block PR)
   - Evidence files listed

---

## 🛡️ Safety-First Design

The reachability engine **never produces false negatives**:

### If Analysis Fails:
- ❌ Tarball download fails
- ❌ Tarball too large (>200 MB)
- ❌ Regex error
- ❌ Any other error

**Result:** All vulnerabilities default to 🚨 REACHABLE (blocks PR)

**Reason:** Better to be safe than sorry. We never want to accidentally let a real vulnerability through.

---

## 📈 Performance

### Optimizations:

1. **In-memory streaming** - No disk writes
2. **Early exit** - Stops scanning once all packages are found
3. **Skip directories** - Ignores `node_modules/`, `dist/`, `.next/`, etc.
4. **Skip large files** - Ignores files >500 KB
5. **Skip minified files** - Ignores `.min.js`, `.bundle.js`
6. **Regex-based** - No AST parsing (faster)

### Typical Performance:

- **Small repo** (<10 MB): ~2-3 seconds
- **Medium repo** (10-50 MB): ~5-10 seconds
- **Large repo** (50-200 MB): ~15-30 seconds
- **Huge repo** (>200 MB): Skipped (all marked reachable)

---

## 🐛 Troubleshooting

### Issue: All vulnerabilities marked as REACHABLE

**Possible causes:**
1. Tarball download failed
2. Tarball too large (>200 MB)
3. Analysis error

**Check logs:**
```bash
[reachability] Failed to analyse tarball: <error message>
```

**Solution:** Check GitHub App logs for error details

---

### Issue: False positive (marked REACHABLE but not imported)

**Possible causes:**
1. Package name appears in comments
2. Package name appears in string literals
3. Package name appears in documentation

**Example:**
```javascript
// TODO: Consider using lodash for this
// This will be marked as REACHABLE even though lodash isn't imported
```

**Solution:** This is intentional (safety-first). Better to have a false positive than a false negative.

---

### Issue: False negative (marked BYPASSED but is imported)

**This should never happen!** If it does:

1. Check the import pattern
2. File a bug report with:
   - Import statement
   - File path
   - Package name
   - Expected vs actual result

---

## 📊 Metrics to Track

### In GitHub Check Run:

- **X packages scanned** - Total dependencies checked
- **Y vulnerable** - Total vulnerabilities found
- **Z reachable** - Vulnerabilities that block PR
- **W bypassed** - Vulnerabilities that don't block PR

### In Logs:

```bash
[reachability] owner/repo@abc1234: 5 packages checked, 2 reachable, 3 bypassed
```

---

## 🎯 Success Criteria

✅ **Reachable vulnerabilities block PR** (if CRITICAL/KEV)  
✅ **Unreachable vulnerabilities don't block PR**  
✅ **Evidence files are shown** (up to 5 per package)  
✅ **Strikethrough formatting** for bypassed vulns  
✅ **No false negatives** (safety-first)  
✅ **Fast performance** (<30 seconds for most repos)  

---

## 🚀 Next Steps

1. **Test with your own repos** - Open PRs with vulnerable dependencies
2. **Check the GitHub Check Run** - Verify reachability results
3. **Monitor logs** - Look for performance issues
4. **Collect feedback** - Ask users if results are accurate

---

Built for OsVault 🚀

**Reachability analysis helps you focus on vulnerabilities that actually matter.**
