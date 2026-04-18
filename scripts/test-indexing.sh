#!/bin/bash
# Test script for Google Indexing API
# Usage: ./scripts/test-indexing.sh

set -e

API_URL="${INDEXING_API_URL:-http://localhost:3000}"

echo "=== Testing Google Indexing API ==="
echo "API URL: $API_URL"
echo ""

# Test 1: Check quota status
echo "1. Checking quota status..."
curl -s "$API_URL/api/indexing" | jq '.'
echo ""

# Test 2: Index a single URL
echo "2. Testing single URL indexing..."
curl -s -X POST "$API_URL/api/indexing" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://osvault.com/cve/CVE-2024-1234"]}' | jq '.'
echo ""

# Test 3: Index multiple URLs
echo "3. Testing batch indexing..."
curl -s -X POST "$API_URL/api/indexing/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://osvault.com/cve/CVE-2024-1234",
      "https://osvault.com/cve/CVE-2024-5678",
      "https://osvault.com/cve/CVE-2024-9012"
    ],
    "batchSize": 2,
    "delayMs": 500
  }' | jq '.'
echo ""

# Test 4: Check quota after indexing
echo "4. Checking quota after indexing..."
curl -s "$API_URL/api/indexing" | jq '.'
echo ""

echo "✅ All tests complete!"
