import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { ok, fail } from "../lib/response";

export const config = { runtime: "edge" };

interface MealPlanRequest {
  userId?: string;
  caloriesPerDay?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatsGrams?: number;
  dietaryRestrictions?: string[];
  avoidFoods?: string[];
  preferences?: string[];
}

const ROUTE = "/api/generate-meal-plan";
const { maxBodyBytes, maxOutputTokens } = ROUTE_GUARDRAILS[ROUTE];

export default async function handler(req: Request): Promise<Response> {
  // Handle OPTIONS for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return fail(ROUTE, "method_not_allowed", "Only POST method allowed", 405);
  }

  if (!env.AI_ENABLED) {
    return fail(
      ROUTE,
      "service_unavailable",
      "AI features are temporarily unavailable. Please try again later.",
      503
    );
  }

  if (isPayloadTooLarge(req, maxBodyBytes)) {
    return fail(
      ROUTE,
      "payload_too_large",
      "Request body exceeds size limit.",
      413
    );
  }

  // Check rate limit
  const rateLimitResponse = await checkRateLimitMiddleware(ROUTE, req);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Parse JSON body safely
  let body: MealPlanRequest;
  try {
    body = (await req.json()) as MealPlanRequest;
  } catch {
    return fail(ROUTE, "bad_request", "Invalid JSON body", 400);
  }

  // Phase 4A: Return stub response
  return ok(ROUTE, {
    status: "stub",
    message: "generate-meal-plan wired",
    meal_plan_version: 1,
  });
}
