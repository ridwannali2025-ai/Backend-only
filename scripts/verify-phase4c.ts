// Backend-only scripts/verify-phase4c.ts
// Verification script for Phase 4C context loading

import { loadContext } from "../lib/context";

let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

console.log("=== Phase 4C Verification ===\n");

assert(typeof loadContext === "function", "loadContext() export exists");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✓ Phase 4C checks passed!");
  process.exit(0);
}
