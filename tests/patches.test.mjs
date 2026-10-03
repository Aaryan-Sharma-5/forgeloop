import assert from "node:assert/strict";
import { BFSVerifier } from "../dist/src/verifier/BFSVerifier.js";
import {
  validatePatch,
  applyPatch,
  computePatch,
} from "../dist/src/verifier/patches.js";
import {
  CHASM_BROKEN_LEVEL,
  CHASM_REPAIR_PATCH,
  HAZARD_OBSTRUCTED_LEVEL,
  HAZARD_REPAIR_PATCH,
} from "../dist/src/verifier/fixtures.js";

console.log("=== ForgeLoop Phase 2 Patch Engine Test Suite ===");

const verifier = new BFSVerifier();

// 1. Patch Validation Tests
const sampleLevel = structuredClone(CHASM_BROKEN_LEVEL);

// 1a. Valid patch
const validPatch = {
  operations: [{ type: "REPLACE_TILE", x: 5, y: 4, newTile: "GROUND" }],
};
const valResult = validatePatch(sampleLevel, validPatch);
assert.equal(valResult.valid, true);
console.log("✔ PASS: Valid patch passes validation");

// 1b. Out-of-bounds coordinates
const outOfBoundsPatch = {
  operations: [{ type: "REPLACE_TILE", x: 99, y: 4, newTile: "GROUND" }],
};
const oobResult = validatePatch(sampleLevel, outOfBoundsPatch);
assert.equal(oobResult.valid, false);
assert.ok(oobResult.errors.some((e) => e.includes("out-of-bounds x")));
console.log("✔ PASS: Out-of-bounds coordinates rejected");

// 1c. Invalid tile type
const invalidTilePatch = {
  operations: [{ type: "REPLACE_TILE", x: 5, y: 4, newTile: "LAVA" }],
};
const invTileResult = validatePatch(sampleLevel, invalidTilePatch);
assert.equal(invTileResult.valid, false);
assert.ok(invTileResult.errors.some((e) => e.includes("invalid tile type")));
console.log("✔ PASS: Invalid tile type rejected");

// 1d. Protect START / GOAL from overwriting
const overwriteStartPatch = {
  operations: [{ type: "REPLACE_TILE", x: 1, y: 3, newTile: "GROUND" }], // (1, 3) is START
};
const overwriteResult = validatePatch(sampleLevel, overwriteStartPatch);
assert.equal(overwriteResult.valid, false);
assert.ok(overwriteResult.errors.some((e) => e.includes("attempts to overwrite START")));
console.log("✔ PASS: Overwrite of START tile strictly prevented");

// 1e. Max operations limit exceeded
const tooManyOpsPatch = {
  operations: Array.from({ length: 15 }, (_, i) => ({
    type: "REPLACE_TILE",
    x: i % 12,
    y: 0,
    newTile: "AIR",
  })),
};
const tooManyResult = validatePatch(sampleLevel, tooManyOpsPatch, { maxOperations: 5 });
assert.equal(tooManyResult.valid, false);
assert.ok(tooManyResult.errors.some((e) => e.includes("exceeds maximum allowable limit")));
console.log("✔ PASS: Max patch operations limit enforced");

// 2. Deterministic Immutability Test
const originalTileAt5_4 = sampleLevel.tiles[4][5];
const applyRes = applyPatch(sampleLevel, validPatch);
assert.equal(applyRes.success, true);
assert.equal(applyRes.appliedCount, 1);
assert.equal(applyRes.level.tiles[4][5], "GROUND");
assert.equal(sampleLevel.tiles[4][5], originalTileAt5_4); // Original unmodified
console.log("✔ PASS: applyPatch is strictly immutable (original level unmodified)");

// 3. computePatch Diff Utility Test
const diffPatch = computePatch(sampleLevel, applyRes.level);
assert.equal(diffPatch.operations.length, 1);
assert.equal(diffPatch.operations[0].x, 5);
assert.equal(diffPatch.operations[0].y, 4);
assert.equal(diffPatch.operations[0].newTile, "GROUND");
console.log("✔ PASS: computePatch accurately computes delta between levels");

// 4. End-to-End Fail → Patch → Pass Integration (Chasm Gap)
console.log("\n--- Testing Fail → Patch → Pass Integration (Chasm Gap) ---");
const chasmInitial = verifier.verify(CHASM_BROKEN_LEVEL);
assert.equal(chasmInitial.status, "FAILED");
assert.equal(chasmInitial.counterexample.status, "FAILED_REACHABILITY");
assert.equal(chasmInitial.counterexample.failure_node.x, 3);
assert.equal(chasmInitial.counterexample.failure_node.y, 3);
assert.ok(chasmInitial.counterexample.gap_to_goal.manhattan_distance > 0);
console.log(
  `Step 1: Broken chasm verified FAILED at failure_node (${chasmInitial.counterexample.failure_node.x}, ${chasmInitial.counterexample.failure_node.y})`
);

const chasmPatched = applyPatch(CHASM_BROKEN_LEVEL, CHASM_REPAIR_PATCH);
assert.equal(chasmPatched.success, true);
console.log(`Step 2: Applied surgical patch: REPLACE_TILE at (5, 4) with GROUND`);

const chasmVerified = verifier.verify(chasmPatched.level);
assert.equal(chasmVerified.status, "PASSED");
assert.ok(chasmVerified.action_sequence.length > 0);
console.log(`Step 3: Re-verification PASSED: ${chasmVerified.action_sequence.join(" → ")}`);

// 5. End-to-End Fail → Patch → Pass Integration (Hazard Obstruction)
console.log("\n--- Testing Fail → Patch → Pass Integration (Hazard Obstruction) ---");
const hazardInitial = verifier.verify(HAZARD_OBSTRUCTED_LEVEL);
assert.equal(hazardInitial.status, "FAILED");
assert.equal(hazardInitial.counterexample.status, "FAILED_REACHABILITY");
console.log(`Step 1: Hazard obstructed level verified FAILED`);

const hazardPatched = applyPatch(HAZARD_OBSTRUCTED_LEVEL, HAZARD_REPAIR_PATCH);
assert.equal(hazardPatched.success, true);
console.log(`Step 2: Applied surgical patch: cleared hazard wall at x=3 with AIR`);

const hazardVerified = verifier.verify(hazardPatched.level);
assert.equal(hazardVerified.status, "PASSED");
assert.ok(hazardVerified.action_sequence.length > 0);
console.log(`Step 3: Re-verification PASSED: ${hazardVerified.action_sequence.join(" → ")}`);

console.log("\nAll Phase 2 patch engine and integration tests passed successfully!");
