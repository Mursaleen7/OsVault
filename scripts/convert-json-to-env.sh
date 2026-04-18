#!/bin/bash
# Convert service account JSON files to environment variables
# Usage: ./scripts/convert-json-to-env.sh service-account-*.json

echo "# Google Indexing API Service Accounts"
echo "# Generated on $(date)"
echo ""

counter=1
for file in "$@"; do
  if [ -f "$file" ]; then
    # Remove newlines and extra spaces from JSON
    json_content=$(cat "$file" | tr -d '\n' | tr -s ' ')
    echo "GOOGLE_SERVICE_ACCOUNT_${counter}='${json_content}'"
    echo ""
    counter=$((counter + 1))
  fi
done

echo "# Total service accounts: $((counter - 1))"
echo "# Total daily capacity: $((200 * (counter - 1))) URLs"
