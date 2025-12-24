function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  AI_ENABLED: parseBoolean(process.env.AI_ENABLED, true),
  AI_CHAT_ENABLED: parseBoolean(process.env.AI_CHAT_ENABLED, true),
  AI_LOGGING_ENABLED: parseBoolean(process.env.AI_LOGGING_ENABLED, true),
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL as string,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN as string,
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  MODEL_BRAIN: process.env.MODEL_BRAIN as string,
  MODEL_PLANNER: process.env.MODEL_PLANNER as string,
  MODEL_MOUTH: process.env.MODEL_MOUTH as string,
  MODEL_ANALYST: process.env.MODEL_ANALYST as string,
  MODEL_FALLBACK: process.env.MODEL_FALLBACK as string,
};

// Only throw if AI is enabled but key is missing (skip during verification)
// Only throw if AI is enabled but key is missing (skip during verification/test)
if (env.AI_ENABLED && !env.OPENAI_API_KEY) {
  const isVerification = typeof process !== "undefined" && process.argv.some(arg => arg.includes("verify"));
  if (!isVerification && process.env.NODE_ENV !== "test") {
    throw new Error("Missing OPENAI_API_KEY in environment");
  }
}

// Validate SUPABASE_SERVICE_ROLE_KEY only when logging is enabled
if (env.AI_LOGGING_ENABLED && !env.SUPABASE_SERVICE_ROLE_KEY) {
  const isVerification = typeof process !== "undefined" && process.argv.some(arg => arg.includes("verify"));
  if (!isVerification && process.env.NODE_ENV !== "test") {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment (required for AI_LOGGING_ENABLED)");
  }
}









