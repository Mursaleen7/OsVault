#!/bin/bash
# Quick setup script for smart indexing

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║  Smart Indexing Setup                                                      ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check if database migration is needed
echo "📋 Step 1: Database Migration"
echo ""
echo "You need to run this SQL in your Supabase SQL Editor:"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat scripts/migration-add-indexing-columns.sql
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
echo "2. Copy the SQL above"
echo "3. Paste and run it"
echo ""
read -p "Press Enter when you've run the migration..."
echo ""

# Step 2: Test the smart indexing
echo "📊 Step 2: Testing Smart Indexing"
echo ""
echo "Running a test to check your setup..."
echo ""

npx tsx scripts/check-indexing-stats.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Do you want to run the smart indexing now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Running smart daily indexing..."
    echo ""
    npx tsx scripts/smart-daily-indexing.ts
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                                                        ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📚 Next steps:"
echo ""
echo "   1. Set up automation (Vercel/GitHub Actions/Cron)"
echo "   2. Monitor with: npx tsx scripts/check-indexing-stats.ts"
echo "   3. Read: SMART_INDEXING_GUIDE.md"
echo ""
