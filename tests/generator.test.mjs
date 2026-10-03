import assert from "node:assert/strict";
import {
  validateLevelSpec,
  isLevelSpec,
  LEVEL_SPEC_JSON_SCHEMA,
  extractJsonFromText,
  IntentCompiler,
  createMockCompilerModel,
  DEFAULT_MOCK_SPECS,
  LevelGenerator,
  generateFromSpec,
  generateLevelFromIntent,
  BFSVerifier,
} from "../dist/src/index.js";


console.log("=== ForgeLoop Phase 4 AI Generator & Schema Test Suite ===\n");

// -------------------------------------------------------------
// 1. Schema Validation Tests
// -------------------------------------------------------------
console.log("--- 1. Strict LevelSpec Schema Validation ---");

const validSpec = {
  width: 12,
  height: 8,
  platforms: [
    { x: 0, y: 6, w: 5, h: 2 },
    { x: 7, y: 6, w: 5, h: 2 },
  ],
  hazards: [{ x: 5, y: 7, w: 2, h: 1 }],
  start: { x: 1, y: 5 },
  goal: { x: 10, y: 5 },
  constraints: {
    required_jumps: 1,
    min_path_length: 3,
    target_difficulty: "EASY",
    no_trivial_route: true,
  },
};

const resValid = validateLevelSpec(validSpec);
assert.equal(resValid.valid, true);
assert.equal(resValid.errors.length, 0);
assert.ok(resValid.spec);
assert.equal(isLevelSpec(validSpec), true);
console.log("✔ PASS: Valid LevelSpec passes strict schema validation");

// Test non-object input
assert.equal(validateLevelSpec(null).valid, false);
assert.equal(validateLevelSpec("string").valid, false);
assert.equal(validateLevelSpec([]).valid, false);
console.log("✔ PASS: Non-object inputs rejected");

// Test invalid dimensions
const invalidDim = { ...validSpec, width: -12, height: 3.5 };
const resDim = validateLevelSpec(invalidDim);
assert.equal(resDim.valid, false);
assert.ok(resDim.errors.some((e) => e.includes("width")));
assert.ok(resDim.errors.some((e) => e.includes("height")));
console.log("✔ PASS: Invalid grid dimensions rejected");

// Test invalid platform rectangle
const invalidPlatform = {
  ...validSpec,
  platforms: [{ x: 0, y: 6, w: 0, h: -2 }],
};
const resPlat = validateLevelSpec(invalidPlatform);
assert.equal(resPlat.valid, false);
assert.ok(resPlat.errors.some((e) => e.includes("platforms[0].w")));
assert.ok(resPlat.errors.some((e) => e.includes("platforms[0].h")));
console.log("✔ PASS: Non-positive platform dimensions rejected");

// Test out-of-bounds start & goal
const oobStart = { ...validSpec, start: { x: 15, y: -1 } };
const resOob = validateLevelSpec(oobStart);
assert.equal(resOob.valid, false);
assert.ok(resOob.errors.some((e) => e.includes("start.x")));
assert.ok(resOob.errors.some((e) => e.includes("start.y")));
console.log("✔ PASS: Out-of-bounds coordinates rejected");

// Test identical start and goal coordinates
const overlapSpec = { ...validSpec, start: { x: 4, y: 5 }, goal: { x: 4, y: 5 } };
const resOverlap = validateLevelSpec(overlapSpec);
assert.equal(resOverlap.valid, false);
assert.ok(resOverlap.errors.some((e) => e.includes("same coordinate")));
console.log("✔ PASS: Overlapping start and goal coordinates rejected");

// Test invalid constraints
const invalidConstraints = {
  ...validSpec,
  constraints: {
    required_jumps: -1,
    min_path_length: "ten",
    target_difficulty: "NIGHTMARE",
  },
};
const resConst = validateLevelSpec(invalidConstraints);
assert.equal(resConst.valid, false);
assert.ok(resConst.errors.some((e) => e.includes("required_jumps")));
assert.ok(resConst.errors.some((e) => e.includes("min_path_length")));
assert.ok(resConst.errors.some((e) => e.includes("target_difficulty")));
console.log("✔ PASS: Invalid constraints rejected");

// -------------------------------------------------------------
// 2. JSON Extraction and Code-Fence Stripping Tests
// -------------------------------------------------------------
console.log("\n--- 2. JSON Extraction & Code-Fence Stripping ---");

const rawJson = '{"test": 123}';
assert.deepEqual(extractJsonFromText(rawJson), { test: 123 });

const fencedJson = '```json\n{"test": 456}\n```';
assert.deepEqual(extractJsonFromText(fencedJson), { test: 456 });

const textWrappedJson = 'Here is your level:\n```json\n{"test": 789}\n```\nHope you like it!';
assert.deepEqual(extractJsonFromText(textWrappedJson), { test: 789 });
console.log("✔ PASS: extractJsonFromText handles raw, fenced, and commentary-wrapped JSON");

// -------------------------------------------------------------
// 3. Intent Compiler Tests (Isolated Model Interface)
// -------------------------------------------------------------
console.log("\n--- 3. Intent Compiler with Isolated Model Interface ---");

const mockModel = createMockCompilerModel();
const compiler = new IntentCompiler(mockModel);

// Compile Easy Intent
const easyResult = await compiler.compile("Create an easy tutorial level with 1 short jump");
assert.equal(easyResult.validation.valid, true);
assert.equal(easyResult.spec.constraints.target_difficulty, "EASY");
assert.equal(easyResult.spec.constraints.required_jumps, 1);
console.log("✔ PASS: IntentCompiler successfully compiled EASY intent");

// Compile Medium Intent
const medResult = await compiler.compile("Generate a medium level with a two-jump hazard pit");
assert.equal(medResult.validation.valid, true);
assert.equal(medResult.spec.constraints.target_difficulty, "MEDIUM");
assert.equal(medResult.spec.constraints.required_jumps, 2);
console.log("✔ PASS: IntentCompiler successfully compiled MEDIUM intent");

// Compile Hard Intent
const hardResult = await compiler.compile("Design a hard precision platformer with 4 jumps");
assert.equal(hardResult.validation.valid, true);
assert.equal(hardResult.spec.constraints.target_difficulty, "HARD");
assert.equal(hardResult.spec.constraints.required_jumps, 4);
console.log("✔ PASS: IntentCompiler successfully compiled HARD intent");


// Test compiler handling model error / invalid schema
const badModel = {
  async compileIntent() {
    return '{"width": 12, "height": 8}'; // Missing required fields
  },
};
const badCompiler = new IntentCompiler(badModel);
const badResult = await badCompiler.compile("Give me a level");
assert.equal(badResult.validation.valid, false);
assert.ok(badResult.validation.errors.length > 0);
console.log("✔ PASS: IntentCompiler reports structured validation errors for incomplete model output");

// -------------------------------------------------------------
// 4. Deterministic LevelGenerator Compilation Tests
// -------------------------------------------------------------
console.log("\n--- 4. Deterministic LevelGenerator Compilation ---");

const generator = new LevelGenerator(compiler);

const genResult = await generator.generate("Easy beginner course");
assert.equal(genResult.level.width, 12);
assert.equal(genResult.level.height, 8);
assert.equal(genResult.level.tiles.length, 8);
assert.equal(genResult.level.tiles[0].length, 12);

// Check that START and GOAL are placed at discrete coordinates
assert.equal(genResult.level.tiles[genResult.spec.start.y][genResult.spec.start.x], "START");
assert.equal(genResult.level.tiles[genResult.spec.goal.y][genResult.spec.goal.x], "GOAL");
console.log("✔ PASS: LevelGenerator deterministically compiled LevelSpec to discrete Level grid");

// Test generateFromSpec
const compiledFromSpec = generateFromSpec(validSpec);
assert.equal(compiledFromSpec.width, 12);
assert.equal(compiledFromSpec.height, 8);
assert.equal(compiledFromSpec.tiles[5][1], "START");
assert.equal(compiledFromSpec.tiles[5][10], "GOAL");
console.log("✔ PASS: generateFromSpec produces canonical discrete Level");

// -------------------------------------------------------------
// 5. End-to-End Pipeline: Intent → LevelSpec → Level → BFSVerifier
// -------------------------------------------------------------
console.log("\n--- 5. End-to-End Pipeline: Intent → LevelSpec → Level → BFSVerifier ---");

const verifier = new BFSVerifier();

// Pipeline Run 1: Easy Intent
const e2eEasy = await generateLevelFromIntent("Create an easy 1-jump level", mockModel);
const verifyEasy = verifier.verify(e2eEasy.level);
assert.equal(verifyEasy.status, "PASSED");
assert.ok(verifyEasy.action_sequence.length >= 1);
assert.equal(verifyEasy.metrics.difficulty?.grade, "EASY");
console.log(`✔ PASS: End-to-End EASY Intent verified: ${verifyEasy.action_sequence.join(" → ")} (Score: ${verifyEasy.metrics.difficulty?.score})`);

// Pipeline Run 2: Medium Intent
const e2eMedium = await generateLevelFromIntent("Generate a medium 2-jump level", mockModel);
const verifyMedium = verifier.verify(e2eMedium.level);
assert.equal(verifyMedium.status, "PASSED");
assert.equal(verifyMedium.metrics.difficulty?.grade, "MEDIUM");
console.log(`✔ PASS: End-to-End MEDIUM Intent verified: ${verifyMedium.action_sequence.join(" → ")} (Score: ${verifyMedium.metrics.difficulty?.score})`);


// Pipeline Run 3: Hard Intent
const e2eHard = await generateLevelFromIntent("Hard precision jumps", mockModel);
const verifyHard = verifier.verify(e2eHard.level);
assert.equal(verifyHard.status, "PASSED");
assert.equal(verifyHard.metrics.difficulty?.grade, "HARD");
console.log(`✔ PASS: End-to-End HARD Intent verified: ${verifyHard.action_sequence.join(" → ")} (Score: ${verifyHard.metrics.difficulty?.score})`);

// -------------------------------------------------------------
// 6. Proving AI Output is Never Proof of Playability
// -------------------------------------------------------------
console.log("\n--- 6. Verifier Independence: AI Output != Proof of Playability ---");

// Create a candidate spec that is structurally valid, but has an impossible 5-tile chasm gap
const brokenCandidateSpec = {
  width: 12,
  height: 8,
  platforms: [
    { x: 0, y: 6, w: 3, h: 2 },
    { x: 9, y: 6, w: 3, h: 2 }, // Gap from x=3 to x=9 is 6 tiles (max jump is 4)
  ],
  hazards: [{ x: 3, y: 7, w: 6, h: 1 }],
  start: { x: 1, y: 5 },
  goal: { x: 10, y: 5 },
  constraints: {
    required_jumps: 1,
    min_path_length: 2,
    target_difficulty: "MEDIUM",
  },
};

// 1. LevelSpec passes strict schema validation
const specValidation = validateLevelSpec(brokenCandidateSpec);
assert.equal(specValidation.valid, true);

// 2. Deterministic generator compiles Level
const brokenLevel = generateFromSpec(brokenCandidateSpec);
assert.equal(brokenLevel.width, 12);

// 3. BFSVerifier INDEPENDENTLY evaluates the candidate and catches the flaw
const verificationFailure = verifier.verify(brokenLevel);
assert.equal(verificationFailure.status, "FAILED");
assert.equal(verificationFailure.counterexample.status, "FAILED_REACHABILITY");
assert.ok(verificationFailure.counterexample.gap_to_goal);
assert.ok(verificationFailure.counterexample.gap_to_goal.manhattan_distance > 0);

console.log(`✔ PASS: AI candidate passed schema validation, but BFSVerifier caught reachability failure at node (${verificationFailure.counterexample.failure_node.x}, ${verificationFailure.counterexample.failure_node.y}) with gap ${verificationFailure.counterexample.gap_to_goal.manhattan_distance}`);

console.log("\nAll Phase 4 AI generator, compiler, schema, and end-to-end tests passed successfully!");
