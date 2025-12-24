import { createAdminSupabaseClient } from "./supabase";
import { env } from "./env";

export type LogStatus = "ok" | "error" | "rate_limited" | "guardrail_block" | "bad_request";

export interface LogRequestParams {
  requestId: string;
  route: string;
  userId: string | null;
  environment: string | null;
  modelUsed: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costEstimateUsd: number | null;
  status: LogStatus;
  httpStatus: number;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Start timing a request
 * Returns the start time in milliseconds
 */
export function logRequestStart(): number {
  return Date.now();
}

/**
 * Log a completed request to Supabase
 * Fail-open: if logging fails, do not throw or affect the request
 */
export async function logRequestEnd(params: LogRequestParams): Promise<void> {
  // Skip logging if disabled or service role key missing
  if (!env.AI_LOGGING_ENABLED || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const client = createAdminSupabaseClient();
  if (!client) {
    return;
  }

  try {
    const { error } = await client.from("ai_request_logs").insert({
      request_id: params.requestId,
      route: params.route,
      user_id: params.userId,
      environment: params.environment,
      model_used: params.modelUsed,
      tokens_in: params.tokensIn,
      tokens_out: params.tokensOut,
      cost_estimate_usd: params.costEstimateUsd,
      status: params.status,
      http_status: params.httpStatus,
      latency_ms: params.latencyMs,
      error_code: params.errorCode,
      error_message: params.errorMessage,
    });

    if (error) {
      // Fail-open: log to console but don't throw
      console.warn("Failed to log request to Supabase:", error.message);
    }
  } catch (error) {
    // Fail-open: log to console but don't throw
    console.warn("Exception while logging request:", error);
  }
}

/**
 * Get environment string from VERCEL_ENV
 */
export function getEnvironment(): string | null {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development") {
    return vercelEnv;
  }
  return null;
}

