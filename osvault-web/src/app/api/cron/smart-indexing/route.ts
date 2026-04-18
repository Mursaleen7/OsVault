import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://os-vault-kappa.vercel.app';

interface CVERecord {
  id: number;
  cve_id: string;
  published_at: string;
  google_index_status: string | null;
  google_index_attempts: number;
}

/**
 * Smart Vercel Cron Job endpoint for daily indexing
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/smart-indexing",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase credentials' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get available quota
    const quotaResponse = await fetch(`${request.nextUrl.origin}/api/indexing`);
    const quotaStatus = await quotaResponse.json();
    const availableQuota = quotaStatus.totalRemaining || 0;

    if (availableQuota === 0) {
      return NextResponse.json({
        success: true,
        message: 'No quota available today',
        indexed: 0,
      });
    }

    // Get CVEs to index (prioritize latest first)
    const { data: cvesToIndex, error: fetchError } = await supabase
      .from('vulnerabilities')
      .select('id, cve_id, published_at, google_index_status, google_index_attempts')
      .or('google_index_status.is.null,google_index_status.eq.pending,google_index_status.eq.failed')
      .order('published_at', { ascending: false })
      .limit(availableQuota);

    if (fetchError) throw fetchError;

    if (!cvesToIndex || cvesToIndex.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All CVEs are already indexed',
        indexed: 0,
      });
    }

    // Load service accounts for status checking
    const serviceAccounts = [];
    let index = 1;
    while (process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`]) {
      try {
        serviceAccounts.push(JSON.parse(process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`] || '{}'));
        index++;
      } catch {
        break;
      }
    }

    if (serviceAccounts.length === 0) {
      throw new Error('No service accounts configured');
    }

    // Check which ones are already indexed in Google
    const toSubmit: CVERecord[] = [];
    const alreadyIndexed: string[] = [];

    for (const cve of cvesToIndex) {
      const url = `${BASE_URL}/cve/${cve.cve_id}`;
      
      try {
        const auth = new google.auth.GoogleAuth({
          credentials: serviceAccounts[0],
          scopes: ['https://www.googleapis.com/auth/indexing'],
        });

        const indexing = google.indexing({ version: 'v3', auth });
        const response = await indexing.urlNotifications.getMetadata({ url });

        if (response.data.latestUpdate?.type === 'URL_UPDATED') {
          alreadyIndexed.push(cve.cve_id);
          // Update database
          await supabase
            .from('vulnerabilities')
            .update({
              google_index_status: 'indexed',
              google_indexed_at: new Date().toISOString(),
            })
            .eq('cve_id', cve.cve_id);
        } else {
          toSubmit.push(cve);
        }
      } catch {
        // Not indexed, add to submit list
        toSubmit.push(cve);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (toSubmit.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All CVEs are already indexed in Google',
        alreadyIndexed: alreadyIndexed.length,
        indexed: 0,
      });
    }

    // Submit URLs for indexing
    const urls = toSubmit.map(cve => `${BASE_URL}/cve/${cve.cve_id}`);
    
    const indexResponse = await fetch(
      `${request.nextUrl.origin}/api/indexing`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      }
    );

    const result = await indexResponse.json();

    // Update database with results
    if (result.results) {
      for (const res of result.results) {
        const cveId = res.url.split('/').pop();
        if (cveId && res.success) {
          const { data: current } = await supabase
            .from('vulnerabilities')
            .select('google_index_attempts')
            .eq('cve_id', cveId)
            .single();

          await supabase
            .from('vulnerabilities')
            .update({
              google_index_status: 'indexed',
              google_indexed_at: new Date().toISOString(),
              google_last_attempt_at: new Date().toISOString(),
              google_index_attempts: (current?.google_index_attempts || 0) + 1,
            })
            .eq('cve_id', cveId);
        }
      }
    }

    if (result.errors) {
      for (const err of result.errors) {
        const cveId = err.url.split('/').pop();
        if (cveId) {
          const { data: current } = await supabase
            .from('vulnerabilities')
            .select('google_index_attempts')
            .eq('cve_id', cveId)
            .single();

          await supabase
            .from('vulnerabilities')
            .update({
              google_index_status: 'failed',
              google_last_attempt_at: new Date().toISOString(),
              google_index_attempts: (current?.google_index_attempts || 0) + 1,
            })
            .eq('cve_id', cveId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed: cvesToIndex.length,
      alreadyIndexed: alreadyIndexed.length,
      submitted: toSubmit.length,
      indexed: result.indexed,
      failed: result.failed,
      errors: result.errors?.slice(0, 5) || [],
    });
  } catch (error: any) {
    console.error('Smart cron indexing error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
