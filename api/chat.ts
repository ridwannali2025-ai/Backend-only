import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { selectModel, type ModelTier, type TaskType } from "../lib/model-router";
import { evaluateSafety } from "../lib/safety-guardrails";
import { ok, fail, generateRequestId } from "../lib/response";
import { getUserIdFromRequest } from "../lib/supabase";
import { logRequestStart, logRequestEnd, getEnvironment } from "../lib/logger";

export const config = { runtime: "edge" };

interface ChatRequest {
  userId?: string;
  messages?: Array<{ role: string; content: string }>;
  goal?: string;
  phase?: string;
  summary?: string;
}

const ROUTE = "/api/chat";
const { maxBodyBytes } = ROUTE_GUARDRAILS[ROUTE];
const TASK_TYPE: TaskType = "chat";
const MODEL_TIER: ModelTier = "mouth";

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
  const environment = getEnvironment();

  try {
  // Only allow POST
  if (req.method !== "POST") {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
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
      userId: null,
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

  if (!env.AI_CHAT_ENABLED) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
      environment,
      modelUsed: null,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "guardrail_block",
      httpStatus: 503,
      latencyMs,
      errorCode: "service_unavailable",
      errorMessage: "Chat is temporarily unavailable. Please try again later.",
    });
    return fail(
      ROUTE,
      "service_unavailable",
      "Chat is temporarily unavailable. Please try again later.",
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
      userId: null,
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
      userId: null,
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

  // Parse JSON body safely
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
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

  if (!Array.isArray(body.messages)) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
      environment,
      modelUsed: selection.modelUsed,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "bad_request",
      httpStatus: 400,
      latencyMs,
      errorCode: "bad_request",
      errorMessage: "messages must be an array.",
    });
    return fail(ROUTE, "bad_request", "messages must be an array.", 400, {
      model_used: selection.modelUsed,
    }, requestId);
  }

  const invalidMessage = body.messages.find((message) => {
    if (!message || typeof message !== "object") {
      return true;
    }
    return typeof message.role !== "string" || typeof message.content !== "string";
  });
  if (invalidMessage) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
      environment,
      modelUsed: selection.modelUsed,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "bad_request",
      httpStatus: 400,
      latencyMs,
      errorCode: "bad_request",
      errorMessage: "messages must be an array of { role, content } objects.",
    });
    return fail(
      ROUTE,
      "bad_request",
      "messages must be an array of { role, content } objects.",
      400,
      { model_used: selection.modelUsed },
      requestId
    );
  }

  const headerUserId = getUserIdFromRequest(req);
  const bodyUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  const resolvedUserId = headerUserId ?? (bodyUserId.length > 0 ? bodyUserId : null);
  if (!resolvedUserId) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: null,
      environment,
      modelUsed: selection.modelUsed,
      tokensIn: null,
      tokensOut: null,
      costEstimateUsd: null,
      status: "bad_request",
      httpStatus: 400,
      latencyMs,
      errorCode: "bad_request",
      errorMessage: "Missing user identity. Provide Authorization Bearer token, x-user-id header, or body.userId.",
    });
    return fail(
      ROUTE,
      "bad_request",
      "Missing user identity. Provide Authorization Bearer token, x-user-id header, or body.userId.",
      400,
      { model_used: selection.modelUsed },
      requestId
    );
  }

  const safety = evaluateSafety({ route: ROUTE, taskType: TASK_TYPE, body });
  if (!safety.allowed) {
    const latencyMs = Date.now() - startTime;
    await logRequestEnd({
      requestId,
      route: ROUTE,
      userId: resolvedUserId,
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

  // Phase 4A: Return stub response (non-streaming stub)
  const latencyMs = Date.now() - startTime;
  await logRequestEnd({
    requestId,
    route: ROUTE,
    userId: resolvedUserId,
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
      reply: "ok",
      received_messages_count: body.messages.length,
      user_id: resolvedUserId,
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
      userId: null,
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
