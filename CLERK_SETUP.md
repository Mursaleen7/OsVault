# Clerk Setup Guide for OsVault

## Current Issue
The dashboard, pricing, trust, and blog pages are returning 500 errors because Clerk environment variables are missing from Vercel.

## Steps to Fix

### 1. Get Clerk API Keys

1. Go to https://dashboard.clerk.com
2. Sign up or log in
3. Create a new application called "OsVault"
4. Go to **API Keys** in the sidebar
5. Copy both keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)

### 2. Add Keys to Vercel

Run these commands from the repo root (`~/Desktop/OsVault`):

```bash
# Add Clerk publishable key (public, safe to expose)
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# When prompted:
# - Paste your publishable key (pk_test_...)
# - Select: Production, Preview, Development (all three)

# Add Clerk secret key (private, never expose)
vercel env add CLERK_SECRET_KEY

# When prompted:
# - Paste your secret key (sk_test_...)
# - Select: Production, Preview, Development (all three)
```

### 3. Add Keys to Local Environment

Add these lines to `osvault-web/.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your_key_here"
CLERK_SECRET_KEY="sk_test_your_key_here"
```

### 4. Redeploy

```bash
# From repo root
vercel --prod
```

### 5. Configure Clerk Application Settings

In your Clerk dashboard:

1. **Add Allowed Redirect URLs**:
   - `https://os-vault-kappa.vercel.app`
   - `http://localhost:3000` (for local dev)

2. **Enable Organizations**:
   - Go to **Organizations** in sidebar
   - Enable organization features
   - This allows users to create teams/orgs

3. **Customize Appearance** (optional):
   - Go to **Customization** → **Theme**
   - Set primary color to `#E63946` (OsVault red)
   - Enable dark mode

## Verification

After redeploying, test these URLs:
- https://os-vault-kappa.vercel.app/dashboard
- https://os-vault-kappa.vercel.app/pricing
- https://os-vault-kappa.vercel.app/trust
- https://os-vault-kappa.vercel.app/blog

All should load without 500 errors.

## What Clerk Provides

- **Authentication**: Sign in/sign up with email, Google, GitHub
- **Organizations**: Multi-tenant support for teams
- **User Management**: Profile, settings, session management
- **Security**: MFA, session tokens, CSRF protection

## Pricing

- **Free tier**: 10,000 monthly active users
- **Pro tier**: $25/month for advanced features
- Start with free tier — more than enough for MVP

## Support

If you encounter issues:
- Clerk docs: https://clerk.com/docs
- Clerk Discord: https://clerk.com/discord
