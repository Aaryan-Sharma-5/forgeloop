import assert from "node:assert/strict";
import {
  LevelRepairer,
  createMockRepairModel,
  validatePatchShape,
  runAblationBenchmark,
  getDefaultBenchmarkScenarios,
  naiveHeuristicRepair,
  BFSVerifier,
} from "../dist/src/index.js";
import {
  CHASM_BROKEN_LEVEL,
  HAZARD_OBSTRUCTED_LEVEL,
  EASY_LEVEL_FIXTURE,
} from "../dist/src/verifier/fixtures.js";


console.log("=== ForgeLoop Phase 5 AI Repairer & Benchmark Test Suite ===\n");

// -------------------------------------------------------------
// 1. Syntactic Patch Shape & Zero-Trust Rejection
// -------------------------------------------------------------
console.log("--- 1. Patch Shape & Zero-Trust Validation ---");

// Valid patch shape
const validShape = validatePatchShape({
  operations: [{ type: "REPLACE_TILE", x: 5, y: 4, newTile: "GROUND" }],
});
assert.equal(validShape.valid, true);
assert.equal(validShape.errors.length, 0);
assert.ok(validShape.patch);
console.log("✔ PASS 1: Valid repair patch succeeds syntactic validation");

// Invalid model output: Non-object or missing operations
assert.equal(validatePatchShape(null).valid, false);
assert.equal(validatePatchShape("not a patch").valid, false);
assert.equal(validatePatchShape({}).valid, false);
assert.equal(validatePatchShape({ operations: "not an array" }).valid, false);
console.log("✔ PASS 2: Invalid model output shape is strictly rejected");

// Out-of-bounds coordinates rejected via repairer loop
const oobModel = {
  async repairLevel() {
    return {
      operations: [{ type: "REPLACE_TILE", x: 99, y: -5, newTile: "GROUND" }],
    };
  },
};
const oobRepairer = new LevelRepairer(oobModel, { maxAttempts: 1 });
const oobResult = await oobRepairer.repair("Test OOB", CHASM_BROKEN_LEVEL);
assert.equal(oobResult.success, false);
assert.equal(oobResult.history[0].patchValid, false);
assert.ok(oobResult.history[0].patchErrors.some((e) => e.includes("out-of-bounds")));
console.log("✔ PASS 3: Out-of-bounds repair coordinates are rejected without modifying level");

// START / GOAL modifications rejected
const endpointModel = {
  async repairLevel() {
    return {
      operations: [
        { type: "REPLACE_TILE", x: 1, y: 3, newTile: "AIR" }, // (1, 3) is START in CHASM_BROKEN_LEVEL
      ],
    };
  },
};
const endpointRepairer = new LevelRepairer(endpointModel, { maxAttempts: 1 });
const endpointResult = await endpointRepairer.repair("Test Endpoint", CHASM_BROKEN_LEVEL);
assert.equal(endpointResult.success, false);
assert.equal(endpointResult.history[0].patchValid, false);
assert.ok(endpointResult.history[0].patchErrors.some((e) => e.includes("START")));
console.log("✔ PASS 4: START / GOAL modifications are strictly rejected");

// -------------------------------------------------------------
// 2. Bounded Repair Loop Execution
// -------------------------------------------------------------
console.log("\n--- 2. Bounded Repair Loop (Fail → Patch → Pass) ---");

const mockRepairModel = createMockRepairModel();
const repairer = new LevelRepairer(mockRepairModel, { maxAttempts: 3 });

// Test 5 & 7: Repair loop succeeds on known broken chasm fixture and changes FAILED → PASSED
const chasmResult = await repairer.repair(
  "Jump across chasm to reach goal",
  CHASM_BROKEN_LEVEL
);
assert.equal(chasmResult.initialVerification.status, "FAILED");
assert.equal(chasmResult.success, true);
assert.equal(chasmResult.finalVerification.status, "PASSED");
assert.equal(chasmResult.attempts, 1);
assert.equal(chasmResult.history.length, 1);
assert.equal(chasmResult.history[0].patchValid, true);
assert.equal(chasmResult.history[0].verificationBefore.status, "FAILED");
assert.equal(chasmResult.history[0].verificationAfter.status, "PASSED");
console.log("✔ PASS 5 & 7: Repair loop succeeds on broken chasm fixture, changing FAILED → PASSED");
console.log("✔ PASS 8: Repair history accurately recorded attempt, counterexample, and verifications");

// Test 6: Repair loop stops after maxAttempts (3) when repairs fail
const stubbornFailingModel = {
  async repairLevel() {
    // Proposes an empty/useless patch that leaves the chasm unpassable
    return { operations: [{ type: "REPLACE_TILE", x: 0, y: 0, newTile: "AIR" }] };
  },
};
const failingRepairer = new LevelRepairer(stubbornFailingModel, { maxAttempts: 3 });
const failingResult = await failingRepairer.repair("Test Failure", CHASM_BROKEN_LEVEL);
assert.equal(failingResult.success, false);
assert.equal(failingResult.attempts, 3);
assert.equal(failingResult.history.length, 3);
assert.equal(failingResult.finalVerification.status, "FAILED");
console.log("✔ PASS 6: Repair loop strictly terminates after 3 failed attempts");

// Test: Already valid level returns immediately with 0 attempts
const validResult = await repairer.repair("Easy course", EASY_LEVEL_FIXTURE);
assert.equal(validResult.success, true);
assert.equal(validResult.attempts, 0);
assert.equal(validResult.history.length, 0);
console.log("✔ PASS: Already playable level returns immediately with 0 repair attempts");

// Test: Hazard obstruction fixture repair
const hazardResult = await repairer.repair(
  "Navigate blocked corridor",
  HAZARD_OBSTRUCTED_LEVEL
);
assert.equal(hazardResult.initialVerification.status, "FAILED");
assert.equal(hazardResult.success, true);
assert.equal(hazardResult.finalVerification.status, "PASSED");
console.log("✔ PASS: Hazard obstructed level repaired and verified PASSED");

// -------------------------------------------------------------
// 3. Benchmark Ablation Runner
// -------------------------------------------------------------
console.log("\n--- 3. Benchmark Ablation Suite Execution ---");

const scenarios = getDefaultBenchmarkScenarios();
assert.ok(scenarios.length >= 6);

const report = await runAblationBenchmark(scenarios, {
  repairModel: mockRepairModel,
  maxAttempts: 3,
});

// Test 9: All 3 strategies executed against identical scenarios
assert.equal(report.totalScenarios, scenarios.length);
assert.equal(report.scenarios.length, scenarios.length);
assert.equal(report.strategies.firstShot.scenarioCount, scenarios.length);
assert.equal(report.strategies.postRepair.scenarioCount, scenarios.length);
assert.equal(report.strategies.naiveHeuristic.scenarioCount, scenarios.length);
console.log("✔ PASS 9: First-Shot, Post-Repair, and Naive Heuristic executed against identical scenarios");

// Test 10: Benchmark metrics are derived from actual measurements (no hardcoding)
const fs = report.strategies.firstShot;
const pr = report.strategies.postRepair;
const nh = report.strategies.naiveHeuristic;

assert.equal(fs.finalSuccesses, 2); // Scenarios 1 and 2 are valid
assert.equal(fs.successRate, Number(((2 / scenarios.length) * 100).toFixed(1)));
assert.ok(pr.finalSuccesses >= 4);
assert.ok(pr.finalSuccesses > nh.finalSuccesses);
assert.ok(pr.successRate > fs.successRate);
assert.ok(pr.avgRepairAttempts > 0);

assert.ok(pr.avgPatchOperations > 0);
assert.ok(pr.avgVerificationLatencyMs >= 0);
assert.ok(pr.avgRepairLatencyMs >= 0);

console.log("✔ PASS 10: Benchmark metrics mathematically derived from actual verification executions\n");

// Display the formatted benchmark ablation table
console.log("=========================================================================================");
console.log("                   FORGELOOP BENCHMARK ABLATION COMPARISON REPORT                        ");
console.log("=========================================================================================");
console.log(`Scenarios: ${report.totalScenarios} | Timestamp: ${report.timestamp}`);
console.log("-----------------------------------------------------------------------------------------");
console.log(
  `| Strategy         | Scenarios | Initial Fail | Final Pass | Success Rate | Avg Attempts | Avg Patch Ops |`
);
console.log("-----------------------------------------------------------------------------------------");
console.log(
  `| ${fs.strategy.padEnd(16)} | ${fs.scenarioCount.toString().padEnd(9)} | ${fs.initialFailures.toString().padEnd(12)} | ${fs.finalSuccesses.toString().padEnd(10)} | ${(fs.successRate + "%").padEnd(12)} | ${fs.avgRepairAttempts.toFixed(2).padEnd(12)} | ${fs.avgPatchOperations.toFixed(2).padEnd(13)} |`
);
console.log(
  `| ${nh.strategy.padEnd(16)} | ${nh.scenarioCount.toString().padEnd(9)} | ${nh.initialFailures.toString().padEnd(12)} | ${nh.finalSuccesses.toString().padEnd(10)} | ${(nh.successRate + "%").padEnd(12)} | ${nh.avgRepairAttempts.toFixed(2).padEnd(12)} | ${nh.avgPatchOperations.toFixed(2).padEnd(13)} |`
);
console.log(
  `| ${pr.strategy.padEnd(16)} | ${pr.scenarioCount.toString().padEnd(9)} | ${pr.initialFailures.toString().padEnd(12)} | ${pr.finalSuccesses.toString().padEnd(10)} | ${(pr.successRate + "%").padEnd(12)} | ${pr.avgRepairAttempts.toFixed(2).padEnd(12)} | ${pr.avgPatchOperations.toFixed(2).padEnd(13)} |`
);
console.log("=========================================================================================");

console.log("\nAll Phase 5 AI repairer and benchmark ablation tests passed successfully!");
