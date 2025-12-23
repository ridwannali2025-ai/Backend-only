import { env } from "../lib/env";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { checkRateLimitMiddleware } from "../lib/rate-limit";
import { selectModel, type ModelTier, type TaskType } from "../lib/model-router";
import { evaluateSafety } from "../lib/safety-guardrails";
import { ok, fail } from "../lib/response";
import { getUserIdFromRequest } from "../lib/supabase";

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

  if (!env.AI_CHAT_ENABLED) {
    return fail(
      ROUTE,
      "service_unavailable",
      "Chat is temporarily unavailable. Please try again later.",
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

  const selection = selectModel({ route: ROUTE, taskType: TASK_TYPE, tier: MODEL_TIER });

  // Parse JSON body safely
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return fail(ROUTE, "bad_request", "Invalid JSON body", 400, {
      model_used: selection.modelUsed,
    });
  }

  if (!Array.isArray(body.messages)) {
    return fail(ROUTE, "bad_request", "messages must be an array.", 400, {
      model_used: selection.modelUsed,
    });
  }

  const invalidMessage = body.messages.find((message) => {
    if (!message || typeof message !== "object") {
      return true;
    }
    return typeof message.role !== "string" || typeof message.content !== "string";
  });
  if (invalidMessage) {
    return fail(
      ROUTE,
      "bad_request",
      "messages must be an array of { role, content } objects.",
      400,
      { model_used: selection.modelUsed }
    );
  }

  const headerUserId = getUserIdFromRequest(req);
  const bodyUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  const resolvedUserId = headerUserId ?? (bodyUserId.length > 0 ? bodyUserId : null);
  if (!resolvedUserId) {
    return fail(
      ROUTE,
      "bad_request",
      "Missing user identity. Provide Authorization Bearer token, x-user-id header, or body.userId.",
      400,
      { model_used: selection.modelUsed }
    );
  }

  const safety = evaluateSafety({ route: ROUTE, taskType: TASK_TYPE, body });
  if (!safety.allowed) {
    return fail(ROUTE, safety.code, safety.message, 422, {
      model_used: selection.modelUsed,
    });
  }

  // Phase 4A: Return stub response (non-streaming stub)
  return ok(
    ROUTE,
    {
      reply: "ok",
      received_messages_count: body.messages.length,
      user_id: resolvedUserId,
    },
    { model_used: selection.modelUsed }
  );
}
