# OsVault GitHub App

A GitHub App that automatically checks pull requests for vulnerable dependencies and performs reachability analysis to determine if vulnerabilities are actually exploitable in your code.

## Features

- 🔍 **Automatic Vulnerability Scanning**: Scans `package.json` and `requirements.txt` changes in PRs
- 🎯 **Reachability Analysis**: Determines if vulnerable packages are actually imported/used in your code
- ✅ **GitHub Check Runs**: Posts detailed results directly on pull requests
- 🚀 **Smart Detection**: Only flags vulnerabilities that are REACHABLE, reducing false positives

## How It Works

1. When a PR modifies dependency files, the app is triggered
2. Extracts added/modified dependencies from the diff
3. Checks Supabase database for known vulnerabilities
4. Analyzes the repository code to detect if vulnerable packages are imported
5. Posts a check run with detailed results:
   - **REACHABLE**: Package is imported and vulnerability is exploitable
   - **BYPASSED**: Package exists but is not imported (safe to ignore)

## Deployment

Deployed on Vercel: `https://github-app-psi-plum.vercel.app`

### Environment Variables

Required in Vercel:
- `GITHUB_APP_ID`: GitHub App ID
- `GITHUB_APP_PRIVATE_KEY`: Private key (single line with `\n` escape sequences)
- `GITHUB_WEBHOOK_SECRET`: Webhook secret for signature verification
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase service role key
- `APP_URL`: Base URL of the main application

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start the server
npm start
```

## Project Structure

```
github-app/
├── src/
│   ├── index.ts          # Main webhook handler
│   ├── checks.ts         # GitHub check run posting
│   ├── diff.ts           # Dependency diff parsing
│   ├── reachability.ts   # Code analysis for imports
│   ├── supabase.ts       # Vulnerability database queries
│   └── usage.ts          # Usage tracking for private repos
├── dist/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── vercel.json          # Vercel deployment config
```

## Supported Ecosystems

- **npm** (JavaScript/TypeScript): `package.json`
- **PyPI** (Python): `requirements.txt`

## GitHub App Configuration

- **Webhook URL**: `https://github-app-psi-plum.vercel.app/webhook`
- **Events**: `pull_request` (opened, synchronize)
- **Permissions**: 
  - Contents: Read
  - Pull requests: Read & Write
  - Checks: Read & Write
