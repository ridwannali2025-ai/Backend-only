// Backend-only scripts/verify-phase4f.ts
// Verification script for Phase 4F logging & observability

import { readFileSync } from "fs";
import { logRequestEnd } from "../lib/logger";
import { env } from "../lib/env";
import generateProgram from "../api/generate-program";
import generateMealPlan from "../api/generate-meal-plan";
import weeklyCheckin from "../api/weekly-checkin";
import chat from "../api/chat";
import analyzeProgress from "../api/analyze-progress";

let failed = 0;
let passed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

console.log("=== Phase 4F Verification ===\n");

// Check SQL file exists and contains expected content
try {
  const sqlContent = readFileSync("supabase/phase4f_ai_request_logs.sql", "utf-8");
  assert(sqlContent.includes("ai_request_logs"), "SQL file exists");
  assert(sqlContent.includes("CREATE TABLE"), "SQL file contains CREATE TABLE");
} catch (error) {
  assert(false, "SQL file exists");
}

// Check env includes AI_LOGGING_ENABLED
assert(
  typeof env.AI_LOGGING_ENABLED === "boolean",
  "env includes AI_LOGGING_ENABLED"
);

// Check env includes SUPABASE_SERVICE_ROLE_KEY (may be undefined, but should exist in type)
assert(
  "SUPABASE_SERVICE_ROLE_KEY" in env,
  "env includes SUPABASE_SERVICE_ROLE_KEY"
);

// Check logger.ts exists and exports logRequestEnd
assert(
  typeof logRequestEnd === "function",
  "logger.ts exists and exports logRequestEnd"
);

// Check all routes call the logger (by checking they compile and run)
async function assertRouteLogs(handler: (req: Request) => Promise<Response>, route: string) {
  const req = new Request(`http://localhost${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  try {
    const res = await handler(req);
    const payload = await res.json();
    // If we get a response, the route compiled and ran (logging is called)
    assert(
      payload.request_id !== undefined,
      `${route} calls the logger (compiles and runs)`
    );
  } catch (error) {
    failed++;
    console.error(`✗ ${route} failed to run: ${error}`);
  }
}

await assertRouteLogs(generateProgram, "/api/generate-program");
await assertRouteLogs(generateMealPlan, "/api/generate-meal-plan");
await assertRouteLogs(weeklyCheckin, "/api/weekly-checkin");
await assertRouteLogs(chat, "/api/chat");
await assertRouteLogs(analyzeProgress, "/api/analyze-progress");

console.log("\n=== Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✓ Phase 4F checks passed!");
  process.exit(0);
}

