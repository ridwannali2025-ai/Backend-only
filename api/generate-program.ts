import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { loadContext } from "../lib/context";
import { selectModel, type ModelTier, type TaskType } from "../lib/model-router";
import { evaluateSafety } from "../lib/safety-guardrails";
import { ok, fail, generateRequestId } from "../lib/response";
import { logRequestStart, logRequestEnd, getEnvironment } from "../lib/logger";
import { getUserIdFromRequest } from "../lib/supabase";

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

  // Generate request_id and start timer early
  const requestId = generateRequestId();
  const startTime = logRequestStart();
  const userId = getUserIdFromRequest(req);
  const environment = getEnvironment();

  try {

  // Only allow POST
  if (req.method !== "POST") {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "bad_request",
      httpStatus: 405,
      latencyMs,
      errorCode: "method_not_allowed",
      errorMessage: "Only POST method allowed",
    });
    return fail(ROUTE, "method_not_allowed", "Only POST method allowed", 405, undefined, requestId);
  }

  if (!env.AI_ENABLED) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "guardrail_block",
      httpStatus: 503,
      latencyMs,
      errorCode: "service_unavailable",
      errorMessage: "AI features are temporarily unavailable. Please try again later.",
    });
    return fail(
      ROUTE,
      "service_unavailable",
      "AI features are temporarily unavailable. Please try again later.",
      503,
      undefined,
      requestId
    );
  }

  if (isPayloadTooLarge(req, maxBodyBytes)) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "guardrail_block",
      httpStatus: 413,
      latencyMs,
      errorCode: "payload_too_large",
      errorMessage: "Request body exceeds size limit.",
    });
    return fail(
      ROUTE,
      "payload_too_large",
      "Request body exceeds size limit.",
      413,
      undefined,
      requestId
    );
  }

  // Check rate limit
  const rateLimitResponse = await checkRateLimitMiddleware(ROUTE, req);
  if (rateLimitResponse) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "rate_limited",
      httpStatus: 429,
      latencyMs,
      errorCode: "rate_limit_exceeded",
      errorMessage: "Rate limit exceeded",
    });
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
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: selection.modelUsed,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "bad_request",
      httpStatus: 400,
      latencyMs,
      errorCode: "bad_request",
      errorMessage: "Invalid JSON body",
    });
    return fail(ROUTE, "bad_request", "Invalid JSON body", 400, {
      model_used: selection.modelUsed,
    }, requestId);
  }

  const safety = evaluateSafety({ route: ROUTE, taskType: TASK_TYPE, body });
  if (!safety.allowed) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: selection.modelUsed,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "guardrail_block",
      httpStatus: 422,
      latencyMs,
      errorCode: safety.code,
      errorMessage: safety.message,
    });
    return fail(ROUTE, safety.code, safety.message, 422, {
      model_used: selection.modelUsed,
    }, requestId);
  }

  // Phase 4A: Return stub response
  const latencyMs = Date.now() - startTime;
  await logRequestEnd({
    requestId,
    route: ROUTE,
    userId,
    environment,
    modelUsed: selection.modelUsed,
    tokensIn: null,
    tokensOut: null,
    costEstimateUsd: null,
    status: "ok",
    httpStatus: 200,
    latencyMs,
    errorCode: null,
    errorMessage: null,
  });
  return ok(
    ROUTE,
    {
      stub: true,
      model_tier: MODEL_TIER,
      task_type: TASK_TYPE,
      fallback_model: FALLBACK_MODEL,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      changes_made: false,
      reason_for_change: "No changes applied in stub response.",
      context_summary: contextSummary,
    },
    { model_used: selection.modelUsed },
    requestId
  );
  } catch (error) {
    // Unexpected exception - log and return error
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "error",
      httpStatus: 500,
      latencyMs,
      errorCode: "internal_error",
      errorMessage,
    });
    return fail(ROUTE, "internal_error", "An unexpected error occurred", 500, undefined, requestId);
  }
}
