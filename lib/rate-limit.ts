/**
 * In-memory rate limiter for API routes.
 * Tracks request counts per IP address with configurable windows.
 *
 * Usage:
 *   import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
 *   const limited = rateLimit(request, RATE_LIMITS.API);
 *   if (limited) return limited; // 429 response
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (sufficient for single-instance)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export const RATE_LIMITS = {
  // General API: 100 requests per minute
  API: { windowMs: 60_000, maxRequests: 100, message: 'Too many requests. Please try again later.' },
  // Auth endpoints: 60 requests per minute (login, callback, session check)
  // SWR revalidation + retry on error multiplies these, so generous limit needed
  AUTH: { windowMs: 60_000, maxRequests: 60, message: 'Too many authentication attempts. Please wait.' },
  // Write operations: 30 requests per minute
  WRITE: { windowMs: 60_000, maxRequests: 30, message: 'Too many write requests. Please slow down.' },
  // Strict: 5 requests per minute (password reset, etc.)
  STRICT: { windowMs: 60_000, maxRequests: 5, message: 'Rate limit exceeded. Please wait before retrying.' },
} as const;

function getClientIp(request: Request): string {
  // Cloudflare sets these headers. x-real-ip is set by Cloudflare edge nodes
  // and is more reliable than x-forwarded-for which can be spoofed.
  // On Cloudflare: CF-Connecting-IP is the original visitor IP.
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // x-forwarded-for: first IP is the original client, rest are proxies
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  // Fallback (won't work in all environments)
  return 'unknown';
}

export function checkRateLimit(request: Request, config: RateLimitConfig): { limited: boolean; remaining: number; resetAt: number } {
  const ip = getClientIp(request);
  const key = `${ip}:${config.windowMs}`;
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + config.windowMs };
    store.set(key, entry);
    return { limited: false, remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  return { limited: false, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export function rateLimit(request: Request, config: RateLimitConfig): Response | null {
  const result = checkRateLimit(request, config);

  if (result.limited) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return new Response(
      JSON.stringify({ error: config.message, retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Express/connect-style middleware for use in Next.js route handlers.
 * Returns headers to include in the response.
 */
export function getRateLimitHeaders(request: Request, config: RateLimitConfig): Record<string, string> {
  const result = checkRateLimit(request, config);
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
}
