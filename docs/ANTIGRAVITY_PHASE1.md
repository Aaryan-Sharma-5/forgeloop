# Antigravity: Phase 1 Prompt

We are building the headless Verifier for ForgeLoop, a discrete 2D platformer level-synthesis prototype.

Do not introduce continuous physics, floating-point coordinates, frame-based gravity integration, Matter.js, Box2D, Phaser, Unity, or Godot.

1. Preserve the immutable contracts in `src/types.ts`.
2. `PhysicsEngine.applyAction()` must remain deterministic and integer-based.
3. Jumps are predefined macro-actions, not continuous trajectories.
4. The verifier must remain a finite-state BFS over the discrete game model.
5. Return structured counterexamples for failed transitions and unreachable goals.
6. Keep deterministic verification authoritative. LLM code will be added later and must never decide whether a level is playable.
7. Add tests before changing verifier semantics.
8. Benchmark the verifier and keep the MVP path comfortably below 500 ms for representative demo levels.

Before making changes, inspect the existing verifier and tests. Propose the smallest implementation needed for the requested Phase 1 task.
