#!/usr/bin/env tsx
/**
 * Script to index all CVE pages to Google
 * Usage: npx tsx scripts/index-all-cves.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://osvault.com';
const API_URL = process.env.INDEXING_API_URL || 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getAllCVEs(): Promise<string[]> {
  console.log('Fetching all CVEs from database...');
  
  const { data, error } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .order('published_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch CVEs: ${error.message}`);
  }

  return data.map(row => `${BASE_URL}/cve/${row.cve_id}`);
}

async function indexUrls(urls: string[]): Promise<void> {
  console.log(`Indexing ${urls.length} URLs...`);
  
  const response = await fetch(`${API_URL}/api/indexing/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls,
      batchSize: 50,
      delayMs: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Indexing failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  console.log('\n=== Indexing Results ===');
  console.log(`Total URLs: ${result.totalUrls}`);
  console.log(`Batches: ${result.batches}`);
  console.log(`Successfully indexed: ${result.indexed}`);
  console.log(`Failed: ${result.failed}`);
  
  if (result.errors && result.errors.length > 0) {
    console.log('\n=== Errors ===');
    result.errors.slice(0, 10).forEach((err: any) => {
      console.log(`- ${err.url}: ${err.error}`);
    });
    if (result.errors.length > 10) {
      console.log(`... and ${result.errors.length - 10} more errors`);
    }
  }
}

async function checkQuota(): Promise<void> {
  const response = await fetch(`${API_URL}/api/indexing`);
  const status = await response.json();
  
  console.log('\n=== Quota Status ===');
  console.log(`Total Capacity: ${status.totalCapacity} URLs/day`);
  console.log(`Used Today: ${status.totalUsed}`);
  console.log(`Remaining: ${status.totalRemaining}`);
  console.log(`Active Accounts: ${status.totalAccounts}`);
}

async function main() {
  try {
    // Check quota first
    await checkQuota();
    
    // Get all CVE URLs
    const urls = await getAllCVEs();
    console.log(`\nFound ${urls.length} CVE pages to index`);
    
    // Confirm before proceeding
    if (urls.length > 1000) {
      console.log('\nThis will index a large number of URLs.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Index all URLs
    await indexUrls(urls);
    
    // Check quota after
    await checkQuota();
    
    console.log('\n✅ Indexing complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
