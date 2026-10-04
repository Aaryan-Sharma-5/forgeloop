import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}
import assert from "node:assert/strict";
import {
  createForgeServer,
  createGroqCompilerModel,
  createGroqRepairModel,
  IntentCompiler,
  LevelRepairer,
  generateFromSpec,
  BFSVerifier,
  validateLevelSpec,
  validatePatchShape,
  validatePatch,
  applyPatch,
} from "../dist/src/index.js";
import { CHASM_BROKEN_LEVEL } from "../dist/src/verifier/fixtures.js";

console.log("================================================================");
console.log("🔥 ForgeLoop Live Groq End-to-End Automated Test");
console.log("================================================================\n");

assert.ok(process.env.GROQ_API_KEY, "GROQ_API_KEY must be set in .env");
const maskedKey = process.env.GROQ_API_KEY.substring(0, 7) + "..." + process.env.GROQ_API_KEY.slice(-4);
console.log(`🔑 Using Groq Key: ${maskedKey}`);

// -------------------------------------------------------------
// 1. Live Intent Compilation Test
// -------------------------------------------------------------
console.log("\n--- 1. Testing Live Intent Compilation with Groq ---");
const compilerModel = createGroqCompilerModel();
const compiler = new IntentCompiler(compilerModel);

const testIntent = "Build an easy tutorial level with one 2-tile gap between platforms";
console.log(`Prompt: "${testIntent}"`);

const compileStart = performance.now();
const compileRes = await compiler.compile(testIntent);
const compileDuration = (performance.now() - compileStart).toFixed(1);

console.log(`⏱ Groq Response Time: ${compileDuration}ms`);
assert.equal(compileRes.validation.valid, true, `Compiler failed: ${compileRes.validation.errors?.join("; ")}`);
assert.ok(compileRes.spec, "LevelSpec should be present");

console.log("✔ PASS: Live LevelSpec received and validated:");
console.log(`  Dimensions: ${compileRes.spec.width}x${compileRes.spec.height}`);
console.log(`  Platforms: ${compileRes.spec.platforms.length}`);
console.log(`  Target Difficulty: ${compileRes.spec.constraints.target_difficulty}`);
console.log(`  Start: (${compileRes.spec.start.x}, ${compileRes.spec.start.y}) | Goal: (${compileRes.spec.goal.x}, ${compileRes.spec.goal.y})`);

// Compile LevelSpec to discrete Level grid
const liveLevel = generateFromSpec(compileRes.spec);
assert.equal(liveLevel.width, compileRes.spec.width);
assert.equal(liveLevel.height, compileRes.spec.height);
console.log("✔ PASS: LevelGenerator deterministically compiled discrete Level grid");

// Run Authoritative BFS Verifier
const verifier = new BFSVerifier();
const verifRes = verifier.verify(liveLevel);
console.log(`✔ Verifier Ground Truth: status=${verifRes.status}, states_explored=${verifRes.metrics.states_explored}`);
if (verifRes.status === "PASSED") {
  console.log(`  Path Actions: ${verifRes.action_sequence.join(" → ")}`);
} else {
  console.log(`  Counterexample: ${verifRes.counterexample.reason} at (${verifRes.counterexample.failure_node.x}, ${verifRes.counterexample.failure_node.y})`);
}

// -------------------------------------------------------------
// 2. Live Surgical Repair Test
// -------------------------------------------------------------
console.log("\n--- 2. Testing Live Surgical Repair with Groq ---");
const repairModel = createGroqRepairModel();
const repairer = new LevelRepairer(repairModel, { maxAttempts: 3 });

console.log("Feeding broken 5-tile chasm gap fixture (CHASM_BROKEN_LEVEL) to real Groq...");
const repairStart = performance.now();
const repairLoopRes = await repairer.repair("Cross the wide chasm", CHASM_BROKEN_LEVEL);
const repairDuration = (performance.now() - repairStart).toFixed(1);

console.log(`⏱ Groq Repair Execution Time: ${repairDuration}ms`);
console.log(`  Attempts Used: ${repairLoopRes.attempts}`);
console.log(`  Repair Outcome: ${repairLoopRes.success ? "SUCCESS (PASSED)" : "FAILED"}`);
for (const [idx, att] of repairLoopRes.history.entries()) {
  console.log(`\n  [Attempt ${idx + 1}]`);
  console.log(`    Counterexample: ${att.counterexample.reason} at (${att.counterexample.failure_node.x}, ${att.counterexample.failure_node.y})`);
  console.log(`    Patch Valid: ${att.patchValid}, Errors: ${att.patchErrors.join("; ") || "none"}`);
  console.log(`    Proposed Ops: ${JSON.stringify(att.proposedPatch?.operations)}`);
  if (att.verificationAfter) {
    console.log(`    Verification After: status=${att.verificationAfter.status} (failure: ${att.verificationAfter.counterexample?.reason})`);
  }
}
assert.equal(repairLoopRes.success, true, "Live Groq repairer should successfully heal the chasm");
assert.equal(repairLoopRes.finalVerification?.status, "PASSED", "Repaired level must pass verifier");

console.log("✔ PASS: Live Groq repair synthesized valid patch and resolved reachability failure!");
console.log(`  Final Verified Path: ${repairLoopRes.finalVerification.action_sequence.join(" → ")}`);

// -------------------------------------------------------------
// 3. Live Server HTTP & SSE Integration Test
// -------------------------------------------------------------
console.log("\n--- 3. Testing Full Server HTTP + Live Groq End-to-End ---");
const server = createForgeServer(); // Auto-detects GROQ_API_KEY from environment!
const port = await server.listen(0);
const baseUrl = `http://localhost:${port}`;
console.log(`ForgeServer listening on ${baseUrl} (auto-selected Groq models)`);

try {
  // Test Health
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  console.log("✔ PASS: GET /health is OK");

  // Create live session
  const sessionIntent = "Create a platformer level with 2 platforms";
  console.log(`Creating session with intent: "${sessionIntent}"`);
  const createStart = performance.now();
  const createRes = await fetch(`${baseUrl}/api/sessions?sync=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: sessionIntent }),
  });
  const createDuration = (performance.now() - createStart).toFixed(1);
  assert.equal(createRes.status, 200);
  const sessionData = await createRes.json();
  const sessionId = sessionData.sessionId;
  const state = sessionData.state;

  console.log(`⏱ Full Live Session Execution: ${createDuration}ms`);
  console.log(`  Session ID: ${sessionId}`);
  console.log(`  Terminal State: ${state.terminalState}`);
  console.log(`  Level Dimensions: ${state.level.width}x${state.level.height}`);
  console.log(`  Verification: ${state.verification.status}`);
  console.log(`  Events Emitted: ${state.events.length}`);
  assert.ok(sessionId);
  assert.ok(state.events.some((e) => e.type === "SPEC_GENERATED"));
  assert.ok(state.events.some((e) => e.type === "LEVEL_GENERATED"));
  console.log("✔ PASS: Live session synthesized, verified, and recorded in event history");

  // Test Sabotage on the live session
  console.log("Injecting CUT_BRIDGE sabotage on the live level...");
  const sabotageRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/sabotage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CUT_BRIDGE" }),
  });
  assert.equal(sabotageRes.status, 200);
  const sabotagedState = await sabotageRes.json();
  console.log(`  Post-Sabotage Status: ${sabotagedState.verification.status}`);
  assert.ok(sabotagedState.events.some((e) => e.type === "VERIFICATION_COMPLETED" && e.phase === "POST_SABOTAGE"));
  console.log("✔ PASS: Sabotage injected and re-verified in real time");

  // Test REPAIR_SESSION command
  console.log("Sending REPAIR_SESSION command to trigger autonomous healing...");
  const repairCmdRes = await fetch(`${baseUrl}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "REPAIR_SESSION",
      sessionId,
    }),
  });
  assert.equal(repairCmdRes.status, 200);
  const repairCmdData = await repairCmdRes.json();
  assert.equal(repairCmdData.success, true);
  console.log("✔ PASS: REPAIR_SESSION executed successfully");
} finally {
  await server.close();
  console.log("✔ PASS: ForgeServer closed cleanly");
}

console.log("\n================================================================");
console.log("🎉 ALL LIVE GROQ END-TO-END AUTOMATED TESTS PASSED SUCCESSFULLY!");
console.log("================================================================");
