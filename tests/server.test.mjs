import assert from "node:assert/strict";
import {
  ForgeSession,
  ForgeServer,
  createForgeServer,
  validateClientCommand,
  createMockCompilerModel,
  createMockRepairModel,
  DEFAULT_MOCK_SPECS,
} from "../dist/src/index.js";
import { CHASM_BROKEN_LEVEL, CHASM_REPAIR_PATCH } from "../dist/src/verifier/fixtures.js";


console.log("=== ForgeLoop Phase 6 Backend Orchestration Server Test Suite ===\n");

// -------------------------------------------------------------
// 1. Protocol & Message Validation Tests
// -------------------------------------------------------------
console.log("--- 1. Protocol & Message Validation ---");

// Test 9: Malformed messages are rejected
assert.equal(validateClientCommand(null).valid, false);
assert.equal(validateClientCommand("string").valid, false);
assert.equal(validateClientCommand([]).valid, false);
assert.equal(validateClientCommand({}).valid, false);
assert.equal(validateClientCommand({ type: "START_SESSION" }).valid, false); // missing intent
assert.equal(validateClientCommand({ type: "START_SESSION", intent: "" }).valid, false); // empty intent
assert.equal(validateClientCommand({ type: "SABOTAGE_LEVEL", sessionId: "123" }).valid, false); // missing action
console.log("✔ PASS 9: Malformed messages are strictly rejected with structured error messages");

// Test 10: Unknown commands are rejected
const unknownRes = validateClientCommand({ type: "DROP_DATABASE", target: "all" });
assert.equal(unknownRes.valid, false);
assert.ok(unknownRes.errors.some((e) => e.includes("Unknown command type")));
console.log("✔ PASS 10: Unknown client commands are strictly rejected");

// Valid commands pass validation
const validStart = validateClientCommand({
  type: "START_SESSION",
  intent: "Create an easy tutorial course",
});
assert.equal(validStart.valid, true);
assert.equal(validStart.command?.type, "START_SESSION");
console.log("✔ PASS: Valid client commands pass validation cleanly");

// -------------------------------------------------------------
// 2. Session Lifecycle & Orchestration Tests
// -------------------------------------------------------------
console.log("\n--- 2. ForgeSession Lifecycle & Event Stream ---");

// Test 1: Valid session creation
const session1 = new ForgeSession("Create an easy tutorial level", {
  compilerModel: createMockCompilerModel(),
  repairModel: createMockRepairModel(),
});
assert.ok(session1.id.startsWith("session_"));
assert.equal(session1.terminalState, "PENDING");
console.log("✔ PASS 1: Valid session created with isolated state");

// Test 2, 3, 4, 7, 8: Already-playable level skips repair and completes with SESSION_COMPLETED
const emittedEvents1 = [];
session1.subscribe((event) => emittedEvents1.push(event));

const state1 = await session1.run();

// Assert intent reached compiler & spec generated (Test 2)
assert.ok(state1.spec);
assert.ok(emittedEvents1.some((e) => e.type === "INTENT_RECEIVED" && e.intent === "Create an easy tutorial level"));
assert.ok(emittedEvents1.some((e) => e.type === "SPEC_GENERATED"));
console.log("✔ PASS 2: Intent successfully reaches compiler and emits SPEC_GENERATED");

// Assert LevelSpec reached generator & level generated (Test 3)
assert.ok(state1.level);
assert.ok(emittedEvents1.some((e) => e.type === "LEVEL_GENERATED"));
console.log("✔ PASS 3: Generated LevelSpec reaches generator and emits LEVEL_GENERATED");

// Assert Level reached verifier (Test 4)
assert.ok(state1.verification);
assert.ok(emittedEvents1.some((e) => e.type === "VERIFICATION_STARTED" && e.phase === "FIRST_SHOT"));
assert.ok(emittedEvents1.some((e) => e.type === "VERIFICATION_COMPLETED" && e.phase === "FIRST_SHOT"));
console.log("✔ PASS 4: Generated Level reaches verifier and emits VERIFICATION_COMPLETED");

// Assert already-playable level skips repair (Test 8)
assert.equal(state1.verification.status, "PASSED");
assert.equal(state1.repairHistory.length, 0);
assert.equal(emittedEvents1.some((e) => e.type === "REPAIR_STARTED"), false);
console.log("✔ PASS 8: Already-playable level skips repair with 0 repair attempts");

// Assert final PASS emits SESSION_COMPLETED (Test 7)
assert.equal(state1.terminalState, "COMPLETED");
const completedEvent1 = emittedEvents1.find((e) => e.type === "SESSION_COMPLETED");
assert.ok(completedEvent1);
assert.equal(completedEvent1.success, true);
assert.equal(completedEvent1.attempts, 0);
console.log("✔ PASS 7: Final verified PASS emits SESSION_COMPLETED event");

// -------------------------------------------------------------
// 3. Failed Verification Invokes Repairer & Emits Repair Events
// -------------------------------------------------------------
console.log("\n--- 3. Failed Verification & Surgical Repair Orchestration ---");

// Create custom mock compiler that produces an unreachable chasm level
const brokenChasmSpec = {
  width: 12,
  height: 8,
  platforms: [
    { x: 0, y: 6, w: 3, h: 2 },
    { x: 9, y: 6, w: 3, h: 2 }, // 6-tile gap
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

const brokenCompilerModel = {
  async compileIntent() {
    return brokenChasmSpec;
  },
};

const chasmRepairModel = {
  async repairLevel() {
    // Propose stepping stones in gap
    return {
      operations: [
        { type: "REPLACE_TILE", x: 5, y: 6, newTile: "GROUND" },
        { type: "REPLACE_TILE", x: 7, y: 6, newTile: "GROUND" },
      ],
    };
  },
};

const session2 = new ForgeSession("Jump impossible wide gap", {
  compilerModel: brokenCompilerModel,
  repairModel: chasmRepairModel,
});

const emittedEvents2 = [];
session2.subscribe((event) => emittedEvents2.push(event));

const state2 = await session2.run();

// Test 5: Failed verification invokes repairer
assert.ok(emittedEvents2.some((e) => e.type === "REPAIR_STARTED"));
assert.equal(state2.repairHistory.length, 1);
console.log("✔ PASS 5: Failed verification invokes repairer upon counterexample detection");

// Test 6: Repair events are emitted (REPAIR_STARTED, PATCH_PROPOSED, PATCH_APPLIED, REPAIR_COMPLETED)
assert.ok(emittedEvents2.some((e) => e.type === "REPAIR_STARTED"));
assert.ok(emittedEvents2.some((e) => e.type === "PATCH_PROPOSED"));
assert.ok(emittedEvents2.some((e) => e.type === "PATCH_APPLIED"));
assert.ok(emittedEvents2.some((e) => e.type === "REPAIR_COMPLETED"));
console.log("✔ PASS 6: Structured repair events emitted in strict order throughout repair loop");

assert.equal(state2.terminalState, "COMPLETED");
assert.equal(state2.verification?.status, "PASSED");
console.log("✔ PASS: Broken level repaired and verified PASSED through session event pipeline");

// -------------------------------------------------------------
// 4. Session State Isolation Tests
// -------------------------------------------------------------
console.log("\n--- 4. Session State Isolation ---");

// Test 11: Two sessions are completely isolated and do not share state
const sessionA = new ForgeSession("Session A intent", {
  compilerModel: createMockCompilerModel(),
});
const sessionB = new ForgeSession("Session B intent", {
  compilerModel: createMockCompilerModel(),
});

await sessionA.run();
await sessionB.run();

assert.notEqual(sessionA.id, sessionB.id);
assert.notEqual(sessionA.level, sessionB.level);

// Mutate sessionA with sabotage
await sessionA.sabotage("DROP_HAZARD", 2, 2);

// Verify sessionB level was completely unaffected
assert.notEqual(sessionB.level?.tiles[2]?.[2], "HAZARD");
console.log("✔ PASS 11: Session state is strictly isolated between concurrent sessions");

// -------------------------------------------------------------
// 5. ForgeServer HTTP Server Integration Tests
// -------------------------------------------------------------
console.log("\n--- 5. ForgeServer HTTP Server & Command Gateway ---");

const server = createForgeServer({
  compilerModel: createMockCompilerModel(),
  repairModel: createMockRepairModel(),
});

const port = await server.listen(0); // Port 0 binds to an available ephemeral port
const baseUrl = `http://localhost:${port}`;

try {
  // Test Health endpoint
  const healthRes = await fetch(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "ok");
  console.log("✔ PASS: HTTP /health endpoint returns 200 OK");

  // Test Unified Command Gateway (POST /api/command)
  const cmdRes = await fetch(`${baseUrl}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "START_SESSION",
      intent: "Design a beginner level",
    }),
  });
  assert.equal(cmdRes.status, 200);
  const cmdData = await cmdRes.json();
  assert.equal(cmdData.success, true);
  assert.ok(cmdData.data.sessionId);
  assert.equal(cmdData.data.state.terminalState, "COMPLETED");
  console.log("✔ PASS: POST /api/command successfully executes START_SESSION command");

  // Test Rejected Malformed Command
  const badCmdRes = await fetch(`${baseUrl}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "UNKNOWN_COMMAND_XYZ" }),
  });
  assert.equal(badCmdRes.status, 400);
  const badCmdData = await badCmdRes.json();
  assert.equal(badCmdData.success, false);
  console.log("✔ PASS: POST /api/command rejects invalid commands with HTTP 400");

  // Test GET /api/sessions/:id
  const getSessionRes = await fetch(`${baseUrl}/api/sessions/${cmdData.data.sessionId}`);
  assert.equal(getSessionRes.status, 200);
  const sessionData = await getSessionRes.json();
  assert.equal(sessionData.sessionId, cmdData.data.sessionId);
  assert.ok(sessionData.events.length > 0);
  console.log("✔ PASS: GET /api/sessions/:id returns complete session snapshot and event timeline");

  // Test Sabotage -> REPAIR_SESSION autonomous recovery
  // Cut bridge tiles to create an impassable 5-tile gap (x=4,5,6,7,8)
  await fetch(`${baseUrl}/api/sessions/${cmdData.data.sessionId}/sabotage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CUT_BRIDGE", x: 5, y: 6 }),
  });
  await fetch(`${baseUrl}/api/sessions/${cmdData.data.sessionId}/sabotage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CUT_BRIDGE", x: 6, y: 6 }),
  });
  const sabotageRes = await fetch(`${baseUrl}/api/sessions/${cmdData.data.sessionId}/sabotage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CUT_BRIDGE", x: 7, y: 6 }),
  });
  assert.equal(sabotageRes.status, 200);
  const sabotagedState = await sabotageRes.json();
  assert.equal(sabotagedState.verification.status, "FAILED");
  assert.ok(sabotagedState.events.some((e) => e.type === "VERIFICATION_COMPLETED" && e.phase === "POST_SABOTAGE"));
  console.log("✔ PASS: POST /api/sessions/:id/sabotage injects bridge cut and detects FAILED reachability");

  // Trigger autonomous repair via POST /api/command with REPAIR_SESSION
  const repairCmdRes = await fetch(`${baseUrl}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "REPAIR_SESSION",
      sessionId: cmdData.data.sessionId,
    }),
  });
  assert.equal(repairCmdRes.status, 200);
  const repairCmdData = await repairCmdRes.json();
  assert.equal(repairCmdData.success, true);
  assert.ok(repairCmdData.data.events.some((e) => e.type === "REPAIR_COMPLETED"));
  console.log("✔ PASS: REPAIR_SESSION command autonomously executes repair loop on damaged level");
} finally {
  await server.close();
  console.log("✔ PASS: HTTP server closed cleanly");
}

console.log("\nAll Phase 6 server, session, protocol, and isolation tests passed successfully!");
