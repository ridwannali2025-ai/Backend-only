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
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL as string,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN as string,
};

// Only throw if AI is enabled but key is missing (skip during verification)
// Only throw if AI is enabled but key is missing (skip during verification/test)
if (env.AI_ENABLED && !env.OPENAI_API_KEY) {
  const isVerification = typeof process !== "undefined" && process.argv.some(arg => arg.includes("verify"));
  if (!isVerification && process.env.NODE_ENV !== "test") {
    throw new Error("Missing OPENAI_API_KEY in environment");
  }
}











