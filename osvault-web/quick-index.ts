#!/usr/bin/env tsx
/**
 * Quick indexing script - skips status checking for first run
 * Usage: cd osvault-web && npx tsx quick-index.ts [limit]
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://os-vault-kappa.vercel.app';
const API_URL = process.env.INDEXING_API_URL || 'http://localhost:3000';
const LIMIT = parseInt(process.argv[2] || '200');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Quick Indexing - Google Indexing API                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📊 Limit: ${LIMIT} URLs\n`);

  try {
    // Get CVEs that haven't been indexed yet
    const { data: cvesToIndex, error } = await supabase
      .from('vulnerabilities')
      .select('id, cve_id, published_at')
      .or('google_index_status.is.null,google_index_status.eq.pending')
      .order('published_at', { ascending: false })
      .limit(LIMIT);

    if (error) throw error;

    if (!cvesToIndex || cvesToIndex.length === 0) {
      console.log('✅ No CVEs to index!');
      return;
    }

    console.log(`📝 Found ${cvesToIndex.length} CVEs to index`);
    console.log(`   Latest: ${cvesToIndex[0].cve_id}`);
    console.log(`   Oldest: ${cvesToIndex[cvesToIndex.length - 1].cve_id}\n`);

    // Build URLs
    const urls = cvesToIndex.map(cve => `${BASE_URL}/cve/${cve.cve_id}`);

    // Submit for indexing
    console.log(`📤 Submitting ${urls.length} URLs to Google...\n`);
    
    const response = await fetch(`${API_URL}/api/indexing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('  INDEXING RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`  ✅ Successfully indexed: ${result.indexed}`);
    console.log(`  ❌ Failed: ${result.failed}`);
    console.log(`  📊 Remaining quota: ${result.remainingToday}/${result.totalCapacity}`);
    console.log('═══════════════════════════════════════════════════════════════════════════\n');

    // Update database
    console.log('💾 Updating database...');
    
    if (result.results) {
      for (const res of result.results) {
        const cveId = res.url.split('/').pop();
        if (cveId && res.success) {
          await supabase
            .from('vulnerabilities')
            .update({
              google_index_status: 'indexed',
              google_indexed_at: new Date().toISOString(),
              google_last_attempt_at: new Date().toISOString(),
              google_index_attempts: 1,
            })
            .eq('cve_id', cveId);
        }
      }
    }

    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errors.slice(0, 5).forEach((err: any) => {
        console.log(`   - ${err.url.split('/').pop()}: ${err.error}`);
      });
      
      // Update failed ones
      for (const err of result.errors) {
        const cveId = err.url.split('/').pop();
        if (cveId) {
          await supabase
            .from('vulnerabilities')
            .update({
              google_index_status: 'failed',
              google_last_attempt_at: new Date().toISOString(),
              google_index_attempts: 1,
            })
            .eq('cve_id', cveId);
        }
      }
    }

    console.log('\n✅ Quick indexing complete!');
    console.log(`⏰ Finished at: ${new Date().toISOString()}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
