#!/usr/bin/env tsx
/**
 * Display all service account emails that need to be added to Google Search Console
 * Usage: npx tsx scripts/show-service-account-emails.ts
 */

function loadServiceAccounts(): Array<{ id: string; email: string }> {
  const accounts: Array<{ id: string; email: string }> = [];
  let index = 1;
  
  while (process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`]) {
    try {
      const credentials = JSON.parse(process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`] || '{}');
      accounts.push({
        id: `account_${index}`,
        email: credentials.client_email,
      });
      index++;
    } catch (error) {
      console.error(`Failed to parse service account ${index}:`, error);
      break;
    }
  }
  
  return accounts;
}

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║  Google Search Console - Service Account Setup                            ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

const accounts = loadServiceAccounts();

if (accounts.length === 0) {
  console.log('❌ No service accounts found in environment variables.\n');
  console.log('Make sure you have GOOGLE_SERVICE_ACCOUNT_1, GOOGLE_SERVICE_ACCOUNT_2, etc.');
  console.log('configured in your .env.local file.\n');
  process.exit(1);
}

console.log(`Found ${accounts.length} service account(s):\n`);

accounts.forEach((account, index) => {
  console.log(`${index + 1}. ${account.email}`);
});

console.log('\n' + '─'.repeat(80) + '\n');
console.log('📋 NEXT STEPS:\n');
console.log('1. Go to: https://search.google.com/search-console\n');
console.log('2. Select your property: osvault.com\n');
console.log('3. Click "Settings" in the left sidebar\n');
console.log('4. Click "Users and permissions"\n');
console.log('5. Click "Add user" button\n');
console.log('6. For EACH email above:');
console.log('   - Paste the email address');
console.log('   - Set permission to "Owner"');
console.log('   - Click "Add"\n');
console.log('7. Wait 1-2 minutes for permissions to propagate\n');
console.log('8. Test again with: ./scripts/test-indexing.sh\n');
console.log('─'.repeat(80) + '\n');
console.log(`✅ Total daily capacity: ${accounts.length * 200} URLs/day\n`);
