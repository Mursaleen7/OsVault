#!/usr/bin/env tsx
/**
 * Check indexing statistics
 * Usage: cd osvault-web && npx tsx check-indexing-stats.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_URL = process.env.INDEXING_API_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getQuotaStatus() {
  try {
    const response = await fetch(`${API_URL}/api/indexing`);
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  Google Indexing Statistics                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  // Get total CVEs
  const { count: totalCVEs } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true });

  // Get indexed CVEs
  const { count: indexedCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .eq('google_index_status', 'indexed');

  // Get pending CVEs
  const { count: pendingCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .or('google_index_status.is.null,google_index_status.eq.pending');

  // Get failed CVEs
  const { count: failedCount } = await supabase
    .from('vulnerabilities')
    .select('*', { count: 'exact', head: true })
    .eq('google_index_status', 'failed');

  // Get recently indexed
  const { data: recentlyIndexed } = await supabase
    .from('vulnerabilities')
    .select('cve_id, google_indexed_at')
    .eq('google_index_status', 'indexed')
    .order('google_indexed_at', { ascending: false })
    .limit(5);

  // Get quota status
  const quotaStatus = await getQuotaStatus();

  console.log('📊 DATABASE STATISTICS\n');
  console.log(`   Total CVEs:           ${totalCVEs || 0}`);
  console.log(`   ✅ Indexed:           ${indexedCount || 0} (${((indexedCount || 0) / (totalCVEs || 1) * 100).toFixed(1)}%)`);
  console.log(`   ⏳ Pending:           ${pendingCount || 0} (${((pendingCount || 0) / (totalCVEs || 1) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Failed:            ${failedCount || 0} (${((failedCount || 0) / (totalCVEs || 1) * 100).toFixed(1)}%)`);

  if (quotaStatus) {
    console.log('\n📈 QUOTA STATUS\n');
    console.log(`   Total Accounts:       ${quotaStatus.totalAccounts}`);
    console.log(`   Daily Capacity:       ${quotaStatus.totalCapacity} URLs`);
    console.log(`   Used Today:           ${quotaStatus.totalUsed}`);
    console.log(`   Remaining Today:      ${quotaStatus.totalRemaining}`);
  }

  if (recentlyIndexed && recentlyIndexed.length > 0) {
    console.log('\n🕐 RECENTLY INDEXED (Last 5)\n');
    recentlyIndexed.forEach((cve, i) => {
      const date = new Date(cve.google_indexed_at);
      const timeAgo = Math.floor((Date.now() - date.getTime()) / 1000 / 60);
      console.log(`   ${i + 1}. ${cve.cve_id} - ${timeAgo} minutes ago`);
    });
  }

  // Calculate estimated completion
  if (pendingCount && quotaStatus) {
    const daysToComplete = Math.ceil((pendingCount || 0) / quotaStatus.totalCapacity);
    console.log('\n⏱️  ESTIMATED COMPLETION\n');
    console.log(`   Days to index all:    ${daysToComplete} days`);
    console.log(`   At current capacity:  ${quotaStatus.totalCapacity} URLs/day`);
  }

  console.log('\n' + '═'.repeat(80) + '\n');
}

main();
