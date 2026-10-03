import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { BFSVerifier } from "../dist/src/verifier/BFSVerifier.js";
import { validateLevelStructure, compileLevelSpec } from "../dist/src/shared/validation.js";

console.log("=== ForgeLoop Phase 1 Verifier & Validator Test Suite ===");

// 1. Strictly Validated 10×7 Playable Level
const playableLevel = {
  width: 10,
  height: 7,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "GROUND", "GROUND", "AIR", "AIR", "GROUND", "GOAL", "AIR", "AIR"],
    ["AIR", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "AIR"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: { required_jumps: 1, min_path_length: 1, target_difficulty: "MEDIUM" },
};

// Structural validator check on playableLevel
const playableValidation = validateLevelStructure(playableLevel);
assert.equal(playableValidation.valid, true, `Validation failed: ${playableValidation.errors.join(", ")}`);
console.log("✔ PASS: Playable level passes structural validation");

// 2. Structural Validator Zero-Trust Test
const malformedRowLengthLevel = structuredClone(playableLevel);
malformedRowLengthLevel.tiles[3] = [
  "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", // 11 tiles in width 10!
];
const malformedValidation = validateLevelStructure(malformedRowLengthLevel);
assert.equal(malformedValidation.valid, false);
assert.ok(malformedValidation.errors.some((e) => e.includes("length mismatch")));
console.log("✔ PASS: Zero-trust validator catches row length mismatch");

const verifier = new BFSVerifier();

// 3. Verifier rejects malformed level directly
const malformedResult = verifier.verify(malformedRowLengthLevel);
assert.equal(malformedResult.status, "FAILED");
assert.equal(malformedResult.counterexample.status, "INVALID_STRUCTURE");
console.log("✔ PASS: Verifier returns structured INVALID_STRUCTURE counterexample");

// 4. Playable level verification
const pass = verifier.verify(playableLevel);
assert.equal(pass.status, "PASSED");
assert.ok(pass.action_sequence.length > 0);
assert.ok(pass.metrics.states_explored < 5000);
console.log(`✔ PASS: Playable level verified: ${pass.action_sequence.join(" → ")}`);

// 5. Unplayable level (reachability failure with hazard wall)
const unplayableLevel = structuredClone(playableLevel);
unplayableLevel.tiles[4] = [
  "AIR", "START", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GOAL", "AIR", "AIR",
];
unplayableLevel.tiles[3] = [
  "AIR", "AIR", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "AIR", "AIR", "AIR",
];

const fail = verifier.verify(unplayableLevel);
assert.equal(fail.status, "FAILED");
assert.equal(fail.counterexample.status, "FAILED_REACHABILITY");
assert.ok(Number.isInteger(fail.counterexample.failure_node.x));
assert.ok(Number.isInteger(fail.counterexample.failure_node.y));
assert.ok(fail.counterexample.gap_to_goal !== undefined);
assert.ok(fail.counterexample.gap_to_goal.manhattan_distance > 0);
console.log(
  `✔ PASS: Unreachable level returns failure_node (${fail.counterexample.failure_node.x}, ${fail.counterexample.failure_node.y}) with gap ${fail.counterexample.gap_to_goal.manhattan_distance}`
);

// 6. Constraint Violation Test (requires 3 jumps, but only 1 jump needed)
const constraintViolatingLevel = structuredClone(playableLevel);
constraintViolatingLevel.constraints = {
  required_jumps: 3,
  min_path_length: 1,
  target_difficulty: "HARD",
};
const constraintFail = verifier.verify(constraintViolatingLevel);
assert.equal(constraintFail.status, "FAILED");
assert.equal(constraintFail.counterexample.status, "CONSTRAINT_VIOLATION");
assert.equal(constraintFail.counterexample.violated.constraint, "required_jumps");
assert.equal(constraintFail.counterexample.violated.required, 3);
console.log(
  `✔ PASS: Constraint violation detected: required 3 jumps, actual ${constraintFail.counterexample.violated.actual}`
);

// 7. Parametric Rules-Change Regression Test
// Playable level requires long jump (distance 4)
const regressionPass = verifier.verify(playableLevel, { longJumpDistance: 4 });
assert.equal(regressionPass.status, "PASSED");

// Nerf jump to distance 2 -> level must fail reachability!
const regressionFail = verifier.verify(playableLevel, { longJumpDistance: 2, shortJumpDistance: 2 });
assert.equal(regressionFail.status, "FAILED");
assert.equal(regressionFail.counterexample.status, "FAILED_REACHABILITY");
console.log("✔ PASS: Rules-change regression correctly flags level broken under nerfed jump physics");

// 8. Geometric LevelSpec Compiler Test
const levelSpec = {
  width: 12,
  height: 8,
  platforms: [
    { x: 0, y: 5, w: 4, h: 3 },  // Left ledge
    { x: 7, y: 5, w: 5, h: 3 },  // Right ledge
  ],
  hazards: [
    { x: 4, y: 7, w: 3, h: 1 },  // Pit hazard
  ],
  start: { x: 1, y: 4 },
  goal: { x: 9, y: 4 },
  constraints: { required_jumps: 1, min_path_length: 3, target_difficulty: "MEDIUM" },
};

const compiledLevel = compileLevelSpec(levelSpec);
assert.equal(compiledLevel.width, 12);
assert.equal(compiledLevel.height, 8);
assert.equal(compiledLevel.tiles.length, 8);
assert.equal(compiledLevel.tiles[0].length, 12);
const compiledPass = verifier.verify(compiledLevel);
assert.equal(compiledPass.status, "PASSED");
console.log(`✔ PASS: LevelSpec compiled to valid 12×8 Level and verified: ${compiledPass.action_sequence.join(" → ")}`);

// 9. Benchmark Execution
const start = performance.now();
for (let i = 0; i < 50; i++) {
  verifier.verify(playableLevel);
}
const elapsedMs = (performance.now() - start) / 50;
assert.ok(elapsedMs < 500, `Verifier took ${elapsedMs.toFixed(2)}ms`);
console.log(`✔ PASS: Benchmark average ${elapsedMs.toFixed(3)}ms per verification (< 500ms target)`);
console.log("\nAll 9 verifier and validator tests passed successfully!");
