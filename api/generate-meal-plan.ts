import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { loadContext } from "../lib/context";
import { selectModel, type ModelTier, type TaskType } from "../lib/model-router";
import { evaluateSafety } from "../lib/safety-guardrails";
import { ok, fail, failUI, failUIWithOriginalCode, generateRequestId, jsonResponse } from "../lib/response";
import type { ResponseEnvelope } from "../lib/response";
import { mapSafetyCodeToUIMessageCode, getUIMessage } from "../lib/ui-messages";
import { logRequestStart, logRequestEnd, getEnvironment } from "../lib/logger";
import { getUserIdFromRequest } from "../lib/supabase";
import { checkRegenerationLimit } from "../lib/regeneration-tracker";

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
  is_regeneration?: boolean;
}

const ROUTE = "/api/generate-meal-plan";
const { maxBodyBytes } = ROUTE_GUARDRAILS[ROUTE];
const TASK_TYPE: TaskType = "generate_meal_plan";
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
  let isRegeneration = false;

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
    return failUI(405, ROUTE, requestId, "method_not_allowed", "Only POST method allowed");
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
    return failUI(503, ROUTE, requestId, "ai_unavailable", "AI features are temporarily unavailable. Please try again later.");
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
    return failUI(413, ROUTE, requestId, "payload_too_large", "Request body exceeds size limit.");
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

  const selection = selectModel({ route: ROUTE, taskType: TASK_TYPE, tier: MODEL_TIER });
  const FALLBACK_MODEL = selection.fallbackModel;
  const MAX_OUTPUT_TOKENS = selection.maxOutputTokens;

  // Parse JSON body safely
  let body: MealPlanRequest;
  try {
    body = (await req.json()) as MealPlanRequest;
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
    return failUI(400, ROUTE, requestId, "bad_request", "Invalid JSON body", {
      model_used: selection.modelUsed,
    });
  }

  isRegeneration = body.is_regeneration === true;

  // Check regeneration limit
  const regenerationCheck = await checkRegenerationLimit(userId, isRegeneration);
  if (!regenerationCheck.allowed) {
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
      httpStatus: 200,
      latencyMs,
      errorCode: "regeneration_limit_exceeded",
      errorMessage: regenerationCheck.message,
      isRegeneration,
    });
    const uiMessage = getUIMessage("regen_coaching");
    return ok(
      ROUTE,
      {
        message: regenerationCheck.message,
        regeneration_blocked: true,
        ui: {
          title: uiMessage.title,
          message: uiMessage.message,
          code: "regen_coaching",
        },
      },
      undefined,
      requestId
    );
  }

  const context = await loadContext({ req, route: ROUTE });
  const contextSummary = {
    program_present: Boolean(context.active_program),
    sessions_14d_count: context.workouts_14d.sessions.length,
    sets_14d_count: context.workouts_14d.sets.length,
    meals_7d_count: context.meals_7d.length,
    weight_30d_count: context.weight_30d.length,
  };
  // Check safety guardrails BEFORE calling OpenAI
  const safety = evaluateSafety({ route: ROUTE, taskType: TASK_TYPE, body });
  if (!safety.allowed) {
    const latencyMs = Date.now() - startTime;
    const errorCode = safety.ui?.code || "safety_blocked";
    const errorMessage = safety.reason || safety.ui?.message || "Request blocked by safety guardrails";
    
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
      errorCode,
      errorMessage,
      isRegeneration,
    });
    
    // Return HTTP 422 with error.ui from safety result
    if (safety.ui) {
      const envelope: ResponseEnvelope = {
        request_id: requestId,
        route: ROUTE,
        model_used: selection.modelUsed,
        tokens_in: null,
        tokens_out: null,
        cost_estimate_usd: null,
        result: null,
        error: {
          code: safety.ui.code,
          message: errorMessage,
          ui: {
            title: safety.ui.title,
            message: safety.ui.message,
            code: safety.ui.code,
          },
        },
      };
      return jsonResponse(envelope, 422);
    }
    
    // Fallback if ui is not provided
    return failUI(422, ROUTE, requestId, "safety_aggressive_cut", errorMessage, {
      model_used: selection.modelUsed,
    });
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
    isRegeneration,
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
      isRegeneration,
    });
    return failUI(500, ROUTE, requestId, "server_error", "An unexpected error occurred");
  }
}
