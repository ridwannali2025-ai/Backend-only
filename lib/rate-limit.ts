// Backend-only lib/rate-limit.ts
// Upstash Redis rate limiting for Vercel Edge functions

import { env } from "./env";

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number; // e.g., 60 for per-minute, 86400 for per-day
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/chat": { maxRequests: 30, windowSeconds: 60 }, // 30/min
  "/api/weekly-checkin": { maxRequests: 5, windowSeconds: 86400 }, // 5/day
  "/api/generate-program": { maxRequests: 3, windowSeconds: 86400 }, // 3/day
  "/api/generate-meal-plan": { maxRequests: 3, windowSeconds: 86400 }, // 3/day
  "/api/analyze-progress": { maxRequests: 10, windowSeconds: 86400 }, // 10/day
} as const;

/**
 * Get user identifier from request
 * Prefers x-user-id header, falls back to IP from x-forwarded-for
 */
function getUserIdentifier(req: Request): string {
  const userId = req.headers.get("x-user-id");
  if (userId) {
    return userId.trim();
  }

  // Fallback to IP from x-forwarded-for
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const firstIp = forwardedFor.split(",")[0].trim();
    return firstIp;
  }

  // Last resort: use a default identifier
  return "unknown";
}

/**
 * Check rate limit using Upstash Redis REST API
 * Returns null if allowed, or error message if rate limited
 */
async function checkRateLimit(
  route: string,
  userIdentifier: string,
  config: RateLimitConfig
): Promise<string | null> {
  // Skip rate limiting if Redis is not configured
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const key = `ratelimit:${route}:${userIdentifier}`;

  try {
    // Use Redis pipeline: INCR key, then EXPIRE if it's the first request
    // This is atomic and efficient
    const commands = [
      ["INCR", key],
      ["EXPIRE", key, config.windowSeconds.toString()],
    ];

    const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      // If Redis fails, allow the request (fail open)
      console.error("Rate limit check failed:", response.statusText);
      return null;
    }

    const results = (await response.json()) as Array<{ result: number }>;
    const count = results[0]?.result;

    if (count && count > config.maxRequests) {
      return `Rate limit exceeded. Maximum ${config.maxRequests} request${config.maxRequests > 1 ? "s" : ""} per ${formatWindow(config.windowSeconds)}.`;
    }

    return null; // Allowed
  } catch (error) {
    // Fail open on errors
    console.error("Rate limit check error:", error);
    return null;
  }
}

/**
 * Format window seconds into human-readable string
 */
function formatWindow(seconds: number): string {
  if (seconds === 60) return "minute";
  if (seconds === 3600) return "hour";
  if (seconds === 86400) return "day";
  return `${seconds} seconds`;
}

/**
 * Rate limit middleware
 * Returns Response if rate limited, null if allowed
 */
export async function checkRateLimitMiddleware(
  route: string,
  req: Request
): Promise<Response | null> {
  const config = RATE_LIMITS[route];
  if (!config) {
    // No rate limit configured for this route
    return null;
  }

  const userIdentifier = getUserIdentifier(req);
  const errorMessage = await checkRateLimit(route, userIdentifier, config);

  if (errorMessage) {
    // Import failUI dynamically to avoid circular dependency
    const { failUI } = await import("./response");
    const { generateRequestId } = await import("./response");
    const requestId = generateRequestId();
    // Determine if this is chat or action based on route
    const code = route === "/api/chat" ? "rate_limited_chat" : "rate_limited_action";
    return failUI(429, route, requestId, code, errorMessage);
  }

  return null; // Allowed
}

