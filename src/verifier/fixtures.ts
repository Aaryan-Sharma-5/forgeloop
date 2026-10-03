import type { Level, LevelPatch } from "../types.js";

/**
 * Deterministic Level Fixtures for testing, fail->patch->pass verification,
 * constraint evaluation, and reliable offline live demo fallback paths.
 */

// 1. Chasm Failure: 5-tile gap cannot be crossed by long jump (max distance 4).
export const CHASM_BROKEN_LEVEL: Level = {
  width: 12,
  height: 7,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "AIR", "AIR", "AIR", "AIR", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "AIR", "AIR", "AIR", "AIR", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "HAZARD", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 2,
    min_path_length: 2,
    target_difficulty: "MEDIUM",
    no_trivial_route: true,
  },
};

// Surgical Patch: Place a stepping stone at (5, 4) turning the 5-tile impossible gap into two reachable jumps!
export const CHASM_REPAIR_PATCH: LevelPatch = {
  operations: [
    {
      type: "REPLACE_TILE",
      x: 5,
      y: 4,
      newTile: "GROUND",
    },
  ],
};

// 2. Hazard Obstruction Failure: Hazard wall blocking the passage
export const HAZARD_OBSTRUCTED_LEVEL: Level = {
  width: 10,
  height: 6,
  tiles: [
    ["AIR", "AIR", "AIR", "HAZARD", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "HAZARD", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "HAZARD", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 0,
    min_path_length: 2,
    target_difficulty: "EASY",
  },
};

// Surgical Patch: Remove the hazard wall at x=3 by replacing with AIR
export const HAZARD_REPAIR_PATCH: LevelPatch = {
  operations: [
    {
      type: "REPLACE_TILE",
      x: 3,
      y: 2,
      newTile: "AIR",
    },
    {
      type: "REPLACE_TILE",
      x: 3,
      y: 1,
      newTile: "AIR",
    },
    {
      type: "REPLACE_TILE",
      x: 3,
      y: 0,
      newTile: "AIR",
    },
  ],
};

// 3. Calibrated Difficulty Fixture: EASY
// 8x5 level: simple single short jump over a 1-tile gap, low exploration
export const EASY_LEVEL_FIXTURE: Level = {
  width: 8,
  height: 5,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "AIR", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "HAZARD", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 1,
    min_path_length: 1,
    target_difficulty: "EASY",
    no_trivial_route: true,
  },
};

// 4. Calibrated Difficulty Fixture: MEDIUM
// 12x6 level: two distinct chasms requiring JUMP_SHORT then JUMP_LONG
export const MEDIUM_LEVEL_FIXTURE: Level = {
  width: 12,
  height: 6,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "AIR", "GROUND", "AIR", "AIR", "AIR", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 2,
    min_path_length: 3,
    target_difficulty: "MEDIUM",
    no_trivial_route: true,
  },
};

// 5. Calibrated Difficulty Fixture: HARD
// 16x7 level: four chained jumps across isolated pillars over hazards
export const HARD_LEVEL_FIXTURE: Level = {
  width: 16,
  height: 7,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "AIR", "GROUND", "AIR", "AIR", "AIR", "GROUND", "AIR", "GROUND", "AIR", "AIR", "AIR", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "HAZARD", "GROUND", "HAZARD", "HAZARD", "HAZARD", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 4,
    min_path_length: 4,
    target_difficulty: "HARD",
    no_trivial_route: true,
  },
};

// 6. Playable-but-invalid: Insufficient jumps (solvable with 1 jump, requires 3)
export const PLAYABLE_INSUFFICIENT_JUMPS_FIXTURE: Level = {
  width: 10,
  height: 5,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "AIR", "AIR", "AIR", "GOAL", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "AIR", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "HAZARD", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 3, // Requires 3, but only 1 jump is needed!
    min_path_length: 1,
    target_difficulty: "HARD",
  },
};

// 7. Playable-but-invalid: Short path violation (solved in 2 actions, min length 10)
export const PLAYABLE_SHORT_PATH_FIXTURE: Level = {
  width: 8,
  height: 5,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "AIR", "AIR", "GOAL", "AIR", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 0,
    min_path_length: 10, // Requires 10 actions, but goal is only 3 tiles away!
    target_difficulty: "EASY",
  },
};

// 8. Playable-but-invalid: Trivial route violation (flat straight walking floor, no_trivial_route: true)
export const PLAYABLE_TRIVIAL_ROUTE_FIXTURE: Level = {
  width: 8,
  height: 5,
  tiles: [
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["AIR", "START", "GOAL", "AIR", "AIR", "AIR", "AIR", "AIR"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
    ["GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND", "GROUND"],
  ],
  constraints: {
    required_jumps: 0,
    min_path_length: 1,
    target_difficulty: "EASY",
    no_trivial_route: true, // Forbids pure flat walking!
  },
};
