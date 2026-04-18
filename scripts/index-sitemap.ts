#!/usr/bin/env tsx
/**
 * Script to index URLs from sitemap
 * Usage: npx tsx scripts/index-sitemap.ts
 */

import { parseStringPromise } from 'xml2js';

const SITEMAP_URL = process.env.SITEMAP_URL || 'https://osvault.com/sitemap.xml';
const API_URL = process.env.INDEXING_API_URL || 'http://localhost:3000';

async function fetchSitemap(): Promise<string[]> {
  console.log(`Fetching sitemap from ${SITEMAP_URL}...`);
  
  const response = await fetch(SITEMAP_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: ${response.statusText}`);
  }
  
  const xml = await response.text();
  const parsed = await parseStringPromise(xml);
  
  const urls: string[] = [];
  
  if (parsed.urlset && parsed.urlset.url) {
    for (const entry of parsed.urlset.url) {
      if (entry.loc && entry.loc[0]) {
        urls.push(entry.loc[0]);
      }
    }
  }
  
  return urls;
}

async function indexUrls(urls: string[]): Promise<void> {
  console.log(`Indexing ${urls.length} URLs from sitemap...`);
  
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
    console.log('\n=== Errors ===');
    result.errors.slice(0, 10).forEach((err: any) => {
      console.log(`- ${err.url}: ${err.error}`);
    });
  }
}

async function main() {
  try {
    const urls = await fetchSitemap();
    console.log(`Found ${urls.length} URLs in sitemap`);
    
    await indexUrls(urls);
    
    console.log('\n✅ Sitemap indexing complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
