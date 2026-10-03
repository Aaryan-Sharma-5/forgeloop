# ForgeLoop - AI Development Instructions

## Mission

ForgeLoop is a hackathon Game Tech prototype for the Tencent × Arcade AI Hackathon.

The product is an autonomous, constraint-driven game-level engineering loop:

```text
Natural-language design intent
        ↓
AI level synthesis
        ↓
Deterministic game verifier
        ↓
Counterexample
        ↓
AI repair patch
        ↓
Re-verification
        ↓
Verified playable level
        ↓
Human Play Mode
```

The central technical idea is **counterexample-guided game-level synthesis**. The LLM is responsible for creative synthesis and repair reasoning. Deterministic TypeScript code is authoritative for game-state transitions, collision, reachability, constraints, and verification.

The hackathon is time-constrained. Prefer a narrow, reliable, visually demonstrable system over broad feature coverage.

---

## Non-negotiable engineering principles

### 1. The verifier is the source of truth

Never let an LLM decide whether a level is playable.

The deterministic verifier decides:

- collision
- movement validity
- reachability
- action sequences
- constraint satisfaction
- verification metrics
- pass/fail status

LLMs may propose levels and patches, but they cannot override verifier results.

### 2. Keep the physics discrete

This is a deliberate abstraction.

Do NOT introduce:

- floating-point world coordinates
- frame-by-frame continuous physics
- Box2D/Matter.js/Unity physics
- acceleration integration
- continuous collision detection
- arbitrary physics engines

Use integer grid coordinates and deterministic macro-actions.

### 3. Keep generation separate from verification

The generator produces a candidate level.

The verifier independently tests it.

The repairer receives verifier evidence and returns a minimal patch.

Never allow the repairer to silently replace the entire level.

### 4. Patches are authoritative mutations

LLM repair output must be a structured `LevelPatch`.

The backend validates and applies patches deterministically.

A patch must:

- reference valid coordinates
- use valid tile types
- preserve required START and GOAL semantics
- preserve level dimensions
- pass schema validation
- be re-verified after application

### 5. Design intent is part of verification

A level is not successful merely because it is reachable.

The verifier must eventually evaluate constraints such as:

- required jumps
- minimum path length
- target difficulty
- absence of trivial routes
- other explicit level-design constraints

Do not describe the system as mathematically proving that a level is universally playable. The accurate claim is that the level is **verified under ForgeLoop's deterministic game model and declared constraints**.

### 6. Do not over-engineer

Do not add infrastructure because it sounds impressive.

Avoid unless a concrete requirement emerges:

- Redis
- Kafka
- ClickHouse
- PostgreSQL
- microservices
- Kubernetes
- LangGraph for a simple deterministic loop
- authentication
- user accounts
- multiplayer
- 3D rendering
- complex physics

The MVP should work as a small full-stack application.

---

## Canonical contracts (Amended & Frozen)

These interfaces define the boundary between the verifier, backend, frontend, and AI layer. They have been refined based on evaluation to eliminate state redundancy and ensure robust AI generation and structured diagnostics.

```typescript
type TileType = "AIR" | "GROUND" | "HAZARD" | "START" | "GOAL";

interface LevelConstraints {
  required_jumps: number;
  min_path_length: number;
  target_difficulty: "EASY" | "MEDIUM" | "HARD";
  no_trivial_route?: boolean; // When true, solutions cannot bypass obstacles with fewer than required_jumps
}

interface Level {
  width: number;
  height: number;
  tiles: TileType[][]; // [y][x]
  constraints: LevelConstraints;
}

// Intermediate Representation for LLM Generation
// LLMs emit rectangular spans instead of raw 2D tile ASCII/token grids,
// eliminating row-length and spatial alignment failures.
interface RectSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LevelSpec {
  width: number;
  height: number;
  platforms: RectSpec[];
  hazards: RectSpec[];
  start: { x: number; y: number };
  goal: { x: number; y: number };
  constraints: LevelConstraints;
}

// Discrete GameState: atomic transitions with swept collisions.
// Continuous vx/vy velocity are omitted to avoid state bloat and duplication.
interface GameState {
  x: number;
  y: number;
  grounded: boolean;
  facing: -1 | 1;
}

type Action =
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "JUMP_SHORT"
  | "JUMP_LONG"
  | "WAIT";

// Parametric physics config enabling rules-change regression
interface PhysicsConfig {
  shortJumpDistance: number; // default: 2
  longJumpDistance: number;  // default: 4
  jumpApexHeight: number;    // default: 1
  gravityStep: number;       // default: 1
}

interface Counterexample {
  status: "FAILED_REACHABILITY" | "CONSTRAINT_VIOLATION" | "INVALID_STRUCTURE";
  reason: string;
  failure_node: { x: number; y: number }; // Closest reachable state to GOAL
  attempted_action: Action | null;
  collision_at: { x: number; y: number } | null;
  gap_to_goal?: { dx: number; dy: number; manhattan_distance: number };
  violated?: {
    constraint: "required_jumps" | "min_path_length" | "target_difficulty" | "no_trivial_route" | string;
    required: number | string;
    actual: number | string;
    details?: string;
  };
  metrics: {
    states_explored: number;
    max_reached_distance: number;
    shortest_solution_actions: number | null;
  };
}

interface LevelPatchOperation {
  type: "REPLACE_TILE";
  x: number;
  y: number;
  newTile: TileType;
}

interface LevelPatch {
  operations: LevelPatchOperation[];
}
```

If a new field is required, update the canonical type first and then update every consumer and test. Do not create duplicate versions of these contracts in different files.

---

## Repository architecture

Target architecture:

```text
src/
├── types.ts
├── index.ts
├── verifier/
│   ├── PhysicsEngine.ts
│   ├── BFSVerifier.ts
│   ├── constraints.ts
│   ├── patches.ts
│   └── fixtures.ts
├── ai/
│   ├── generator.ts
│   ├── repairer.ts
│   ├── schemas.ts
│   └── prompts.ts
├── server/
│   ├── server.ts
│   ├── protocol.ts
│   └── session.ts
└── shared/
    └── validation.ts

web/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── LevelCanvas.tsx
│   │   ├── VerificationPanel.tsx
│   │   ├── RepairTimeline.tsx
│   │   ├── ConstraintPanel.tsx
│   │   └── PlayMode.tsx
│   └── lib/
│       └── websocket.ts

tests/
├── verifier/
├── patches/
├── constraints/
└── integration/
```

The current Phase 1 repository may contain only the verifier portion. Extend the structure incrementally rather than scaffolding the entire final architecture at once.

---

## Verifier requirements

### PhysicsEngine

`PhysicsEngine` must remain deterministic and side-effect free.

Given identical:

```text
Level + GameState + Action
```

it must always return the same transition.

Preferred shape:

```typescript
interface Transition {
  nextState: GameState | null;
  collisionAt: { x: number; y: number } | null;
  reason: string | null;
}
```

Do not mutate the input `GameState` or `Level`.

### Search

BFS is acceptable for the MVP because the action space and state model are intentionally small and discrete.

If A* is introduced, preserve deterministic behavior and benchmark it against BFS. Do not introduce it merely for sophistication.

The search must:

- terminate deterministically
- have a bounded state space
- avoid revisiting equivalent states
- reconstruct a successful action sequence
- identify useful failure evidence
- expose metrics

### Counterexamples

A failure should be actionable, not merely:

```text
"Level failed."
```

Prefer evidence such as:

```json
{
  "status": "FAILED_REACHABILITY",
  "reason": "JUMP_LONG trajectory collides with HAZARD",
  "failure_node": { "x": 18, "y": 7 },
  "attempted_action": "JUMP_LONG",
  "collision_at": { "x": 20, "y": 8 },
  "metrics": {
    "states_explored": 1842,
    "max_reached_distance": 14,
    "shortest_solution_actions": null
  }
}
```

The counterexample is the primary feedback channel to the repair model.

---

## Difficulty system

Difficulty is a product metric, not an LLM opinion.

Do not claim that `states_explored` alone proves difficulty.

Use a composite deterministic profile. The exact formula can evolve, but it should consider measurable properties such as:

- shortest solution length
- required jumps
- number of alternative solutions
- branching/search complexity
- recovery margin
- obstacle density
- critical action count

Example conceptual score:

```text
difficulty_score =
    action_length_component
  + branching_component
  + critical_jump_component
  + constraint_component
  - alternative_route_component
```

The thresholds for EASY/MEDIUM/HARD must be calibrated using deterministic fixtures, not chosen arbitrarily and then presented as objective truth.

A generated level can fail with:

```text
CONSTRAINT_VIOLATION
```

when it is playable but does not satisfy the requested design profile.

---

## Level generation rules & intermediate representation

To prevent LLM spatial hallucination and malformed row lengths (e.g., lines with missing or extra characters), generation uses a two-tier architecture:

1. **AI Output Target (`LevelSpec`)**:
   The LLM generates structured geometric primitives (platform and hazard rectangles with `{ x, y, w, h }`, plus `{ start, goal }` and `constraints`). This representation matches how level designers think and eliminates 2D ASCII grid parsing errors.

2. **Deterministic Compiler (`compileLevelSpec`)**:
   A deterministic function paints the primitives onto the integer tile grid of dimensions `width × height`, assigns `START` and `GOAL`, and produces the canonical `Level`.

3. **Concrete Constraint Definitions**:
   - `required_jumps`: The shortest solution must contain at least (or exactly) $N$ jumps.
   - `min_path_length`: The shortest solution must take at least $M$ actions.
   - `no_trivial_route`: Formally defined as:
     - No solution may exist with 0 jumps (pure walking across the floor is rejected).
     - Shortest solution jump count must be $\ge required\_jumps$.
     - Alternative solutions must not bypass core obstacles via an unintended low-cost shortcut.

Example input:

```text
Create a medium 2D platforming level.
Requirements:
- exactly 3 critical jumps
- minimum path length 15 actions
- no trivial straight route
- target difficulty MEDIUM
```

The model must return structured `LevelSpec` data only.

The backend compiler deterministically validates:

- JSON schema
- dimensions (`width` and `height`)
- row lengths (enforcing exactly `width` tiles per row)
- valid tile values
- exactly one START
- exactly one GOAL
- reasonable placement
- constraint object

The LLM is never trusted simply because its response parses as JSON. All compiled levels must pass `validateLevelStructure`.

---

## Repair rules

The repair model must output a patch, not a new level.

Preferred contract:

```json
{
  "operations": [
    {
      "type": "REPLACE_TILE",
      "x": 20,
      "y": 8,
      "newTile": "GROUND"
    }
  ]
}
```

Repair prompt must contain:

1. Original design intent
2. Current level
3. Current constraints
4. Verifier result
5. Counterexample
6. Instruction to make the smallest valid repair

The repair loop must have a hard retry limit, initially 3.

If all retries fail:

- preserve the best candidate
- show the failure honestly
- allow the demo fallback to use a known deterministic fixture

Never silently fake a successful verifier result.

---

## AI boundary

### AI is allowed to:

- interpret natural-language design intent
- generate candidate levels
- reason about counterexamples
- propose patches
- suggest constraint-preserving modifications

### AI is not allowed to:

- decide whether a level passed
- bypass the verifier
- modify verification metrics
- declare a failed level valid
- mutate state directly
- execute arbitrary code generated by the model
- return executable JavaScript/TypeScript as part of level repair

All AI output must be parsed through strict schemas.

---

## Frontend principles

The frontend exists to make the technical loop visually obvious.

Primary screen:

```text
┌───────────────────────────────┬──────────────────────┐
│                               │ VERIFICATION          │
│          LEVEL                │                      │
│                               │ Attempt #1           │
│     Player path → X           │ ✗ FAILED             │
│                    hazard     │                      │
│                               │ Counterexample       │
│                               │ x: 18, y: 7         │
│                               │                      │
│                               │ AI REPAIRING...      │
└───────────────────────────────┴──────────────────────┘
```

Then show:

```text
PATCH #1
        ↓
REVERIFYING
        ↓
✓ REACHABLE
✓ CONSTRAINTS SATISFIED
✓ TARGET DIFFICULTY
        ↓
PLAY NOW
```

The UI should prioritize:

1. Level visualization
2. Agent trajectory
3. Failure location
4. Repair operation
5. Verification status
6. Constraint metrics
7. Play mode

Do not build a generic dashboard.

---

## WebSocket protocol

Use a small event protocol rather than arbitrary JSON blobs.

Example events:

```typescript
type ForgeEvent =
  | { type: "GENERATION_STARTED" }
  | { type: "LEVEL_GENERATED"; level: Level }
  | { type: "VERIFICATION_STARTED" }
  | { type: "SIMULATION_STEP"; state: GameState; action: Action }
  | { type: "VERIFICATION_FAILED"; counterexample: Counterexample }
  | { type: "REPAIR_STARTED" }
  | { type: "PATCH_APPLIED"; patch: LevelPatch; level: Level }
  | { type: "VERIFICATION_PASSED"; result: VerificationSuccess }
  | { type: "PLAY_READY"; level: Level }
  | { type: "ERROR"; message: string };
```

Keep event payloads deterministic and serializable.

---

## Demo reliability

The hackathon demo is more important than feature count.

The primary demo path must be deterministic enough to reproduce.

Maintain a known-good fixture:

```text
Broken Level v0
   ↓
Counterexample
   ↓
Known Patch
   ↓
Fixed Level v1
   ↓
PASS
```

The live AI path may generate a fresh level, but there must always be a fallback fixture.

Fallbacks must be transparent in development and must never fabricate verifier output.

Do not use hidden key commands to fake success. A deterministic fixture is acceptable; a simulated success presented as live verification is not.

---

## Performance targets

Initial MVP targets:

- verifier execution: comfortably below 500 ms for demo-sized levels
- patch application: effectively instantaneous
- UI event latency: visually responsive
- generation: dependent on external model latency
- repair: dependent on external model latency

Benchmark the verifier independently from LLM latency.

If verification exceeds the target, reduce level dimensions/state complexity before introducing infrastructure.

---

## Testing requirements

Every meaningful verifier change requires tests for:

### Physics

- valid movement
- blocked movement
- short jump
- long jump
- hazard collision
- boundary collision
- gravity
- landing

### Search

- reachable level
- unreachable level
- shortest path reconstruction
- state deduplication
- useful counterexample

### Constraints

- required jump count
- minimum path length
- alternative routes
- difficulty classification
- constraint violation

### Patches

- valid patch
- invalid coordinate
- invalid tile
- START preservation
- GOAL preservation
- patch produces expected level

### Integration

At least one complete deterministic flow:

```text
broken level
→ verify fail
→ patch
→ verify pass
```

---

## Security and robustness

Never execute LLM-generated code.

Never interpolate untrusted model text directly into shell commands, SQL, or source code.

Validate all model output before applying it.

Apply bounds to:

- level dimensions
- tile count
- patch operation count
- retry count
- prompt/input length
- search states

The model must not be able to cause an unbounded BFS.

---

## Development phases

### Phase 1 - Deterministic verifier & structural validator

Build first:

- types (`GameState`, `Counterexample`, `LevelSpec`, `PhysicsConfig`)
- structural validator (`validateLevelStructure`)
- physics engine with discrete swept collision
- BFS verifier with closest-to-goal `failure_node` and `gap_to_goal`
- fixtures with strictly validated row lengths
- tests & benchmarks (<500 ms)

Exit criterion:

```text
JSON Level
→ structural validator
→ verifier
→ PASS or actionable Counterexample with closest failure node
```

### Phase 2 - Patch engine

Build:

- patch schema validation
- deterministic patch application (`applyPatch`)
- fail → patch → verify integration

Exit criterion:

```text
Broken fixture
→ Counterexample
→ hardcoded patch
→ PASS
```

### Phase 3 - Constraint engine & parametric rules regression

Build:

- required jumps
- minimum path length
- `no_trivial_route` enforcement
- deterministic difficulty profile
- structured `CONSTRAINT_VIOLATION` counterexamples
- **Parametric physics configuration** (`PhysicsConfig`): allow changing jump distance (e.g. from 4 to 3) to test regression over a suite of levels.

Exit criterion:

```text
Playable ≠ automatically accepted.
Altering jump physics cleanly invalidates edge-case levels and signals re-verification.
```

### Phase 4 - Intent compiler & LevelSpec generator

Build:

- model client
- intent compilation prompt (extracting target constraints and aesthetic tags)
- structured `LevelSpec` output (platform and hazard rectangles)
- deterministic `compileLevelSpec` into canonical tile grid
- schema validation and generation retries

Exit criterion:

```text
Natural language intent
→ intent constraints + LevelSpec
→ compiled Level
```

### Phase 5 - AI repairer & ablation benchmark

Build:

- counterexample prompt with `failure_node`, `gap_to_goal`, and `violated` constraint
- structured `LevelPatch` output
- patch validation and bounded retry loop (max 3 retries)
- **Ablation benchmark runner**:
  - Test suite of 20-30 varied intents
  - Measures First-Shot validity rate vs Post-Repair validity rate
  - Compares LLM repair against a dumb heuristic repairer (e.g. naive gap bridge)
  - Proves quantitatively that LLM repairs preserve intent and difficulty constraints whereas naive heuristics collapse them.

Exit criterion:

```text
Generated failure
→ Counterexample
→ AI patch
→ verifier pass
→ Ablation benchmark produces clear evidence table
```

### Phase 6 - Backend orchestration

Build:

- API/session layer
- WebSocket events (streamed verification progress)
- Endpoints for generation, verification, repair, sabotage, and regression test

Exit criterion:

One browser action triggers the full pipeline.

### Phase 7 - Frontend & judge sabotage interaction

Build:

- canvas level renderer with tile themes
- agent trajectory animation with discrete stepping
- counterexample visualization overlay (closest reachable node + red collision point)
- repair timeline with patch diff inspection
- **Judge sabotage interaction**: Interactive UI button / click-to-edit allowing a judge to drop a hazard or delete a platform, instantly triggering the verifier and live AI repair.
- **Intent compilation panel**: Visual cards showing intent terms mapped to hard constraints.
- Play mode stepping the identical `PhysicsEngine` macro-actions.

Exit criterion:

A judge can interact, sabotage a level, see instant verification, and play the repaired level.

### Phase 8 - Polish

Add only:

- transitions
- clear status states
- compact metrics & ablation statistics table
- responsive layout
- deterministic demo fixture

### Phase 9 - Demo and submission

Prepare:

- live deployment
- GitHub
- README
- architecture diagram
- demo video
- 2-3 minute demo flow

---

## Demo script

Target duration: approximately 2.5 minutes.

### 0:00-0:20 - Hook & Intent Compilation

> "Generative AI can create a game level in seconds. But how does it know the level is actually beatable or adheres to design rules? ForgeLoop makes the game try to break what AI creates."

Show the **Intent Compilation Panel**:
User enters: *"A tense platformer requiring three precise jumps with no straight walk to the goal."*
The LLM compiles this into explicit machine constraints: `required_jumps: 3`, `min_path_length: 15`, `no_trivial_route: true`, `target_difficulty: MEDIUM`.

### 0:20-0:50 - Generation & Verifier Challenge

Candidate `LevelSpec` is generated and deterministically compiled into tiles.
The verifier runs in 1 ms.
**Failure detected:** The agent leaps across a chasm, but the landing platform is 1 tile out of reach.
Counterexample highlighted on screen:
- `failure_node`: (8, 4) (closest reachable state to goal)
- `attempted_action`: JUMP_LONG
- `gap_to_goal`: 4 tiles right, 0 tiles down
- Reason: "JUMP_LONG trajectory collides with HAZARD / has no valid landing platform"

### 0:50-1:15 - Surgical AI Repair

Counterexample is passed to the AI repairer.
AI returns a minimal `LevelPatch` (`REPLACE_TILE` at (10, 4) with `GROUND`).
Patch is deterministically applied and re-verified.
Result:
```text
✓ REACHABLE
✓ 3 REQUIRED JUMPS SATISFIED
✓ NO TRIVIAL ROUTE CONFIRMED
✓ DIFFICULTY: MEDIUM
```

### 1:15-1:45 - The Judge Sabotage Moment (Live Interactive Proof)

> "Now let's see what happens if someone deliberately breaks the level."

Click the **Judge Sabotage** tool: Drop a `HAZARD` right on the critical jump path.
Instantly (<5 ms), the verifier flags the broken level, renders the new counterexample, and the AI repairs the detour path live in front of the judge.

### 1:45-2:05 - Rules-Change Regression & Ablation Evidence

Show the **Game Tech Pipeline**:
Change character physics in `PhysicsConfig`: reduce `longJumpDistance` from 4 to 3.
Click **Run Regression**: ForgeLoop re-verifies the level suite, flags levels that became impossible under the new physics, and synthesizes updated layouts.
Show the **Ablation Benchmark Panel**: First-shot validity (35%) vs Post-repair validity (92%), proving why the LLM repair loop is essential.

### 2:05-2:30 - Play Mode & Closing

Switch to **Play Mode**. Control the character using the identical discrete macro-actions through the verified level.

Closing statement:
> "ForgeLoop turns generative game design into a closed engineering loop: compile intent, generate, challenge, repair, verify, and regress."

---

## Judge questions to prepare for

### Why not just procedural generation?

Answer in terms of high-level design intent plus executable verification. The differentiator is not random generation; it is combining semantic intent with machine-checkable constraints and counterexample-guided repair.

### Why an LLM?

The LLM interprets high-level creative intent and proposes modifications. It does not determine correctness.

### Why not a real physics engine?

The prototype deliberately uses a deterministic discrete game model to make the verification loop fast, reproducible, and explainable. The verifier boundary can later sit over a production game runtime.

### Is the level mathematically proven playable?

No. Say:

> "It is verified playable under our deterministic game model and declared constraints."

### What is the moat?

The counterexample-guided loop and the separation between generative reasoning and executable verification.

---

## What not to claim

Never claim:

- universally playable
- mathematically proven playable
- production-ready AAA physics
- human-level game design
- zero hallucinations
- guaranteed difficulty perception
- guaranteed commercial impact

Use precise claims supported by measurements.

---

## Coding style

- TypeScript strict mode
- Small pure functions where possible
- Explicit types at module boundaries
- No `any` unless unavoidable and documented
- No hidden mutable global state
- No unnecessary abstraction layers
- Comments explain non-obvious game-model decisions
- Prefer deterministic functions
- Keep verifier code independent from React

Before adding a dependency, ask:

1. Does it materially reduce implementation time?
2. Does it improve reliability?
3. Could we implement the required subset ourselves in under an hour?

If the third answer is yes, prefer the simpler local implementation during the hackathon.

---

## Git discipline

Use small, meaningful commits:

```text
feat(verifier): add deterministic transition model
feat(verifier): add BFS reachability search
feat(patches): add validated level patches
feat(ai): add structured level generator
feat(ai): add counterexample repairer
feat(server): add verification websocket events
feat(ui): add level visualization
feat(ui): add verification timeline
feat(ui): add play mode
fix(verifier): prevent unreachable-state loop
```

Do not make one enormous "build everything" commit.

---

## Definition of Done

ForgeLoop is demo-ready when all of the following are true:

- [ ] deterministic verifier passes all core tests
- [ ] verifier completes demo levels comfortably under 500 ms
- [ ] hardcoded fail → patch → pass loop works
- [ ] design constraints are machine-checked
- [ ] LLM generator returns schema-valid levels
- [ ] LLM repairer returns schema-valid patches
- [ ] patches are validated before application
- [ ] maximum AI repair attempts are bounded
- [ ] browser visualizes generation and verification
- [ ] counterexample is visibly tied to a failure location
- [ ] repaired level visibly changes
- [ ] verified level can be played
- [ ] known-good fallback fixture works
- [ ] no fake verifier output exists
- [ ] deployment works
- [ ] GitHub README explains the architecture
- [ ] demo can be completed in under 3 minutes

When forced to choose, prioritize in this order:

```text
Verifier correctness
→ End-to-end loop
→ Demo clarity
→ AI quality
→ UX polish
→ Optional features
```
