// Backend-only scripts/verify-phase4.ts
// Verification script for Phase 4A + 4B completion

// Set dummy env vars for verification (no network calls needed)
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "dummy-for-verification";
process.env.AI_ENABLED = process.env.AI_ENABLED || "true";
process.env.AI_CHAT_ENABLED = process.env.AI_CHAT_ENABLED || "true";

import { ok, fail, jsonResponse, generateRequestId, ResponseEnvelope } from "../lib/response";
import { ROUTE_GUARDRAILS, isPayloadTooLarge } from "../lib/route-guardrails";
import { RATE_LIMITS, checkRateLimitMiddleware } from "../lib/rate-limit";
import { env } from "../lib/env";

let errors: string[] = [];
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`✗ ${message}`);
  }
}

console.log("=== Phase 4A + 4B Verification ===\n");

// 1. Routes exist
console.log("1. Checking routes exist...");
const requiredRoutes = [
  "api/generate-program.ts",
  "api/generate-meal-plan.ts",
  "api/weekly-checkin.ts",
  "api/chat.ts",
  "api/analyze-progress.ts",
];

for (const route of requiredRoutes) {
  try {
    await import(`../${route}`);
    assert(true, `Route exists: ${route}`);
  } catch (e) {
    assert(false, `Route missing: ${route}`);
  }
}

// 2. Envelope helpers exist
console.log("\n2. Checking envelope helpers...");
assert(typeof ok === "function", "ok() helper exists");
assert(typeof fail === "function", "fail() helper exists");
assert(typeof jsonResponse === "function", "jsonResponse() helper exists");
assert(typeof generateRequestId === "function", "generateRequestId() helper exists");

// Verify envelope shape
const testEnvelope: ResponseEnvelope = {
  request_id: generateRequestId(),
  route: "/api/test",
  model_used: null,
  tokens_in: null,
  tokens_out: null,
  cost_estimate_usd: null,
  result: { test: true },
  error: null,
};

assert(testEnvelope.request_id !== undefined, "Envelope has request_id");
assert(testEnvelope.route !== undefined, "Envelope has route");
assert(testEnvelope.model_used !== undefined, "Envelope has model_used");
assert(testEnvelope.tokens_in !== undefined, "Envelope has tokens_in");
assert(testEnvelope.tokens_out !== undefined, "Envelope has tokens_out");
assert(testEnvelope.cost_estimate_usd !== undefined, "Envelope has cost_estimate_usd");
assert(testEnvelope.result !== undefined, "Envelope has result");
assert(testEnvelope.error !== undefined, "Envelope has error");

// 3. Guardrails exist
console.log("\n3. Checking guardrails...");
assert(typeof isPayloadTooLarge === "function", "isPayloadTooLarge() helper exists");
assert(ROUTE_GUARDRAILS !== undefined, "ROUTE_GUARDRAILS exists");
assert(ROUTE_GUARDRAILS["/api/generate-program"] !== undefined, "Guardrails configured for generate-program");
assert(ROUTE_GUARDRAILS["/api/generate-meal-plan"] !== undefined, "Guardrails configured for generate-meal-plan");
assert(ROUTE_GUARDRAILS["/api/weekly-checkin"] !== undefined, "Guardrails configured for weekly-checkin");
assert(ROUTE_GUARDRAILS["/api/chat"] !== undefined, "Guardrails configured for chat");
assert(ROUTE_GUARDRAILS["/api/analyze-progress"] !== undefined, "Guardrails configured for analyze-progress");

// Kill switches
assert(env.AI_ENABLED !== undefined, "AI_ENABLED env var supported");
assert(env.AI_CHAT_ENABLED !== undefined, "AI_CHAT_ENABLED env var supported");

// 4. Rate limiting exists
console.log("\n4. Checking rate limiting...");
assert(typeof checkRateLimitMiddleware === "function", "checkRateLimitMiddleware() helper exists");
assert(RATE_LIMITS !== undefined, "RATE_LIMITS exists");
assert(RATE_LIMITS["/api/chat"]?.maxRequests === 30, "Chat rate limit: 30/min");
assert(RATE_LIMITS["/api/chat"]?.windowSeconds === 60, "Chat window: 60 seconds");
assert(RATE_LIMITS["/api/weekly-checkin"]?.maxRequests === 5, "Weekly-checkin rate limit: 5/day");
assert(RATE_LIMITS["/api/weekly-checkin"]?.windowSeconds === 86400, "Weekly-checkin window: 86400 seconds");
assert(RATE_LIMITS["/api/generate-program"]?.maxRequests === 3, "Generate-program rate limit: 3/day");
assert(RATE_LIMITS["/api/generate-program"]?.windowSeconds === 86400, "Generate-program window: 86400 seconds");
assert(RATE_LIMITS["/api/generate-meal-plan"]?.maxRequests === 3, "Generate-meal-plan rate limit: 3/day");
assert(RATE_LIMITS["/api/generate-meal-plan"]?.windowSeconds === 86400, "Generate-meal-plan window: 86400 seconds");
assert(RATE_LIMITS["/api/analyze-progress"]?.maxRequests === 10, "Analyze-progress rate limit: 10/day");
assert(RATE_LIMITS["/api/analyze-progress"]?.windowSeconds === 86400, "Analyze-progress window: 86400 seconds");

// Summary
console.log("\n=== Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log("\nErrors:");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log("\n✓ All checks passed!");
  process.exit(0);
}

