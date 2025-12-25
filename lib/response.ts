// Backend-only lib/response.ts
// Standardized response envelope for all API endpoints

import { getUIMessage, type UIMessageCode } from "./ui-messages";

export interface ResponseEnvelope {
  request_id: string;
  route: string;
  model_used: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_estimate_usd: number | null;
  result: any | null;
  error: { code: string; message: string; ui?: { title: string; message: string; code: string } } | null;
}

export interface ResponseMeta {
  model_used?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_estimate_usd?: number;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(envelope: ResponseEnvelope, status: number = 200): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * Create a success response envelope
 */
export function ok(
  route: string,
  result: any,
  meta?: ResponseMeta,
  requestId?: string
): Response {
  const envelope: ResponseEnvelope = {
    request_id: requestId ?? generateRequestId(),
    route,
    model_used: meta?.model_used ?? null,
    tokens_in: meta?.tokens_in ?? null,
    tokens_out: meta?.tokens_out ?? null,
    cost_estimate_usd: meta?.cost_estimate_usd ?? null,
    result,
    error: null,
  };
  return jsonResponse(envelope, 200);
}

/**
 * Create an error response envelope
 */
export function fail(
  route: string,
  code: string,
  message: string,
  status: number = 400,
  meta?: ResponseMeta,
  requestId?: string
): Response {
  const envelope: ResponseEnvelope = {
    request_id: requestId ?? generateRequestId(),
    route,
    model_used: meta?.model_used ?? null,
    tokens_in: meta?.tokens_in ?? null,
    tokens_out: meta?.tokens_out ?? null,
    cost_estimate_usd: meta?.cost_estimate_usd ?? null,
    result: null,
    error: { code, message },
  };
  return jsonResponse(envelope, status);
}

/**
 * Create an error response envelope with UI message
 */
export function failUI(
  status: number,
  route: string,
  requestId: string,
  code: UIMessageCode,
  internalMessage?: string,
  meta?: ResponseMeta
): Response {
  const uiMessage = getUIMessage(code);
  const envelope: ResponseEnvelope = {
    request_id: requestId,
    route,
    model_used: meta?.model_used ?? null,
    tokens_in: meta?.tokens_in ?? null,
    tokens_out: meta?.tokens_out ?? null,
    cost_estimate_usd: meta?.cost_estimate_usd ?? null,
    result: null,
    error: {
      code,
      message: internalMessage ?? uiMessage.message,
      ui: {
        title: uiMessage.title,
        message: uiMessage.message,
        code,
      },
    },
  };
  return jsonResponse(envelope, status);
}

/**
 * Create an error response envelope with UI message, preserving original error code
 */
export function failUIWithOriginalCode(
  status: number,
  route: string,
  requestId: string,
  originalCode: string,
  uiCode: UIMessageCode,
  internalMessage?: string,
  meta?: ResponseMeta
): Response {
  const uiMessage = getUIMessage(uiCode);
  const envelope: ResponseEnvelope = {
    request_id: requestId,
    route,
    model_used: meta?.model_used ?? null,
    tokens_in: meta?.tokens_in ?? null,
    tokens_out: meta?.tokens_out ?? null,
    cost_estimate_usd: meta?.cost_estimate_usd ?? null,
    result: null,
    error: {
      code: originalCode,
      message: internalMessage ?? uiMessage.message,
      ui: {
        title: uiMessage.title,
        message: uiMessage.message,
        code: uiCode,
      },
    },
  };
  return jsonResponse(envelope, status);
}

