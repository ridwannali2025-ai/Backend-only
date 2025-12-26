// Backend-only scripts/guardrail_allow.test.ts
// Smoke test: verify safe cooking requests are allowed

import { evaluateSafety } from "../lib/safety-guardrails";

const testPayload = {
  messages: [
    {
      role: "user",
      content: "step by step how to cook ground turkey",
    },
  ],
};

const result = evaluateSafety({
  route: "/api/chat",
  taskType: "chat",
  body: testPayload,
});

if (result.allowed) {
  console.log("PASS: Safe cooking request was allowed");
  process.exit(0);
} else {
  console.error(`FAIL: Safe cooking request was blocked. Code: ${result.code}, Message: ${result.message}`);
  process.exit(1);
}

