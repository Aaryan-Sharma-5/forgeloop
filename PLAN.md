# PLAN.md: ForgeLoop Industrial Editorial UI/UX Redesign

## Goal
Redesign the frontend UI/UX of ForgeLoop into an authored **Industrial Editorial + Swiss Technical / Engineering Instrumentation** level-design workstation. Eliminate all dark cyberpunk, generic AI SaaS tropes, and unnecessary decoration while preserving 100% of existing functionality, backend contracts, and SSE state flows.

---

## Design System Tokens
- **Canvas / Background**: Warm neutral paper tone (`#F2F0EB`)
- **Surfaces**: Architectural warm stone (`#E8E6E0` panel base, `#FAF9F6` elevated readout)
- **Dividers & Borders**: Thin precision rules (`#C9C6BD`, `#B8B4A8`)
- **Typography Colors**: Near-black ink (`#171717` primary), warm slate (`#686762` secondary), light border ink (`#9B978F`)
- **State Colors (Strictly Functional)**:
  - Technical Accent / Active: Deep Cobalt (`#1B4B8A`)
  - Verification Pass: Forest Emerald (`#1C6B3E`)
  - Verification Failure / Lethal: Rust Crimson (`#A82A2A`)
  - Warning / In-Progress: Ochre Amber (`#A86E1B`)
- **Typography Hierarchy**:
  - Primary Sans: Swiss Technical / Editorial Sans stack (`"Space Grotesk"`, `system-ui`, `-apple-system`, `sans-serif`) with high-contrast weight hierarchy
  - Technical Monospace: Strict drafting mono (`"JetBrains Mono"`, `"IBM Plex Mono"`, `Consolas`, `monospace`) for coordinates, action steps, and state metrics
- **Geometry**: Sharp 2px corner radius max, 1px structural hair-thin borders, no floating dropshadows, no blur/glassmorphism

---

## Implementation Steps & Verification

### Step 1: Design Tokens & Typography Foundation (`web/src/index.css`)
- Replace the dark cyberpunk palette with the warm paper industrial editorial token system.
- Establish strict typographic scale, monospace technical labels, micro-metadata tags, and tabular data alignments.
- **Verification**: `npm run build:web` succeeds; base background and fonts load cleanly with crisp contrast.

### Step 2: LevelCanvas CAD / Blueprint Viewport Redesign (`web/src/components/LevelCanvas.tsx`)
- Transform canvas into an engineering coordinate viewport:
  - Drafting-table grid background with coordinate axis rulers $(X: 0..W-1, Y: 0..H-1)$.
  - Solid technical blocks for GROUND with clean architectural hatching/strokes.
  - Distinct hazard stripes/markers for HAZARD.
  - Precision START and GOAL pins with technical typography labels.
  - Failure node telemetry: clear dotted vector indicating closest reached node, gap to goal, and collision coordinate.
  - Patch diff overlay: crisp cross-hatching highlighting surgical tile modifications.
- **Verification**: Render level across empty, initial synthesis, failure with counterexample, and patched states.

### Step 3: Information Architecture & Header Chrome (`web/src/App.tsx`)
- Restructure top bar into a technical instrumentation readout:
  - `FORGELOOP // VERIFICATION WORKSTATION`
  - Active Session ID, SSE Connection readout, Authoritative Verifier State badge.
  - Quick action buttons (Benchmark Report, Clear Session) styled as physical instrument switches.
- Layout rearrangement:
  - Visual hero priority: LevelCanvas in dominant upper-center.
  - Left panel: Intent Station with formatted prompt input and tabular target specs.
  - Right panel: Diagnostic Inspector with tabbed engineering readouts.
  - Bottom panel: Full-width CEGIS Event Trace timeline.
- **Verification**: `npm run build:web`; layout responsive on both desktop (multi-panel workstation) and mobile.

### Step 4: Verification Diagnostic Panel & Counterexample Telemetry (`web/src/components/VerificationPanel.tsx`)
- Structure as an engineering instrumentation readout rather than a colorful card:
  - Big mechanical STATUS indicator (`PASS` or `FAILED`).
  - Strict two-column telemetry grid: Status, Solution Action Sequence, Steps Count, Explored States, Difficulty Rating.
  - When FAILED: Counterexample telemetry box displaying Exact Failure Node $(x,y)$, Collision Coordinate, Manhattan Gap vector $(dx, dy)$, and Violated Constraint delta.
- **Verification**: Verify both PASS (action sequence breakdown) and FAILED (counterexample telemetry) states render cleanly without text overflow.

### Step 5: CEGIS Event Trace Timeline (`web/src/components/RepairTimeline.tsx`)
- Redesign timeline as an authoritatively sequenced engineering debugger trace:
  - Numbered step execution: `01 INTENT`, `02 SPEC_GENERATED`, `03 LEVEL_GENERATED`, `04 VERIFICATION_FAILED`, `05 COUNTEREXAMPLE`, `06 PATCH_PROPOSED`, `07 RE-VERIFICATION`, `08 PASS`.
  - Monospace timestamps, structured patch diffs, and clear state markers.
- **Verification**: Trigger a synthesis and repair flow; verify all events render sequentially with accurate timeline hierarchy.

### Step 6: Sabotage Station & Autonomous Repair Trigger (`web/src/components/JudgeSabotagePanel.tsx`)
- Style sabotage tools as deliberate failure-injection switches (`CUT BRIDGE`, `DROP HAZARD`).
- When verifier reports failure, expose high-contrast `[ TRIGGER AUTONOMOUS REPAIR ]` primary action.
- **Verification**: Inject Cut Bridge sabotage; verify counterexample displays and Autonomous Repair heals level back to PASSED.

### Step 7: Constraint Comparison, Physics Bench, Play Mode & Benchmark Polish
- `ConstraintPanel.tsx`: Two-column declared vs verified delta table with highlighting only on deviation.
- `PhysicsRegressionPanel.tsx`: Parameter adjustment bench showing immediate model invalidation.
- `PlayMode.tsx`: Viewport mode overlay with clear verification lock status.
- `BenchmarkPanel.tsx`: Technical evaluation table for the 6-scenario ablation test.
- **Verification**: Verify each secondary tab and modal works with zero functional regression.

### Step 8: End-to-End Verification & Visual Audit
- Run `npm run build:web` (0 errors).
- Run `npm test` and `npm run test:live` (0 backend regressions).
- Perform visual audit against the anti-AI / Swiss engineering principles: no purple, no gradients, no neon, no cards-for-everything.
