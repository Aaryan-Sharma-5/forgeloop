import type { Level, LevelPatch, LevelPatchOperation, TileType } from "../types.js";
import { validateLevelStructure } from "../shared/validation.js";

const VALID_TILES: Set<string> = new Set([
  "AIR",
  "GROUND",
  "HAZARD",
  "START",
  "GOAL",
]);

export const DEFAULT_MAX_PATCH_OPERATIONS = 10;

export interface PatchValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PatchApplyResult {
  success: boolean;
  level: Level;
  appliedCount: number;
  errors: string[];
}

export interface PatchOptions {
  maxOperations?: number;
  allowReplaceEndpoints?: boolean;
}

/**
 * Validates a LevelPatch against a target Level.
 * Enforces boundary checks, tile vocabulary, mutation limits,
 * and endpoint protection (START / GOAL).
 */
export function validatePatch(
  level: Level,
  patch: LevelPatch,
  options?: PatchOptions
): PatchValidationResult {
  const errors: string[] = [];
  const maxOps = options?.maxOperations ?? DEFAULT_MAX_PATCH_OPERATIONS;
  const allowEndpoints = options?.allowReplaceEndpoints ?? false;

  if (!patch || !Array.isArray(patch.operations)) {
    return { valid: false, errors: ["Patch must contain an 'operations' array"] };
  }

  if (patch.operations.length > maxOps) {
    errors.push(
      `Patch operation count (${patch.operations.length}) exceeds maximum allowable limit (${maxOps})`
    );
  }

  const seenCoords = new Set<string>();

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    if (!op || op.type !== "REPLACE_TILE") {
      errors.push(`Operation #${i} has invalid type: expected "REPLACE_TILE"`);
      continue;
    }

    if (
      typeof op.x !== "number" ||
      !Number.isInteger(op.x) ||
      op.x < 0 ||
      op.x >= level.width
    ) {
      errors.push(
        `Operation #${i} has out-of-bounds x coordinate (${op.x}) for width ${level.width}`
      );
    }

    if (
      typeof op.y !== "number" ||
      !Number.isInteger(op.y) ||
      op.y < 0 ||
      op.y >= level.height
    ) {
      errors.push(
        `Operation #${i} has out-of-bounds y coordinate (${op.y}) for height ${level.height}`
      );
    }

    if (!op.newTile || !VALID_TILES.has(op.newTile)) {
      errors.push(`Operation #${i} specifies invalid tile type: "${op.newTile}"`);
    }

    const coordKey = `${op.x},${op.y}`;
    if (seenCoords.has(coordKey)) {
      errors.push(
        `Operation #${i} duplicates coordinate (${op.x}, ${op.y}) already modified in this patch`
      );
    }
    seenCoords.add(coordKey);

    // Endpoint protection
    if (!allowEndpoints && op.x >= 0 && op.x < level.width && op.y >= 0 && op.y < level.height) {
      const currentTile = level.tiles[op.y]?.[op.x];
      if (currentTile === "START") {
        errors.push(`Operation #${i} attempts to overwrite START tile at (${op.x}, ${op.y})`);
      }
      if (currentTile === "GOAL") {
        errors.push(`Operation #${i} attempts to overwrite GOAL tile at (${op.x}, ${op.y})`);
      }
      if (op.newTile === "START" || op.newTile === "GOAL") {
        errors.push(
          `Operation #${i} attempts to create duplicate ${op.newTile} tile at (${op.x}, ${op.y})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deterministically applies a LevelPatch to a Level immutably.
 * Returns the cloned updated Level and execution metrics.
 */
export function applyPatch(
  level: Level,
  patch: LevelPatch,
  options?: PatchOptions
): PatchApplyResult {
  const validation = validatePatch(level, patch, options);
  if (!validation.valid) {
    return {
      success: false,
      level,
      appliedCount: 0,
      errors: validation.errors,
    };
  }

  // Deep clone tiles array to preserve immutability
  const newTiles: TileType[][] = level.tiles.map((row) => [...row]);

  for (const op of patch.operations) {
    const row = newTiles[op.y];
    if (row) {
      row[op.x] = op.newTile;
    }
  }

  const updatedLevel: Level = {
    width: level.width,
    height: level.height,
    tiles: newTiles,
    constraints: { ...level.constraints },
  };

  // Structural sanity check on the patched output
  const structuralCheck = validateLevelStructure(updatedLevel);
  if (!structuralCheck.valid) {
    return {
      success: false,
      level,
      appliedCount: 0,
      errors: [`Patched level failed structural validation: ${structuralCheck.errors.join("; ")}`],
    };
  }

  return {
    success: true,
    level: updatedLevel,
    appliedCount: patch.operations.length,
    errors: [],
  };
}

/**
 * Computes a minimal LevelPatch representing the diff between two levels of identical dimensions.
 * Useful for inspection, UI diff visualization, and testing.
 */
export function computePatch(before: Level, after: Level): LevelPatch {
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(
      `Cannot compute patch between levels with mismatched dimensions (${before.width}x${before.height} vs ${after.width}x${after.height})`
    );
  }

  const operations: LevelPatchOperation[] = [];

  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const tileBefore = before.tiles[y]?.[x];
      const tileAfter = after.tiles[y]?.[x];

      if (tileBefore !== tileAfter && tileAfter !== undefined) {
        operations.push({
          type: "REPLACE_TILE",
          x,
          y,
          newTile: tileAfter,
        });
      }
    }
  }

  return { operations };
}
