// Backend-only scripts/verify-phase4d.ts
// Verification script for Phase 4D model routing

import { env } from "../lib/env";
import { selectModel } from "../lib/model-router";
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

console.log("=== Phase 4D Verification ===\n");

const requiredEnvKeys = [
  "MODEL_BRAIN",
  "MODEL_PLANNER",
  "MODEL_MOUTH",
  "MODEL_ANALYST",
  "MODEL_FALLBACK",
];

requiredEnvKeys.forEach((key) => {
  assert(Object.prototype.hasOwnProperty.call(env, key), `env exposes ${key}`);
});

const selection = selectModel({ route: "/api/chat", taskType: "chat", tier: "mouth" });
assert(typeof selection.modelUsed === "string" && selection.modelUsed.length > 0, "selectModel returns modelUsed");

async function assertModelUsed(handler: (req: Request) => Promise<Response>, route: string) {
  const req = new Request(`http://localhost${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const res = await handler(req);
  const payload = (await res.json()) as { model_used?: string };
  assert(typeof payload.model_used === "string" && payload.model_used.length > 0, `${route} sets model_used`);
}

await assertModelUsed(generateProgram, "/api/generate-program");
await assertModelUsed(generateMealPlan, "/api/generate-meal-plan");
await assertModelUsed(weeklyCheckin, "/api/weekly-checkin");
await assertModelUsed(chat, "/api/chat");
await assertModelUsed(analyzeProgress, "/api/analyze-progress");

console.log("\n=== Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✓ Phase 4D checks passed!");
  process.exit(0);
}
