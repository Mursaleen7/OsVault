#!/usr/bin/env tsx
/**
 * Daily cron job to index new/updated CVEs
 * Usage: npx tsx scripts/schedule-indexing.ts
 * Cron: 0 2 * * * (runs at 2 AM daily)
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

async function getRecentCVEs(hours: number = 24): Promise<string[]> {
  console.log(`Fetching CVEs from the last ${hours} hours...`);
  
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  
  const { data, error } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .gte('published_date', cutoffDate.toISOString())
    .order('published_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch CVEs: ${error.message}`);
  }

  return data.map(row => `${BASE_URL}/cve/${row.cve_id}`);
}

async function getUpdatedCVEs(hours: number = 24): Promise<string[]> {
  console.log(`Fetching updated CVEs from the last ${hours} hours...`);
  
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hours);
  
  const { data, error } = await supabase
    .from('vulnerabilities')
    .select('cve_id')
    .gte('last_modified_date', cutoffDate.toISOString())
    .order('last_modified_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch updated CVEs: ${error.message}`);
  }

  return data.map(row => `${BASE_URL}/cve/${row.cve_id}`);
}

async function indexUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    console.log('No URLs to index');
    return;
  }
  
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
  console.log(`Successfully indexed: ${result.indexed}`);
  console.log(`Failed: ${result.failed}`);
  
  if (result.errors && result.errors.length > 0) {
    console.log('\n=== Errors (first 5) ===');
    result.errors.slice(0, 5).forEach((err: any) => {
      console.log(`- ${err.url}: ${err.error}`);
    });
  }
}

async function main() {
  try {
    console.log('=== Daily Indexing Job Started ===');
    console.log(`Time: ${new Date().toISOString()}`);
    
    // Get new and updated CVEs
    const [newUrls, updatedUrls] = await Promise.all([
      getRecentCVEs(24),
      getUpdatedCVEs(24),
    ]);
    
    // Combine and deduplicate
    const allUrls = [...new Set([...newUrls, ...updatedUrls])];
    
    console.log(`\nFound ${newUrls.length} new CVEs`);
    console.log(`Found ${updatedUrls.length} updated CVEs`);
    console.log(`Total unique URLs to index: ${allUrls.length}`);
    
    // Index all URLs
    await indexUrls(allUrls);
    
    // Check remaining quota
    const statusResponse = await fetch(`${API_URL}/api/indexing`);
    const status = await statusResponse.json();
    console.log(`\nRemaining quota today: ${status.totalRemaining}/${status.totalCapacity}`);
    
    console.log('\n✅ Daily indexing job complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
