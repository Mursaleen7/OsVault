import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis from Environment Variables
// Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.warn("[rate-limit] Failed to initialize Upstash Redis:", e);
}

// Global API rate limit: 100 requests per 10 seconds per IP
export const globalApiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "10 s"),
      analytics: true,
      prefix: "osvault-ratelimit-api",
    })
  : null;

// Stricter rate limit for Enterprise APIs: 1000 requests per minute per Org
export const enterpriseApiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(1000, "1 m"),
      analytics: true,
      prefix: "osvault-ratelimit-enterprise",
    })
  : null;

/**
 * Check if the current request should be rate-limited.
 * @param ip Client IP address or Org ID to rate limit against
 * @param type Limiter to use
 * @returns { success: boolean, limit: number, remaining: number, reset: number }
 */
export async function checkRateLimit(ip: string, type: "global" | "enterprise" = "global") {
  const limiter = type === "enterprise" ? enterpriseApiRateLimit : globalApiRateLimit;
  
  if (!limiter) {
    // If Redis is not configured, bypass rate limiting
    return { success: true, limit: 100, remaining: 99, reset: 0 };
  }

  return await limiter.limit(ip);
}
