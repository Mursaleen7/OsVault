import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

interface ServiceAccount {
  id: string;
  credentials: any;
  dailyUsage: number;
  lastReset: string;
}

interface IndexingRequest {
  urls: string[];
  type?: 'URL_UPDATED' | 'URL_DELETED';
}

const DAILY_QUOTA = 200;

// Load service accounts from environment
function loadServiceAccounts(): ServiceAccount[] {
  const accounts: ServiceAccount[] = [];
  let index = 1;
  
  while (process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`]) {
    try {
      const credentials = JSON.parse(process.env[`GOOGLE_SERVICE_ACCOUNT_${index}`] || '{}');
      accounts.push({
        id: `account_${index}`,
        credentials,
        dailyUsage: 0,
        lastReset: new Date().toISOString().split('T')[0],
      });
      index++;
    } catch (error) {
      console.error(`Failed to parse service account ${index}:`, error);
      break;
    }
  }
  
  return accounts;
}

// Simple in-memory usage tracking (use Redis/DB in production)
const usageTracker = new Map<string, { count: number; date: string }>();

function getAvailableAccount(accounts: ServiceAccount[]): ServiceAccount | null {
  const today = new Date().toISOString().split('T')[0];
  
  for (const account of accounts) {
    const usage = usageTracker.get(account.id);
    
    // Reset if new day
    if (!usage || usage.date !== today) {
      usageTracker.set(account.id, { count: 0, date: today });
      return account;
    }
    
    // Check if under quota
    if (usage.count < DAILY_QUOTA) {
      return account;
    }
  }
  
  return null;
}

function incrementUsage(accountId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const usage = usageTracker.get(accountId) || { count: 0, date: today };
  usage.count++;
  usageTracker.set(accountId, usage);
}

async function indexUrl(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED',
  credentials: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const indexing = google.indexing({ version: 'v3', auth });

    await indexing.urlNotifications.publish({
      requestBody: {
        url,
        type,
      },
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: IndexingRequest = await request.json();
    const { urls, type = 'URL_UPDATED' } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLs array is required' },
        { status: 400 }
      );
    }

    const accounts = loadServiceAccounts();
    
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No service accounts configured' },
        { status: 500 }
      );
    }

    const results = [];
    const errors = [];

    for (const url of urls) {
      const account = getAvailableAccount(accounts);
      
      if (!account) {
        errors.push({
          url,
          error: 'All service accounts have reached their daily quota',
        });
        continue;
      }

      const result = await indexUrl(url, type, account.credentials);
      
      if (result.success) {
        incrementUsage(account.id);
        results.push({
          url,
          success: true,
          accountUsed: account.id,
        });
      } else {
        errors.push({
          url,
          error: result.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      indexed: results.length,
      failed: errors.length,
      results,
      errors,
      totalCapacity: accounts.length * DAILY_QUOTA,
      remainingToday: accounts.reduce((sum, acc) => {
        const usage = usageTracker.get(acc.id);
        const today = new Date().toISOString().split('T')[0];
        if (!usage || usage.date !== today) return sum + DAILY_QUOTA;
        return sum + (DAILY_QUOTA - usage.count);
      }, 0),
    });
  } catch (error: any) {
    console.error('Indexing API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const accounts = loadServiceAccounts();
  const today = new Date().toISOString().split('T')[0];
  
  const status = accounts.map(account => {
    const usage = usageTracker.get(account.id);
    const used = usage && usage.date === today ? usage.count : 0;
    
    return {
      id: account.id,
      used,
      remaining: DAILY_QUOTA - used,
      quota: DAILY_QUOTA,
    };
  });

  return NextResponse.json({
    totalAccounts: accounts.length,
    totalCapacity: accounts.length * DAILY_QUOTA,
    totalUsed: status.reduce((sum, s) => sum + s.used, 0),
    totalRemaining: status.reduce((sum, s) => sum + s.remaining, 0),
    accounts: status,
  });
}
