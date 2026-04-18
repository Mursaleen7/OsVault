#!/bin/bash
# Quick test of the Google Indexing API setup

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║  Google Indexing API - Quick Test                                         ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Check if server is running
echo "1️⃣  Checking if dev server is running..."
if curl -s http://localhost:3000/api/indexing > /dev/null 2>&1; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is not running. Start it with: npm run dev"
    exit 1
fi
echo ""

# Test 2: Check quota status
echo "2️⃣  Checking service account configuration..."
RESPONSE=$(curl -s http://localhost:3000/api/indexing)
ACCOUNTS=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['totalAccounts'])" 2>/dev/null)

if [ "$ACCOUNTS" -gt 0 ]; then
    echo "   ✅ Found $ACCOUNTS service account(s)"
    echo "   📊 Daily capacity: $((ACCOUNTS * 200)) URLs"
else
    echo "   ❌ No service accounts configured"
    exit 1
fi
echo ""

# Test 3: Test indexing
echo "3️⃣  Testing URL indexing..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:3000/api/indexing \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://osvault.com"]}')

SUCCESS=$(echo $TEST_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
INDEXED=$(echo $TEST_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('indexed', 0))" 2>/dev/null)
FAILED=$(echo $TEST_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('failed', 0))" 2>/dev/null)

if [ "$INDEXED" -gt 0 ]; then
    echo "   ✅ Successfully indexed $INDEXED URL(s)"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║  🎉 SUCCESS! Your Google Indexing API is fully configured!                ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"
elif [ "$FAILED" -gt 0 ]; then
    ERROR=$(echo $TEST_RESPONSE | python3 -c "import sys, json; errors = json.load(sys.stdin).get('errors', []); print(errors[0]['error'] if errors else 'Unknown error')" 2>/dev/null)
    echo "   ⚠️  Indexing failed: $ERROR"
    echo ""
    echo "╔════════════════════════════════════════════════════════════════════════════╗"
    echo "║  ⚠️  SETUP INCOMPLETE - Action Required                                    ║"
    echo "╚════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📋 You need to add your service account to Google Search Console:"
    echo ""
    echo "   Service Account Email:"
    echo "   osvault-indexing-sa-1@osvault-indexing-1.iam.gserviceaccount.com"
    echo ""
    echo "   Steps:"
    echo "   1. Go to: https://search.google.com/search-console"
    echo "   2. Select your property: osvault.com"
    echo "   3. Settings → Users and permissions → Add user"
    echo "   4. Paste the email above and set permission to 'Owner'"
    echo "   5. Wait 1-2 minutes, then run this test again"
    echo ""
else
    echo "   ❌ Unexpected response"
fi

echo ""
echo "📚 For more details, see: NEXT_STEPS.md"
echo ""
