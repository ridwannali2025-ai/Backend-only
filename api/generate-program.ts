import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { loadContext } from "../lib/context";
import { selectModel, type ModelTier, type TaskType } from "../lib/model-router";
import { ok, fail } from "../lib/response";

export const config = { runtime: "edge" };

interface ProgramRequest {
  goal?: string;
  timelineMonths?: number;
  heightCm?: number;
  weightKg?: number;
  age?: number;
  sex?: string;
  activityLevel?: string;
  daysPerWeek?: number;
  experience?: string;
  hasInjuries?: boolean;
  injuryDetails?: string;
  dietaryRestrictions?: string[];
  avoidFoods?: string[];
  pastBlockers?: string[];
  notesFromChat?: string;
}

const ROUTE = "/api/generate-program";
const { maxBodyBytes } = ROUTE_GUARDRAILS[ROUTE];
const TASK_TYPE: TaskType = "generate_program";
const MODEL_TIER: ModelTier = "planner";

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

  const context = await loadContext({ req, route: ROUTE });
  const contextSummary = {
    program_present: Boolean(context.active_program),
    sessions_14d_count: context.workouts_14d.sessions.length,
    sets_14d_count: context.workouts_14d.sets.length,
    meals_7d_count: context.meals_7d.length,
    weight_30d_count: context.weight_30d.length,
  };
  const selection = selectModel({ route: ROUTE, taskType: TASK_TYPE, tier: MODEL_TIER });
  const FALLBACK_MODEL = selection.fallbackModel;
  const MAX_OUTPUT_TOKENS = selection.maxOutputTokens;

  // Parse JSON body safely
  let body: ProgramRequest;
  try {
    body = (await req.json()) as ProgramRequest;
  } catch {
    return fail(ROUTE, "bad_request", "Invalid JSON body", 400, {
      model_used: selection.modelUsed,
    });
  }

  // Phase 4A: Return stub response
  return ok(
    ROUTE,
    {
      stub: true,
      model_tier: MODEL_TIER,
      task_type: TASK_TYPE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      context_summary: contextSummary,
    },
    { model_used: selection.modelUsed }
  );
}
