import type { Level, LevelPatch } from "../types.js";

/**
 * Deterministic Level Fixtures for testing, fail->patch->pass verification,
 * and reliable offline live demo fallback paths.
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

// Surgical Patch: Place a stepping stone at (6, 4) turning the 5-tile impossible gap into two reachable jumps!
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
