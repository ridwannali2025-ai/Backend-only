// Backend-only scripts/verify-phase4e.ts
// Verification script for Phase 4E safety guardrails

import { evaluateSafety } from "../lib/safety-guardrails";
import generateProgram from "../api/generate-program";
import generateMealPlan from "../api/generate-meal-plan";
import weeklyCheckin from "../api/weekly-checkin";
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

console.log("=== Phase 4E Verification ===\n");

assert(typeof evaluateSafety === "function", "evaluateSafety() export exists");

async function assertChangesFields(handler: (req: Request) => Promise<Response>, route: string) {
  const req = new Request(`http://localhost${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const res = await handler(req);
  const payload = (await res.json()) as { result?: { changes_made?: unknown; reason_for_change?: unknown } };
  assert(payload.result?.changes_made !== undefined, `${route} returns changes_made`);
  assert(payload.result?.reason_for_change !== undefined, `${route} returns reason_for_change`);
}

async function assertGuardrail(handler: (req: Request) => Promise<Response>, route: string) {
  const req = new Request(`http://localhost${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calorieDeficit: 2000 }),
  });
  const res = await handler(req);
  const payload = (await res.json()) as { error?: { code?: string } };
  assert(payload.error?.code === "safety_calorie_deficit", `${route} blocks unsafe deficit`);
}

await assertChangesFields(generateProgram, "/api/generate-program");
await assertChangesFields(generateMealPlan, "/api/generate-meal-plan");
await assertChangesFields(weeklyCheckin, "/api/weekly-checkin");
await assertChangesFields(analyzeProgress, "/api/analyze-progress");

await assertGuardrail(generateProgram, "/api/generate-program");
await assertGuardrail(generateMealPlan, "/api/generate-meal-plan");
await assertGuardrail(weeklyCheckin, "/api/weekly-checkin");
await assertGuardrail(analyzeProgress, "/api/analyze-progress");

console.log("\n=== Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✓ Phase 4E checks passed!");
  process.exit(0);
}
