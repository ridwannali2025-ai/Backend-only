import { createAdminSupabaseClient } from "./supabase";

const REGENERATION_LIMIT = 10;
const REGENERATION_WINDOW_HOURS = 24;

/**
 * Routes that count as regenerations
 */
const REGENERATION_ROUTES = [
  "/api/generate-program",
  "/api/generate-meal-plan",
] as const;

type RegenerationRoute = typeof REGENERATION_ROUTES[number];

/**
 * Check if a route is a regeneration route
 */
export function isRegenerationRoute(route: string): route is RegenerationRoute {
  return REGENERATION_ROUTES.includes(route as RegenerationRoute);
}

/**
 * Get the count of successful regenerations for a user in the last 24 hours
 * Returns 0 if user is null or if there's an error (fail-open)
 */
export async function getRegenerationCount(userId: string | null): Promise<number> {
  if (!userId) {
    return 0;
  }

  const client = createAdminSupabaseClient();
  if (!client) {
    return 0;
  }

  try {
    const since24h = new Date();
    since24h.setHours(since24h.getHours() - REGENERATION_WINDOW_HOURS);
    const since24hIso = since24h.toISOString();

    const { count, error } = await client
      .from("ai_request_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("route", REGENERATION_ROUTES)
      .eq("is_regeneration", true)
      .eq("status", "ok")
      .gte("created_at", since24hIso);

    if (error) {
      console.warn("Failed to get regeneration count:", error.message);
      return 0; // Fail-open: allow if we can't check
    }

    return count ?? 0;
  } catch (error) {
    console.warn("Exception while getting regeneration count:", error);
    return 0; // Fail-open: allow if we can't check
  }
}

/**
 * Check if regeneration is allowed for a user
 * Returns { allowed: true } if allowed, or { allowed: false, message: string } if blocked
 */
export async function checkRegenerationLimit(
  userId: string | null,
  isRegeneration: boolean
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  // Regeneration is an explicit intent flag set by the chat flow.
  if (!isRegeneration) {
    return { allowed: true };
  }

  const count = await getRegenerationCount(userId);

  if (count >= REGENERATION_LIMIT) {
    return {
      allowed: false,
      message:
        "We’ve made a lot of changes already. Constantly switching programs won’t help your progress — consistency is how results happen. Let’s commit to this plan for a bit and reassess soon.",
    };
  }

  return { allowed: true };
}
