import { NextRequest, NextResponse } from 'next/server';

interface BatchIndexingRequest {
  urls: string[];
  batchSize?: number;
  delayMs?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchIndexingRequest = await request.json();
    const { urls, batchSize = 50, delayMs = 1000 } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    const batches = [];
    for (let i = 0; i < urls.length; i += batchSize) {
      batches.push(urls.slice(i, i + batchSize));
    }

    const allResults = [];
    const allErrors = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Call the main indexing endpoint
      const response = await fetch(
        `${request.nextUrl.origin}/api/indexing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch }),
        }
      );

      const result = await response.json();
      
      if (result.results) {
        allResults.push(...result.results);
      }
      if (result.errors) {
        allErrors.push(...result.errors);
      }

      // Delay between batches (except for the last one)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return NextResponse.json({
      success: true,
      totalUrls: urls.length,
      batches: batches.length,
      indexed: allResults.length,
      failed: allErrors.length,
      results: allResults,
      errors: allErrors,
    });
  } catch (error: any) {
    console.error('Batch indexing error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
