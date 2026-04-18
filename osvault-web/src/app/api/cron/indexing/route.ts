import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://osvault.com';

/**
 * Vercel Cron Job endpoint for daily indexing
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/indexing",
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

    // Get CVEs from last 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const [newCVEs, updatedCVEs] = await Promise.all([
      supabase
        .from('vulnerabilities')
        .select('cve_id')
        .gte('published_date', cutoffDate.toISOString()),
      supabase
        .from('vulnerabilities')
        .select('cve_id')
        .gte('last_modified_date', cutoffDate.toISOString()),
    ]);

    if (newCVEs.error) throw newCVEs.error;
    if (updatedCVEs.error) throw updatedCVEs.error;

    // Combine and deduplicate
    const allCveIds = new Set([
      ...(newCVEs.data || []).map(v => v.cve_id),
      ...(updatedCVEs.data || []).map(v => v.cve_id),
    ]);

    const urls = Array.from(allCveIds).map(id => `${BASE_URL}/cve/${id}`);

    if (urls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new CVEs to index',
        indexed: 0,
      });
    }

    // Call the indexing API
    const indexResponse = await fetch(
      `${request.nextUrl.origin}/api/indexing/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          batchSize: 50,
          delayMs: 1000,
        }),
      }
    );

    const result = await indexResponse.json();

    return NextResponse.json({
      success: true,
      newCVEs: newCVEs.data?.length || 0,
      updatedCVEs: updatedCVEs.data?.length || 0,
      totalUrls: urls.length,
      indexed: result.indexed,
      failed: result.failed,
      errors: result.errors?.slice(0, 5) || [],
    });
  } catch (error: any) {
    console.error('Cron indexing error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
