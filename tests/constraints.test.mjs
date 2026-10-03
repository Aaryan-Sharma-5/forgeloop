import assert from "node:assert/strict";
import { BFSVerifier } from "../dist/src/verifier/BFSVerifier.js";
import {
  evaluateDifficulty,
  checkConstraints,
  DIFFICULTY_THRESHOLDS,
} from "../dist/src/verifier/constraints.js";
import {
  EASY_LEVEL_FIXTURE,
  MEDIUM_LEVEL_FIXTURE,
  HARD_LEVEL_FIXTURE,
  PLAYABLE_INSUFFICIENT_JUMPS_FIXTURE,
  PLAYABLE_SHORT_PATH_FIXTURE,
  PLAYABLE_TRIVIAL_ROUTE_FIXTURE,
} from "../dist/src/verifier/fixtures.js";

console.log("=== ForgeLoop Phase 3 Constraint & Difficulty Engine Test Suite ===");

const verifier = new BFSVerifier();

// 1. Calibrated Difficulty Fixtures Verification
console.log("\n--- 1. Calibrated Difficulty Evaluation ---");

// 1a. EASY Level
const easyResult = verifier.verify(EASY_LEVEL_FIXTURE);
assert.equal(easyResult.status, "PASSED");
assert.ok(easyResult.metrics.difficulty !== undefined);
assert.equal(easyResult.metrics.difficulty.grade, "EASY");
assert.ok(easyResult.metrics.difficulty.score <= DIFFICULTY_THRESHOLDS.EASY_MAX);
console.log(
  `✔ PASS: EASY fixture verified with score ${easyResult.metrics.difficulty.score} (Grade: ${easyResult.metrics.difficulty.grade})`
);

// 1b. MEDIUM Level
const mediumResult = verifier.verify(MEDIUM_LEVEL_FIXTURE);
assert.equal(mediumResult.status, "PASSED");
assert.ok(mediumResult.metrics.difficulty !== undefined);
assert.equal(mediumResult.metrics.difficulty.grade, "MEDIUM");
assert.ok(mediumResult.metrics.difficulty.score > DIFFICULTY_THRESHOLDS.EASY_MAX);
assert.ok(mediumResult.metrics.difficulty.score <= DIFFICULTY_THRESHOLDS.MEDIUM_MAX);
console.log(
  `✔ PASS: MEDIUM fixture verified with score ${mediumResult.metrics.difficulty.score} (Grade: ${mediumResult.metrics.difficulty.grade})`
);

// 1c. HARD Level
const hardResult = verifier.verify(HARD_LEVEL_FIXTURE);
assert.equal(hardResult.status, "PASSED");
assert.ok(hardResult.metrics.difficulty !== undefined);
assert.equal(hardResult.metrics.difficulty.grade, "HARD");
assert.ok(hardResult.metrics.difficulty.score > DIFFICULTY_THRESHOLDS.MEDIUM_MAX);
console.log(
  `✔ PASS: HARD fixture verified with score ${hardResult.metrics.difficulty.score} (Grade: ${hardResult.metrics.difficulty.grade})`
);

// 2. Playable-but-Invalid Levels -> Structured CONSTRAINT_VIOLATION
console.log("\n--- 2. Playable-but-Invalid Constraint Violations ---");

// 2a. Insufficient Jumps Violation
const jumpsResult = verifier.verify(PLAYABLE_INSUFFICIENT_JUMPS_FIXTURE);
assert.equal(jumpsResult.status, "FAILED");
assert.equal(jumpsResult.counterexample.status, "CONSTRAINT_VIOLATION");
assert.equal(jumpsResult.counterexample.violated.constraint, "required_jumps");
assert.equal(jumpsResult.counterexample.violated.required, 3);
assert.ok(Number(jumpsResult.counterexample.violated.actual) < 3);
assert.ok(jumpsResult.counterexample.violated.details !== undefined);
console.log(
  `✔ PASS: Insufficient jumps violation detected: required ${jumpsResult.counterexample.violated.required}, actual ${jumpsResult.counterexample.violated.actual}`
);

// 2b. Minimum Path Length Violation
const pathResult = verifier.verify(PLAYABLE_SHORT_PATH_FIXTURE);
assert.equal(pathResult.status, "FAILED");
assert.equal(pathResult.counterexample.status, "CONSTRAINT_VIOLATION");
assert.equal(pathResult.counterexample.violated.constraint, "min_path_length");
assert.equal(pathResult.counterexample.violated.required, 10);
assert.ok(Number(pathResult.counterexample.violated.actual) < 10);
console.log(
  `✔ PASS: Path length violation detected: required ${pathResult.counterexample.violated.required}, actual ${pathResult.counterexample.violated.actual}`
);

// 2c. No Trivial Route Violation (Flat Floor Walking Bypass)
const trivialResult = verifier.verify(PLAYABLE_TRIVIAL_ROUTE_FIXTURE);
assert.equal(trivialResult.status, "FAILED");
assert.equal(trivialResult.counterexample.status, "CONSTRAINT_VIOLATION");
assert.equal(trivialResult.counterexample.violated.constraint, "no_trivial_route");
assert.equal(trivialResult.counterexample.violated.actual, "0 jumps");
console.log(
  `✔ PASS: No trivial route violation detected: flat floor bypass with 0 jumps rejected`
);

// 3. Target Difficulty Mismatch Enforcement (via checkConstraints)
console.log("\n--- 3. Target Difficulty Enforcement ---");
const mismatchedLevel = structuredClone(EASY_LEVEL_FIXTURE);
mismatchedLevel.constraints.target_difficulty = "HARD"; // Easy physical level declared as HARD

const directCheck = checkConstraints(
  mismatchedLevel,
  easyResult.action_sequence,
  easyResult.metrics,
  { enforceDifficulty: true }
);

assert.equal(directCheck.satisfied, false);
assert.ok(directCheck.counterexample !== undefined);
assert.equal(directCheck.counterexample.status, "CONSTRAINT_VIOLATION");
assert.equal(directCheck.counterexample.violated.constraint, "target_difficulty");
assert.equal(directCheck.counterexample.violated.required, "HARD");
assert.equal(directCheck.counterexample.violated.actual, "EASY");
console.log(
  `✔ PASS: Target difficulty mismatch detected: declared ${directCheck.counterexample.violated.required}, measured ${directCheck.counterexample.violated.actual}`
);

// 4. Mathematical Determinism & Monotonicity of evaluateDifficulty
console.log("\n--- 4. Difficulty Score Monotonicity ---");
const baseMetrics = {
  states_explored: 10,
  action_sequence_length: 5,
  critical_jumps_required: 1,
  alternative_solution_count: 0,
  max_reached_distance: 5,
};

const d1 = evaluateDifficulty(baseMetrics);
const d2 = evaluateDifficulty({ ...baseMetrics, critical_jumps_required: 3 });
const d3 = evaluateDifficulty({ ...baseMetrics, critical_jumps_required: 3, action_sequence_length: 15 });

assert.ok(d2.score > d1.score, "Adding critical jumps must strictly increase difficulty score");
assert.ok(d3.score > d2.score, "Lengthening required actions must strictly increase difficulty score");
console.log(`✔ PASS: Score monotonicity confirmed (1-jump: ${d1.score} < 3-jumps: ${d2.score} < long: ${d3.score})`);

console.log("\nAll Phase 3 constraint and difficulty engine tests passed successfully!");
