/**
 * Simple in-memory rate limiter for API routes.
 *
 * Tracks request counts per IP within a sliding window.
 * For production with multiple instances, use Redis/Vercel KV instead.
 */

const hits = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitConfig {
  /** Max requests allowed within the window */
  max: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const defaultConfig: RateLimitConfig = {
  max: 50,
  windowSeconds: 60,
};

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = defaultConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    // First request or window expired → start new window
    hits.set(ip, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowSeconds * 1000 };
  }

  entry.count++;
  const remaining = Math.max(0, config.max - entry.count);
  const allowed = entry.count <= config.max;

  return { allowed, remaining, resetAt: entry.resetAt };
}

/**
 * Clean up expired entries periodically to prevent memory leaks.
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip);
  }
}, 60_000);
