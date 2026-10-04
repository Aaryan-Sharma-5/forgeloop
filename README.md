# ForgeLoop

**Autonomous, Counterexample-Guided Level Design & Verification Workstation for 2D Platformers**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff.svg)](https://vitejs.dev/)
[![Track](https://img.shields.io/badge/Track-Game%20Tech-orange.svg)](#hackathon-context)

---

### AI proposes. The game model verifies. Counterexamples drive repair.

ForgeLoop is an autonomous, counterexample-guided level design and verification workstation for 2D platformers. It translates natural-language game-design intent into structured level specifications, compiles candidate levels, deterministically verifies them under a canonical discrete physics model, extracts structured counterexamples upon failure, employs an AI repairer to propose minimal surgical patches, and re-verifies the result before permitting Play Mode.

```text
       NATURAL LANGUAGE INTENT
                 │
                 ▼
          ┌─────────────┐
          │ AI PROPOSER │
          └──────┬──────┘
                 │ LevelSpec IR (Rectangular Platforms & Hazards)
                 ▼
        ┌─────────────────┐
        │ LEVEL GENERATOR │
        └────────┬────────┘
                 │ Canonical 12×8 Tile Matrix
                 ▼
        ┌─────────────────┐
        │  DETERMINISTIC  │
        │  BFS VERIFIER   │
        └────────┬────────┘
                 │
         ┌───────┴────────┐
         │                │
       PASS             FAIL
         │                │
         ▼                ▼
    PLAYABLE        COUNTEREXAMPLE
  (Play Mode)            │ (Failure Node, Collision Coord, Gap Vector)
                         ▼
                  ┌─────────────┐
                  │ AI REPAIRER │
                  └──────┬──────┘
                         │ Minimal LevelPatch (1–3 Tile Delta)
                         ▼
             DETERMINISTIC RE-VERIFY
                         │
                         └──────→ PASS → PLAY MODE
```

ForgeLoop repeatedly reinforces the foundational boundary between **creative generation** and **deterministic correctness**: natural language expresses creative intent, but only deterministic computation establishes gameplay reality.

---

## Table of Contents

- [Why ForgeLoop Exists](#why-forgeloop-exists)
- [Four Real-World Game Tech Usecases](#four-real-world-game-tech-usecases)
- [The Core Idea: CEGIS Architecture](#the-core-idea-cegis-architecture)
- [The Architectural Proof: The (2,6) → (3,6) Collision](#the-architectural-proof-the-26--36-collision)
- [Trust Boundary: AI vs. Deterministic Logic](#trust-boundary-ai-vs-deterministic-logic)
- [System Architecture](#system-architecture)
- [Discrete Game Model](#discrete-game-model)
- [Parametric Physics Model](#parametric-physics-model)
- [Authoritative BFS Verification Engine](#authoritative-bfs-verification-engine)
- [Constraint System & Calibrated Difficulty Model](#constraint-system--calibrated-difficulty-model)
- [Surgical Patch Engine](#surgical-patch-engine)
- [AI Generation & Intent Compilation](#ai-generation--intent-compilation)
- [Bounded Repair Loop](#bounded-repair-loop)
- [Interactive Judge Sabotage](#interactive-judge-sabotage)
- [Physics Regression Bench](#physics-regression-bench)
- [Web Workstation Interface](#web-workstation-interface)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Reference](#api-reference)
- [Event Stream (SSE Protocol)](#event-stream-sse-protocol)
- [Testing](#testing)
- [Ablation Benchmark Report](#ablation-benchmark-report)
- [Current Verification Status](#current-verification-status)
- [Limitations](#limitations)
- [Why This Is Different](#why-this-is-different)
- [Demo Walkthrough Flow](#demo-walkthrough-flow)
- [Hackathon Context](#hackathon-context)
- [Roadmap](#roadmap)
- [License & Notes](#license--notes)

---

## Why ForgeLoop Exists

Generative AI models are capable of synthesizing 2D platformer geometry that *looks* visually plausible. However, visual plausibility is not equivalent to gameplay correctness.

Typical failure modes in raw generative game design include:
- **Unreachable goals**: Missing platforms, chasms exceeding maximum jump apex or reach.
- **Impossible jumps**: Obstacles positioned directly into discrete jump trajectories.
- **Blocked corridors**: Solid geometry placed on walking planes.
- **Lethal collision vectors**: Hazards that cannot be cleared without taking damage.
- **Constraint violations**: Levels solvable in fewer jumps than the designer required.
- **Trivial bypasses**: Flat, unobstructed floor routes that completely circumvent intended platforming challenges.
- **Physics invalidation**: Previously functional levels rendered impossible when a gameplay engineer tweaks jump distances.

Traditional generative workflows address these failures through brute-force filtering (rerolling random seeds until one works), rigid hand-authored procedural templates, or expensive human QA cycles.

### Does ForgeLoop replace human QA?
**No.** Professional game studios require human playtesters for game feel, pacing, aesthetics, player psychology, and fun. ForgeLoop addresses a narrower, highly defensible engineering problem:

> **ForgeLoop automates deterministic correctness checks and machine-verifiable gameplay constraints that would otherwise require repeated manual validation.**

---

## Four Real-World Game Tech Usecases

### 1. Automated Procedural Level Pipelines
- **The Problem:** Live-service studios want to generate 10,000 level variations overnight. Without automated verification, teams either deploy soft-locked levels to players or incur unsustainable manual QA costs.
- **The ForgeLoop Solution:** Headless verification tests candidate seeds in milliseconds. Unsolvable layouts emit counterexamples, undergo automated bounded repair, and only deterministically verified levels are committed to the game database.

### 2. Player-Prompted Custom Levels
- **The Problem:** A player prompts: *"Make me a hard level with 3 long jumps and no trivial walking route."* An LLM cannot verify if its output actually requires 3 jumps or if a player can simply walk underneath the obstacles.
- **The ForgeLoop Solution:** Natural language defines intent; deterministic computation defines reality. The verifier checks both reachability and strict constraint satisfaction (minimum path length, required jump count, and no-trivial-route enforcement).

### 3. Physics & Balance Regression Testing (CI/CD for Game Engines)
- **The Problem:** A gameplay designer tweaks a character parameter (e.g. nerfing `LONG_JUMP_DISTANCE` from 4 to 3 tiles). Studios have no automated way of knowing which of their 500 existing levels were broken by the patch.
- **The ForgeLoop Solution:** ForgeLoop's parametric physics bench allows designers to adjust jump reach or gravity and immediately rerun regression verification across the entire catalog, flagging invalidated levels with pinpoint failure nodes.

### 4. Counterexample-Guided Surgical Repair
- **The Problem:** When an AI level fails, naive generators discard the entire level and reroll from scratch, destroying level layout continuity and designer intent.
- **The ForgeLoop Solution:** ForgeLoop isolates the exact failure node and collision point. The AI repair model acts as a surgeon, applying a minimal 1–3 tile delta patch (e.g., placing a stepping stone or clearing an obstacle) and re-verifying in under 400ms.

---

## The Core Idea: CEGIS Architecture

ForgeLoop adapts **Counterexample-Guided Inductive Synthesis (CEGIS)** from formal methods to level design:

```text
Candidate Level
      ↓
Deterministic Verifier
      ↓
    FAILED
      ↓
Extract Structured Counterexample
      ↓
AI Surgical Repair
      ↓
Apply Minimal Patch
      ↓
Deterministic Re-Verification
      ↓
    PASSED
```

A verification failure in ForgeLoop is never treated as a fatal crash or an opaque error string. Instead, the engine produces **structured mathematical evidence**:

```json
{
  "status": "FAILED",
  "counterexample": {
    "status": "FAILED_REACHABILITY",
    "reason": "Movement blocked by GROUND",
    "failure_node": { "x": 2, "y": 6 },
    "attempted_action": "MOVE_RIGHT",
    "collision_at": { "x": 3, "y": 6 },
    "gap_to_goal": {
      "dx": 8,
      "dy": 0,
      "manhattan_distance": 8
    },
    "metrics": {
      "states_explored": 12,
      "max_reached_distance": 2
    }
  }
}
```

This telemetry is injected directly into the repair prompt, constraining the AI to resolve the exact spatial conflict identified by the physics engine.

---

## The Architectural Proof: The (2,6) → (3,6) Collision

During testing, an LLM proposed an autonomous repair that placed solid `GROUND` tiles along row $y=6$ (the player's walking plane).

To an unconstrained language model, placing ground tiles looked like a plausible bridge. But the deterministic verifier immediately rejected the patch: placing ground at $(3,6)$ formed a solid wall in front of the player standing at $(2,6)$:

```text
STATUS: FAILED // FAILED_REACHABILITY
Reason:          Movement blocked by GROUND
Failure Node:    (2, 6)
Collision Point: (3, 6)
Attempted:       MOVE_RIGHT
```

> **"The AI thought this was a valid repair. The verifier disagreed. ForgeLoop does not trust the model. It trusts the game model."**

This concrete failure demonstrates the core architectural value: generative AI cannot evaluate its own spatial physics. The deterministic verifier is the sole authoritative arbiter of correctness.

---

## Trust Boundary: AI vs. Deterministic Logic

ForgeLoop implements a strict **Zero-Trust AI Architecture**. The language model is completely quarantined from the evaluation and execution engines.

| System Responsibility | AI Layer (Untrusted) | Deterministic Layer (Authoritative) |
|---|:---:|:---:|
| **Natural Language Interpretation** | **Authoritative** (Compiles intent to constraints) | Non-participating |
| **LevelSpec Synthesis** | **Proposer** (Outputs platform/hazard rectangles) | Non-participating |
| **Level Compilation** | Non-participating | **Authoritative** (`compileLevelSpec`) |
| **Syntactic & Structural Validation** | Non-participating | **Authoritative** (`validateLevelStructure`) |
| **Physics State Transitions** | Non-participating | **Authoritative** (`PhysicsEngine.applyAction`) |
| **Collision Detection** | Non-participating | **Authoritative** (Swept integer collision) |
| **Reachability & Path Search** | Non-participating | **Authoritative** (`BFSVerifier`) |
| **Constraint Satisfaction** | Non-participating | **Authoritative** (`checkConstraints`) |
| **Difficulty Metric Calculation** | Non-participating | **Authoritative** (`evaluateDifficulty`) |
| **Counterexample Extraction** | Non-participating | **Authoritative** (`extractCounterexample`) |
| **Repair Mutation** | **Proposer** (Synthesizes minimal patch) | Non-participating |
| **Patch Validation & Application** | Non-participating | **Authoritative** (`validateLevelPatch` & `applyPatch`) |
| **Final PASS / FAIL Decision** | Non-participating | **Authoritative** (Sole gatekeeper to Play Mode) |

The AI is never permitted to declare that a level passed verification.

---

## System Architecture

ForgeLoop is structured as a decoupled client-server architecture communicating over HTTP REST and Server-Sent Events (SSE):

```text
                    BROWSER / CLIENT
             ┌─────────────────────────────┐
             │   React 19 Web Workstation  │
             │   (LevelCanvas, Telemetry,   │
             │    PlayMode, Sabotage, Bench)│
             └──────────────┬──────────────┘
                            │
               HTTP POST    │    Server-Sent Events (SSE)
               Commands     │    Live Event Stream
                            ▼
                    BACKEND SERVER
             ┌─────────────────────────────┐
             │         ForgeServer         │
             │   (REST & SSE Orchestrator) │
             └──────────────┬──────────────┘
                            │ Manages isolated instances
                            ▼
             ┌─────────────────────────────┐
             │        ForgeSession         │
             │   (State & Lifecycle Host)  │
             └──────────────┬──────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
      ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ AI Compiler │       │Deterministic│       │ AI Repairer │
│(Intent to   │       │ BFSVerifier │       │(Counter-    │
│ LevelSpec)  │       │(State Search│       │ example to  │
│             │       │& Constraints│       │ LevelPatch) │
└─────────────┘       └─────────────┘       └─────────────┘
```

- **Frontend**: Single-page application built with React 19 and Vite. Renders the live CAD drafting canvas, streams server telemetry in real time via SSE, and hosts an integrated Play Mode.
- **Backend Orchestrator (`ForgeServer`)**: Native Node.js HTTP server. Exposes REST endpoints for session lifecycle, sabotage, and repair, alongside a persistent `/events` SSE stream.
- **Session State (`ForgeSession`)**: Maintains isolated session state machines, event histories, and active level matrices.
- **Deterministic Engine**: Headless TypeScript modules executing physics simulation, BFS exploration, constraint checks, and patch mutations.
- **AI Layer**: Client adapters for Groq LLM inference with automated fallback to deterministic mock models.

---

## Discrete Game Model

ForgeLoop intentionally models a bounded integer grid rather than continuous floating-point physics. This design choice ensures that the state space is finite, discrete, and exhaustively searchable in milliseconds.

### Grid Dimensions
Canonical levels are strictly bounded to:
- **Width**: 12 tiles ($x \in [0, 11]$)
- **Height**: 8 tiles ($y \in [0, 7]$)

Coordinate $(0,0)$ represents the top-left tile. Tiles are accessed in row-major order: `tiles[y][x]`.

### Tile Vocabulary
- `AIR` (`.`): Traversible empty space.
- `GROUND` (`#`): Solid impassable obstacle. Provides footing when below the player.
- `HAZARD` (`^`): Lethal surface. Entering or touching a hazard immediately fails the trajectory.
- `START` (`S`): Starting coordinate for the player (exactly one per level).
- `GOAL` (`G`): Exit coordinate (exactly one per level).

### Action Vocabulary
- `MOVE_LEFT`: Shift position by $(-1, 0)$. Valid only when grounded.
- `MOVE_RIGHT`: Shift position by $(+1, 0)$. Valid only when grounded.
- `JUMP_SHORT`: Discrete arc traversing 2 horizontal tiles and 1 vertical tile apex.
- `JUMP_LONG`: Discrete arc traversing 4 horizontal tiles and 1 vertical tile apex.
- `WAIT`: Fall vertically by gravity until landing on ground or out of bounds.

---

## Parametric Physics Model

All state transitions are deterministic, discrete, and integer-based:

```typescript
export interface PhysicsConfig {
  shortJumpDistance: number; // default: 2
  longJumpDistance: number;  // default: 4
  jumpApexHeight: number;    // default: 1
  gravityStep: number;       // default: 1
}
```

### Shared Engine Invariant
The physics transition rules in `src/verifier/PhysicsEngine.ts` are identical across:
1. **The Headless Verifier** during BFS exploration.
2. **The Frontend Play Mode** during interactive human play.

Play Mode does not use a secondary continuous physics engine. The exact jump arc verified by the backend is the jump arc executed by the player.

---

## Authoritative BFS Verification Engine

The verifier (`src/verifier/BFSVerifier.ts`) exhaustively explores all reachable player states $(x, y, \text{grounded}, \text{facing})$ from the `START` position using Breadth-First Search.

### Verification Lifecycle
1. **Structural Validation**: Ensures 12×8 dimensions, valid tile vocabulary, exactly one `START`, and exactly one `GOAL`.
2. **State Space Exploration**: Dequeues candidate states, evaluates all legal macro-actions, performs swept collision checks against `GROUND` and `HAZARD`, and deduplicates visited states.
3. **Tracking Nearest Node**: Continuously tracks the state with the minimum Manhattan distance to `GOAL`.
4. **Path Reconstruction**: If `GOAL` is reached, backtracks through state parents to reconstruct the optimal macro-action sequence.
5. **Constraint Evaluation**: Verifies whether the solution satisfies required jumps, path length, and difficulty thresholds.

### Verification Status Classes
- `PASSED`: Level is reachably solvable and satisfies all declared design constraints.
- `FAILED_REACHABILITY`: No valid action sequence reaches the `GOAL`. Emits coordinates of the closest explored state, attempted action, and collision coordinate.
- `CONSTRAINT_VIOLATION`: The `GOAL` is reachable, but the solution violates design rules (e.g., solved in 1 jump when 3 were required).
- `INVALID_STRUCTURE`: Level matrix violates dimension, coordinate, or boundary invariants.

---

## Constraint System & Calibrated Difficulty Model

### Supported Constraints

```typescript
export interface LevelConstraints {
  required_jumps: number;
  min_path_length: number;
  target_difficulty: "EASY" | "MEDIUM" | "HARD";
  no_trivial_route?: boolean;
}
```

| Constraint | Declared Intent | Measured Reality | Enforcement Action |
|---|---|---|---|
| `required_jumps` | e.g. 3 | Count of critical jump actions in solution | Reject if $\text{actual} < \text{declared}$ |
| `min_path_length` | e.g. 15 | Total macro-action count to reach goal | Reject if $\text{length} < \text{declared}$ |
| `no_trivial_route` | `true` | Checks for alternative 0-jump walking paths | Reject if level bypasses platforming |
| `target_difficulty`| `MEDIUM` | Calibrated difficulty composite score | Reject on mismatch (if enabled) |

### Calibrated Difficulty Scoring Formula

ForgeLoop evaluates difficulty using a deterministic scoring formula derived from empirical search metrics:

$$\text{score} = (\text{pathLength} \times 2) + (\text{criticalJumps} \times 15) + \min(30, \lfloor\text{explored} / 4\rfloor) - \min(20, \text{alternatives} \times 2)$$

- **EASY**: $\text{score} \le 34$
- **MEDIUM**: $35 \le \text{score} \le 69$
- **HARD**: $\text{score} \ge 70$

> [!NOTE]
> This formula is a **calibrated engineering heuristic** designed for ForgeLoop's discrete 12×8 grid model. It does not claim to represent a universal, psychometrically validated human perception model.

---

## Surgical Patch Engine

When a level fails verification, ForgeLoop does not regenerate the layout from scratch. Discarding the level destroys designer intent and aesthetic continuity.

Instead, the repair model generates a bounded **surgical patch** (`src/verifier/patches.ts`):

```json
{
  "operations": [
    {
      "type": "REPLACE_TILE",
      "x": 4,
      "y": 5,
      "newTile": "GROUND"
    }
  ]
}
```

### Strict Patch Validation Rules
- **Bounds Checking**: Coordinates must lie within $x \in [0, 11]$ and $y \in [0, 7]$.
- **Vocabulary Protection**: Patches may only place `AIR`, `GROUND`, or `HAZARD`. Patches cannot place `START` or `GOAL`.
- **Anchor Immutability**: Any operation attempting to overwrite the level's existing `START` or `GOAL` tile is rejected.
- **Operation Limit**: Maximum 10 operations per patch.
- **Coordinate Uniqueness**: Duplicate edits to the same coordinate in a single patch are rejected.
- **Immutability**: `applyPatch()` returns a new level clone; the original level instance is never mutated.

---

## AI Generation & Intent Compilation

Generative synthesis operates through an intermediate representation (IR) to prevent hallucinated grid dimensions:

```text
Natural Language Intent: "Floating islands with 3 long jumps, hazardous floor"
                         │
                         ▼
               ┌───────────────────┐
               │   IntentCompiler  │
               └─────────┬─────────┘
                         │
                         ▼
               ┌───────────────────┐
               │   LevelSpec IR    │ (Platforms & Hazards as Rectangles)
               └─────────┬─────────┘
                         │
                         ▼
               ┌───────────────────┐
               │ compileLevelSpec  │ (Deterministic Integer Compiler)
               └─────────┬─────────┘
                         │
                         ▼
               ┌───────────────────┐
               │  Canonical Level  │ (12×8 Tile Grid)
               └───────────────────┘
```

### Rectangular Intermediate Representation (`LevelSpec`)
Rather than forcing language models to output raw ASCII characters with delicate line-length counts, models generate bounding rectangles:

```typescript
export interface LevelSpec {
  width: 12;
  height: 8;
  platforms: { x: number; y: number; w: number; h: number }[];
  hazards: { x: number; y: number; w: number; h: number }[];
  start: { x: number; y: number };
  goal: { x: number; y: number };
  constraints: LevelConstraints;
}
```

The deterministic function `compileLevelSpec()` translates these rectangles onto the grid, ensuring zero formatting drift.

### Groq Integration & Offline Mock Fallback
- **Live Mode**: If `GROQ_API_KEY` is present in the environment, ForgeLoop invokes Groq's high-speed inference engine running `llama-3.3-70b-versatile` with JSON schema enforcement.
- **Offline Mock Fallback**: If `GROQ_API_KEY` is absent or the API fails, ForgeLoop automatically switches to deterministic mock models that return pre-calibrated geometric structures. This guarantees 100% demo uptime and offline developer testing.

---

## Bounded Repair Loop

ForgeLoop orchestrates a closed synthesis-repair loop:

1. **First-Shot Generation**: Compiler produces candidate `LevelSpec` $\to$ compiled to `Level`.
2. **Verification Gate**: `BFSVerifier` checks reachability and constraints.
3. **If PASS**: Session completes; Play Mode is unlocked.
4. **If FAIL**:
   - Extract structured `Counterexample`.
   - Pass counterexample to `LevelRepairModel`.
   - Validate and apply `LevelPatch`.
   - Rerun `BFSVerifier`.
5. **Loop Termination**: The loop terminates immediately upon `PASSED` or aborts after a maximum of **3 repair attempts**.

---

## Interactive Judge Sabotage

To prove that ForgeLoop performs authentic verification rather than playing back canned scripts, the workstation includes **Judge Sabotage Mode**.

Judges can actively attack a verified level directly from the interface:
- **`CUT_BRIDGE`**: Removes a critical platform tile between the player and goal, replacing it with `AIR`.
- **`DROP_HAZARD`**: Drops a lethal `HAZARD` spike directly onto the player's jumping path.

### The Sabotage → Repair Proof
1. The judge clicks **Cut Bridge** on a verified level.
2. Within `<5 ms`, the verifier catches the breach and updates the UI with a red collision marker and counterexample telemetry.
3. The judge clicks **[ TRIGGER AUTONOMOUS REPAIR ]**.
4. The backend passes the new counterexample to the repairer, generates a surgical bypass patch, re-verifies the level, and achieves `PASSED` in `<400 ms`.

---

## Physics Regression Bench

Game studios frequently balance character movement parameters during production. ForgeLoop serves as a **rules-change regression engine**:

1. A designer changes `longJumpDistance` from $4 \to 3$ (a jump nerf).
2. The user executes **Run Regression Verification**.
3. ForgeLoop re-evaluates the existing level using the modified `PhysicsConfig`.
4. If a previously solvable gap now exceeds the player's 3-tile reach, the verifier flags the regression:
   ```text
   STATUS: FAILED // POST_REGRESSION
   Reason: Gap distance exceeds longJumpDistance=3
   Failure Node: (4, 4)
   ```
5. The designer can trigger autonomous repair to reposition platforms to fit the new physics profile.

---

## Web Workstation Interface

ForgeLoop's user interface is styled as a precision **Industrial Editorial & Swiss Technical Workstation** (warm architectural paper `#F3F1EB`, technical cobalt `#1A4476`, rust crimson `#A52828`, and precision $1\text{px}$ dividers `#C6C2B6`).

### Core Panels
- **CAD Drafting Canvas (`LevelCanvas.tsx`)**: Displays the 12×8 grid with $X/Y$ coordinate axis rulers, technical cross-hatching, hazard stripes, failure coordinate vectors, and patch diff overlays.
- **Verification Telemetry (`VerificationPanel.tsx`)**: High-contrast engineering readout showing explored state counts, solution action sequences, and exact counterexample coordinates.
- **CEGIS Event Trace (`RepairTimeline.tsx`)**: Chronological sequential debugger log displaying numbered events (`01 INTENT`, `02 SPEC`, `03 VERIFY`, `04 COUNTEREXAMPLE`, `05 PATCH`, `06 RE-VERIFY`, `07 PASS`).
- **Constraint Matrix (`ConstraintPanel.tsx`)**: Tabular comparison of declared constraints against measured solution metrics.
- **Judge Sabotage Panel (`JudgeSabotagePanel.tsx`)**: Failure injection switches (`CUT BRIDGE`, `DROP HAZARD`) and the manual autonomous repair trigger.
- **Physics Bench (`PhysicsRegressionPanel.tsx`)**: Sliders for jump reach, apex, and gravity with instant regression testing.
- **Interactive Play Mode (`PlayMode.tsx`)**: Embedded playable canvas unlocked only after verification passes.
- **Benchmark Panel (`BenchmarkPanel.tsx`)**: Comparative ablation table evaluating first-shot generation vs. repair.

<!-- Screenshot Placeholders -->
<!-- ![ForgeLoop CAD Workstation](docs/assets/workstation.png) -->
<!-- ![Counterexample Telemetry and Repair](docs/assets/repair-loop.png) -->
<!-- ![Judge Sabotage Mode](docs/assets/sabotage-repair.png) -->
> *Screenshots can be added to `docs/assets/`.*

---

## Repository Structure

```text
forgeloop/
├── src/
│   ├── types.ts                      # Canonical shared contracts, types, and schemas
│   ├── index.ts                      # Core library export entrypoint
│   ├── verifier/
│   │   ├── PhysicsEngine.ts          # Deterministic discrete physics simulator
│   │   ├── BFSVerifier.ts            # Authoritative BFS state-space reachability verifier
│   │   ├── constraints.ts            # Constraint evaluator and calibrated difficulty model
│   │   ├── patches.ts                # Surgical LevelPatch validator and immutable applicator
│   │   └── fixtures.ts               # Calibrated level fixtures for deterministic testing
│   ├── ai/
│   │   ├── schemas.ts                # JSON schemas and parser/validator for LevelSpec & patches
│   │   ├── prompts.ts                # System prompts for intent compilation and surgical repair
│   │   ├── compiler.ts               # IntentCompiler: natural language -> LevelSpec IR
│   │   ├── generator.ts              # LevelGenerator: compiles LevelSpec into discrete Level
│   │   ├── repairer.ts               # LevelRepairer: converts counterexamples into LevelPatches
│   │   └── benchmark.ts              # 6-scenario empirical ablation benchmark harness
│   ├── server/
│   │   ├── protocol.ts               # Client commands and SSE server events contracts
│   │   ├── session.ts                # ForgeSession state machine and event emitter
│   │   ├── server.ts                 # ForgeServer: HTTP REST API and SSE stream gateway
│   │   └── start.ts                  # Production server startup CLI entrypoint
│   └── shared/
│       └── validation.ts             # Level matrix structural validator
├── web/                              # React 19 + Vite Frontend Application
│   ├── index.html                    # Root HTML document
│   ├── vite.config.ts                # Vite bundler configuration
│   └── src/
│       ├── App.tsx                   # Main Workstation layout and tab controller
│       ├── index.css                 # Industrial Editorial / Swiss Technical design tokens
│       ├── components/
│       │   ├── LevelCanvas.tsx       # CAD drafting viewport with coordinate rulers and overlays
│       │   ├── VerificationPanel.tsx # Engineering telemetry readout for verification & failures
│       │   ├── ConstraintPanel.tsx   # Declared vs. measured constraint matrix
│       │   ├── RepairTimeline.tsx    # Sequential CEGIS debugger event log
│       │   ├── JudgeSabotagePanel.tsx# Live failure injection and repair trigger station
│       │   ├── PhysicsRegressionPanel.tsx # Parametric physics regression test bench
│       │   ├── PlayMode.tsx          # Interactive player canvas sharing verifier physics
│       │   └── BenchmarkPanel.tsx    # Ablation comparison modal table
│       └── lib/
│           ├── api.ts                # HTTP REST API client functions
│           └── events.ts             # Server-Sent Events (SSE) connection manager
├── tests/
│   ├── run.mjs                       # Verifier and physics unit tests
│   ├── patches.test.mjs              # Patch engine unit and integration tests
│   ├── constraints.test.mjs          # Constraint and difficulty evaluation tests
│   ├── generator.test.mjs            # AI compiler and schema validation tests
│   ├── repairer.test.mjs             # AI repairer and ablation benchmark tests
│   ├── server.test.mjs               # ForgeServer REST, SSE, and session isolation tests
│   └── live-groq-e2e.test.mjs        # End-to-end live Groq API validation test
├── docs/                             # Documentation assets
├── package.json                      # Root npm scripts and dependencies
├── tsconfig.json                     # TypeScript compiler configuration
├── CLAUDE.md                         # Architecture reference and agent instructions
├── AGENTS.md                         # Multi-agent operating rules
├── SUBMISSION.md                     # Hackathon submission kit and presentation script
└── README.md                         # This document
```

---

## Installation

### Prerequisites
- **Node.js**: Version 20.0.0 or higher
- **npm**: Version 9.0.0 or higher

### Install Dependencies

```bash
# 1. Install root backend dependencies
npm install

# 2. Install web frontend dependencies
npm install --prefix web
```

---

## Environment Variables

Create a `.env` file in the project root:

```bash
# Optional: Groq Cloud API Key for live LLM inference
# If omitted or invalid, ForgeLoop automatically operates in deterministic mock mode.
GROQ_API_KEY=gsk_your_api_key_here
```

| Variable | Required? | Default | Description |
|---|:---:|:---:|---|
| `GROQ_API_KEY` | Optional | `undefined` | Enables live Groq `llama-3.3-70b-versatile` intent compilation and repair. When absent, the system uses deterministic mock models. |
| `PORT` | Optional | `3000` | Port for the backend HTTP REST and SSE server. |

---

## Running Locally

### Development Mode (Concurrent Terminals)

**Terminal 1: Start Backend Server (Port 3000)**
```bash
npm start
```
*Builds TypeScript and starts the HTTP REST & SSE server on `http://localhost:3000`.*

**Terminal 2: Start Frontend Workstation (Port 5173)**
```bash
npm run dev --prefix web
```
*Launches the Vite development server on `http://localhost:5173`.*

Open **http://localhost:5173** in your browser.

### Production Build

```bash
# Compile backend TypeScript and bundle frontend for production
npm run build:all
```

---

## API Reference

The backend `ForgeServer` provides native HTTP REST endpoints:

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Health check endpoint returning `{ status: "ok", uptime }`. |
| `POST` | `/api/sessions` | Creates and starts a new level session. Body: `{ intent: string, sync?: boolean }`. |
| `GET` | `/api/sessions/:id` | Returns the current session snapshot, level matrix, and event history. |
| `GET` | `/api/sessions/:id/events` | **Server-Sent Events (SSE)** endpoint. Streams live session events to client. |
| `POST` | `/api/sessions/:id/sabotage` | Injects a structural failure into an active level. Body: `{ action: "CUT_BRIDGE" \| "DROP_HAZARD" }`. |
| `POST` | `/api/sessions/:id/repair` | Triggers autonomous surgical repair on a damaged or failed level. |
| `POST` | `/api/command` | Unified command gateway executing validated `ClientCommand` payloads. |
| `GET` | `/api/benchmark` | Executes the 6-scenario empirical ablation benchmark and returns telemetry. |

---

## Event Stream (SSE Protocol)

Clients subscribe to `/api/sessions/:id/events` to receive real-time, strongly-typed execution events:

```text
SESSION_STARTED          -> Session initialized with unique ID
INTENT_RECEIVED          -> Natural language prompt captured
SPEC_GENERATED           -> Rectangular LevelSpec compiled by AI
LEVEL_GENERATED          -> Canonical 12×8 Level matrix compiled
VERIFICATION_STARTED     -> BFS verifier begins reachable state exploration
VERIFICATION_COMPLETED   -> Telemetry emitted: PASSED or FAILED + Counterexample
REPAIR_STARTED           -> AI repairer invoked with failure coordinates
PATCH_PROPOSED           -> Surgical 1–3 tile delta synthesized
PATCH_APPLIED            -> Level matrix immutably updated
REPAIR_COMPLETED         -> Repair attempt cycle finished
SESSION_COMPLETED        -> Final level verified playable; Play Mode unlocked
ERROR                    -> Schema or boundary error emitted
```

---

## Testing

ForgeLoop maintains a zero-dependency test harness covering 100% of core verification, physics, patch, generator, and server functionality.

### Run All Test Suites
```bash
npm test
```

This single command compiles TypeScript and sequentially executes all 6 test suites:
1. `tests/run.mjs`: Core BFS verifier, integer physics transitions, swept collisions, and performance benchmarks.
2. `tests/patches.test.mjs`: Patch engine validation, bounds checks, START/GOAL preservation, and fail $\to$ patch $\to$ pass fixtures.
3. `tests/constraints.test.mjs`: Difficulty scoring monotonicity, required jumps, min path length, and no-trivial-route enforcement.
4. `tests/generator.test.mjs`: Strict LevelSpec schema checks, rectangular compilation, and isolated model client interfaces.
5. `tests/repairer.test.mjs`: Bounded repair loop, counterexample ingestion, zero-trust patch checks, and benchmark comparison.
6. `tests/server.test.mjs`: HTTP REST endpoints, protocol command validation, session state isolation, sabotage, and SSE event streaming.

### Live Groq E2E Test
```bash
npm run test:live
```
*Validates the live remote Groq API against `llama-3.3-70b-versatile` (requires `GROQ_API_KEY` in `.env`).*

### Frontend Build & Typecheck
```bash
npm run build:web
```
*Typechecks TypeScript and builds the production bundle via Vite.*

---

## Ablation Benchmark Report

To evaluate whether generative AI repair provides value over naive heuristics or raw unverified generation, ForgeLoop includes an embedded benchmark harness (`src/ai/benchmark.ts`).

### Current Six-Scenario Deterministic Engineering Benchmark
*Tested across 6 calibrated layout scenarios (long gaps, hazard corridors, wall obstructions, height steps):*

| Strategy | Scenarios Tested | Initial Failures | Final Pass Count | Success Rate | Average Attempts | Average Operations |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **First-Shot Generation** | 6 | 4 | 2 | **33.3%** | 0.00 | 0.00 |
| **Naive Heuristic (Brute Force)** | 6 | 4 | 3 | **50.0%** | 0.67 | 0.33 |
| **ForgeLoop AI Repair (CEGIS)** | 6 | 4 | 4 | **66.7%** | 1.33 | 2.33 |

- **First-Shot Generation Fails Often**: Unverified generative models produce unplayable geometry in ~66% of complex scenarios.
- **Naive Heuristics Destroy Gameplay**: Dumb gap-filling heuristics bridge chasms with flat floor tiles, violating jump requirements and rendering the level trivial.
- **ForgeLoop CEGIS Preserves Intent**: The counterexample-guided repair model places targeted stepping stones or removes specific obstructions, satisfying both reachability and design constraints.

> [!NOTE]
> These figures represent our **current six-scenario deterministic engineering benchmark**. They serve as an internal regression baseline, not a generalized statistical claim across all possible game topologies.

---

## Current Verification Status

- **Backend**: **6/6 test suites passing** (100% assertions satisfied).
- **Frontend**: Production build passes with **0 TypeScript and 0 Vite bundling errors**.
- **Performance**: Deterministic BFS verification runs in **$<5\text{ ms}$** per level (comfortably below the 500ms target).
- **Working Tree**: Clean on `main`.

---

## Limitations

Technical integrity requires honest documentation of constraints:

1. **Discrete Grid vs. Continuous Physics**: ForgeLoop models discrete integer platformer mechanics. It does not simulate continuous Newtonian rigid bodies, floating-point vectors, momentum conservation, or friction.
2. **Model-Bounded Solvability**: "Verified playable" means provably reachable under ForgeLoop's discrete transition rules and declared constraints. It is not an absolute mathematical guarantee for arbitrary commercial game engines.
3. **Calibrated Difficulty Heuristic**: The difficulty scoring system is a deterministic heuristic tuned for 12×8 platformers. It cannot measure psychological factors such as visual distraction or player dexterity.
4. **LLM Non-Determinism**: Live LLMs can generate malformed or unhelpful patches. ForgeLoop protects itself using strict schema validation and deterministic fallbacks, but live model performance remains dependent on external API latency and stability.
5. **Aesthetics & Fun**: The verifier only proves physical solvability and constraint satisfaction. It cannot verify whether an art style is aesthetically pleasing or whether a gameplay sequence is emotionally satisfying.

---

## Why This Is Different

```text
TRADITIONAL GENERATIVE WORKFLOW
User Prompt ──► LLM ──► Game Level ──► Hope It Works ──► Human Finds Bugs

FORGELOOP CEGIS WORKFLOW
User Prompt ──► LLM ──► LevelSpec ──► BFS Verifier ──► Counterexample ──► AI Patch ──► Re-Verify ──► Verified Level
```

Most AI game demos present an open loop: a prompt goes in, an asset comes out, and the user is left to discover whether it functions.

ForgeLoop closes the engineering loop: the model's output is treated as untrusted input, subjected to rigorous spatial analysis, and repaired using mathematical evidence before a player ever touches the keyboard.

---

## Demo Walkthrough Flow

For hackathon judges and evaluators, the recommended live demonstration sequence takes under 3 minutes:

1. **Review Initial Intent**: Observe the default prompt (*"A precision platformer requiring three jumps across dangerous chasms"*).
2. **Inspect First-Shot Failure**: Point out the intentional $(2,6) \to (3,6)$ reachability collision where the AI blocked its own path.
3. **Examine Counterexample**: Show the verifier telemetry displaying the exact failure node, collision coordinate, and Manhattan gap distance.
4. **Trigger Autonomous Repair**: Click **[ TRIGGER AUTONOMOUS REPAIR ]** and watch the sequential trace apply the surgical tile patch and achieve `PASSED` in real time.
5. **Interactive Play**: Switch to **Play Mode** and navigate the character through the verified level using `Arrow Keys` and `Z/X` jump controls.
6. **Judge Sabotage**: Open the Sabotage panel, click **Cut Bridge**, and watch the verifier instantly flag the broken trajectory. Click **Trigger Repair** to watch ForgeLoop heal the level live.
7. **Physics Regression**: Open the **Physics Bench**, change `Long Jump Distance` from 4 to 3, and run regression to demonstrate automated broken-level detection.

---

## Hackathon Context

ForgeLoop is submitted to the **Game Tech Track** of the **Tencent × Arcade AI Hackathon**.

The project is intentionally developed as **game development infrastructure and production tooling** rather than a consumer game. It addresses core track themes:
- World generation and level synthesis.
- Simulation and deterministic state-space exploration.
- Developer tools and automated QA pipelines.

*Note: ForgeLoop is an independent hackathon entry submitted to the competition and is not an official product of Tencent or Arcade.*

---

## Roadmap

Future engineering directions for ForgeLoop:
- **3D Navigation Meshes**: Extending discrete BFS search to 3D navmesh jump-link reachability.
- **Engine Exporters**: Exporting verified levels directly into Godot 4 and Unity scene formats.
- **Procedural Chunk Stacking**: Verifying endless-runner level chunks for continuous solvability across random stitch points.
- **Custom Player Trajectory Profiles**: Allowing designers to import custom jump curves and hitboxes via JSON.

---

## License & Notes

- **License**: Not yet specified (All rights reserved during hackathon judging).
- **Core Principle**: AI proposes. The game model verifies. Counterexamples drive repair.
