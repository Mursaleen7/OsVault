#!/usr/bin/env tsx
/**
 * Smart Daily Indexing Script
 * 
 * Features:
 * - Prioritizes latest CVEs first
 * - Checks Google indexing status before submitting
 * - Uses full daily quota (200 URLs per account)
 * - Tracks indexing status in database
 * - Skips already indexed pages
 * - Retries failed pages
 * 
 * Usage: cd osvault-web && npx tsx smart-daily-indexing.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Load .env.local
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://os-vault-kappa.vercel.app';
const API_URL = process.env.INDEXING_API_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface CVERecord {
  id: number;
  cve_id: string;
  published_at: string;
  modified_at: string;
  google_index_status: string | null;
  google_indexed_at: string | null;
  google_index_attempts: number;
}

// Load service accounts
function loadServiceAccounts(): any[] {
  const accounts: any[] = [];
  let index = 1;
  
  console.log('\n🔍 Loading service accounts...');
  
  while (process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`]) {
    try {
      const envValue = process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`];
      console.log(`   Found GOOGLE_SERVICE_ACCOUNT_${index} (${envValue?.length} chars)`);
      
      const credentials = JSON.parse(envValue || '{}');
      console.log(`   ✅ Parsed account ${index}: ${credentials.client_email}`);
      
      accounts.push(credentials);
      index++;
    } catch (error: any) {
      console.log(`   ❌ Failed to parse account ${index}:`, error.message);
      break;
    }
  }
  
  console.log(`   Total accounts loaded: ${accounts.length}\n`);
  return accounts;
}

// Check if URL is indexed in Google using Indexing API
async function checkIndexingStatus(url: string, credentials: any): Promise<boolean> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.getMetadata({
      url,
    });

    // If we get a response, the URL has been submitted before
    return response.data.latestUpdate?.type === 'URL_UPDATED';
  } catch (error: any) {
    // 404 means never submitted
    if (error.code === 404) {
      return false;
    }
    // Other errors, assume not indexed
    return false;
  }
}

// Get CVEs that need indexing (prioritize latest first)
async function getCVEsToIndex(limit: number): Promise<CVERecord[]> {
  console.log(`\n📋 Fetching CVEs to index (limit: ${limit})...`);
  
  // Priority order:
  // 1. New CVEs (never attempted)
  // 2. Recently modified CVEs (not indexed)
  // 3. Failed attempts (retry)
  
  const { data, error } = await supabase
    .from('vulnerabilities')
    .select('id, cve_id, published_at, modified_at, google_index_status, google_indexed_at, google_index_attempts')
    .or('google_index_status.is.null,google_index_status.eq.pending,google_index_status.eq.failed')
    .order('published_at', { ascending: false })
    .limit(limit * 2); // Get more to filter

  if (error) {
    throw new Error(`Failed to fetch CVEs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Sort by priority
  const sorted = data.sort((a, b) => {
    // Priority 1: Never attempted
    const aAttempts = a.google_index_attempts || 0;
    const bAttempts = b.google_index_attempts || 0;
    
    if (aAttempts === 0 && bAttempts > 0) return -1;
    if (bAttempts === 0 && aAttempts > 0) return 1;
    
    // Priority 2: Latest published date
    const aDate = new Date(a.published_at || 0).getTime();
    const bDate = new Date(b.published_at || 0).getTime();
    
    return bDate - aDate;
  });

  return sorted.slice(0, limit);
}

// Update CVE indexing status in database
async function updateIndexingStatus(
  cveId: string,
  status: 'indexed' | 'failed',
  increment: boolean = true
): Promise<void> {
  const updates: any = {
    google_index_status: status,
    google_last_attempt_at: new Date().toISOString(),
  };

  if (status === 'indexed') {
    updates.google_indexed_at = new Date().toISOString();
  }

  if (increment) {
    // Increment attempts
    const { data } = await supabase
      .from('vulnerabilities')
      .select('google_index_attempts')
      .eq('cve_id', cveId)
      .single();
    
    updates.google_index_attempts = (data?.google_index_attempts || 0) + 1;
  }

  const { error } = await supabase
    .from('vulnerabilities')
    .update(updates)
    .eq('cve_id', cveId);

  if (error) {
    console.error(`Failed to update status for ${cveId}:`, error.message);
  }
}

// Index URLs using the API
async function indexUrls(urls: string[]): Promise<{ indexed: number; failed: number; errors: any[] }> {
  if (urls.length === 0) {
    return { indexed: 0, failed: 0, errors: [] };
  }

  const response = await fetch(`${API_URL}/api/indexing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls }),
  });

  if (!response.ok) {
    throw new Error(`Indexing API failed: ${response.statusText}`);
  }

  return await response.json();
}

// Get available quota
async function getAvailableQuota(): Promise<number> {
  const response = await fetch(`${API_URL}/api/indexing`);
  const status = await response.json();
  return status.totalRemaining || 0;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Smart Daily Indexing - Google Indexing API                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ Started at: ${new Date().toISOString()}`);

  try {
    // Check available quota
    const availableQuota = await getAvailableQuota();
    console.log(`\n📊 Available quota today: ${availableQuota} URLs`);

    if (availableQuota === 0) {
      console.log('\n⚠️  No quota available today. All service accounts exhausted.');
      console.log('💡 Add more service accounts or wait until tomorrow.');
      return;
    }

    // Get CVEs to index
    const cvesToIndex = await getCVEsToIndex(availableQuota);
    
    if (cvesToIndex.length === 0) {
      console.log('\n✅ All CVEs are already indexed!');
      return;
    }

    console.log(`\n📝 Found ${cvesToIndex.length} CVEs to index`);
    console.log(`   - New (never attempted): ${cvesToIndex.filter(c => (c.google_index_attempts || 0) === 0).length}`);
    console.log(`   - Retries: ${cvesToIndex.filter(c => (c.google_index_attempts || 0) > 0).length}`);

    // Load service accounts for status checking
    const serviceAccounts = loadServiceAccounts();
    if (serviceAccounts.length === 0) {
      throw new Error('No service accounts configured');
    }

    // Check which ones are already indexed in Google
    console.log('\n🔍 Checking Google indexing status...');
    const toSubmit: CVERecord[] = [];
    const alreadyIndexed: string[] = [];

    // Check in batches to show progress
    const batchSize = 20;
    for (let i = 0; i < cvesToIndex.length; i += batchSize) {
      const batch = cvesToIndex.slice(i, i + batchSize);
      console.log(`   Checking batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cvesToIndex.length / batchSize)} (${i + 1}-${Math.min(i + batchSize, cvesToIndex.length)} of ${cvesToIndex.length})...`);
      
      for (const cve of batch) {
        const url = `${BASE_URL}/cve/${cve.cve_id}`;
        const isIndexed = await checkIndexingStatus(url, serviceAccounts[0]);
        
        if (isIndexed) {
          alreadyIndexed.push(cve.cve_id);
          // Update database to mark as indexed
          await updateIndexingStatus(cve.cve_id, 'indexed', false);
        } else {
          toSubmit.push(cve);
        }

        // Rate limit the status checks (reduced from 100ms to 50ms)
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (alreadyIndexed.length > 0) {
      console.log(`   ✅ Already indexed: ${alreadyIndexed.length} CVEs`);
      console.log(`   📤 Need to submit: ${toSubmit.length} CVEs`);
    }

    if (toSubmit.length === 0) {
      console.log('\n✅ All CVEs are already indexed in Google!');
      return;
    }

    // Submit URLs for indexing
    console.log(`\n📤 Submitting ${toSubmit.length} URLs to Google...`);
    const urls = toSubmit.map(cve => `${BASE_URL}/cve/${cve.cve_id}`);
    
    const result = await indexUrls(urls);

    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('  INDEXING RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`  ✅ Successfully indexed: ${result.indexed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  📊 Already indexed: ${alreadyIndexed.length}`);
    console.log(`  📈 Total processed: ${cvesToIndex.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');

    // Update database with results
    console.log('\n💾 Updating database...');
    
    if (result.results) {
      for (const res of result.results) {
        const cveId = res.url.split('/').pop();
        if (cveId && res.success) {
          await updateIndexingStatus(cveId, 'indexed');
        }
      }
    }

    if (result.errors) {
      for (const err of result.errors) {
        const cveId = err.url.split('/').pop();
        if (cveId) {
          await updateIndexingStatus(cveId, 'failed');
        }
      }

      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors (first 5):');
        result.errors.slice(0, 5).forEach((err: any) => {
          console.log(`   - ${err.url}: ${err.error}`);
        });
      }
    }

    // Check remaining quota
    const remainingQuota = await getAvailableQuota();
    console.log(`\n📊 Remaining quota: ${remainingQuota}/${availableQuota + result.indexed}`);

    console.log('\n✅ Smart daily indexing complete!');
    console.log(`⏰ Finished at: ${new Date().toISOString()}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
