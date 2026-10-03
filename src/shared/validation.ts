import type { Level, LevelSpec, TileType } from "../types.js";

const VALID_TILES: Set<string> = new Set([
  "AIR",
  "GROUND",
  "HAZARD",
  "START",
  "GOAL",
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Zero-trust structural validator for Level representations.
 * Ensures the level strictly adheres to integer grid dimensions,
 * has valid tile types, and contains exactly one START and one GOAL.
 */
export function validateLevelStructure(level: Level): ValidationResult {
  const errors: string[] = [];

  if (!level) {
    return { valid: false, errors: ["Level object is null or undefined"] };
  }

  if (typeof level.width !== "number" || level.width <= 0 || !Number.isInteger(level.width)) {
    errors.push(`Invalid width: expected positive integer, got ${level.width}`);
  }

  if (typeof level.height !== "number" || level.height <= 0 || !Number.isInteger(level.height)) {
    errors.push(`Invalid height: expected positive integer, got ${level.height}`);
  }

  if (!Array.isArray(level.tiles)) {
    errors.push("tiles must be a 2D array");
    return { valid: false, errors };
  }

  if (level.tiles.length !== level.height) {
    errors.push(
      `tiles row count mismatch: expected ${level.height} rows, found ${level.tiles.length}`
    );
  }

  let startCount = 0;
  let goalCount = 0;
  let startPos: { x: number; y: number } | null = null;
  let goalPos: { x: number; y: number } | null = null;

  for (let y = 0; y < level.tiles.length; y++) {
    const row = level.tiles[y];
    if (!Array.isArray(row)) {
      errors.push(`tiles[${y}] is not an array`);
      continue;
    }

    if (row.length !== level.width) {
      errors.push(
        `Row ${y} length mismatch: expected ${level.width} tiles, found ${row.length}`
      );
    }

    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (!tile || !VALID_TILES.has(tile)) {
        errors.push(`Invalid tile at (${x}, ${y}): "${tile}"`);
      }
      if (tile === "START") {
        startCount++;
        startPos = { x, y };
      } else if (tile === "GOAL") {
        goalCount++;
        goalPos = { x, y };
      }
    }
  }

  if (startCount !== 1) {
    errors.push(`Level must have exactly one START tile, found ${startCount}`);
  }

  if (goalCount !== 1) {
    errors.push(`Level must have exactly one GOAL tile, found ${goalCount}`);
  }

  if (startPos && goalPos && startPos.x === goalPos.x && startPos.y === goalPos.y) {
    errors.push("START and GOAL cannot occupy the same coordinate");
  }

  if (!level.constraints || typeof level.constraints !== "object") {
    errors.push("Missing or invalid constraints object");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deterministically compiles a geometric LevelSpec (platforms & hazard rectangles)
 * into a canonical discrete Level tile grid.
 */
export function compileLevelSpec(spec: LevelSpec): Level {
  if (!spec || spec.width <= 0 || spec.height <= 0) {
    throw new Error("Invalid LevelSpec dimensions");
  }

  // Initialize empty AIR grid
  const tiles: TileType[][] = Array.from({ length: spec.height }, () =>
    Array.from({ length: spec.width }, () => "AIR")
  );

  // Paint platforms
  if (Array.isArray(spec.platforms)) {
    for (const rect of spec.platforms) {
      const minX = Math.max(0, rect.x);
      const maxX = Math.min(spec.width, rect.x + rect.w);
      const minY = Math.max(0, rect.y);
      const maxY = Math.min(spec.height, rect.y + rect.h);

      for (let y = minY; y < maxY; y++) {
        const row = tiles[y];
        if (!row) continue;
        for (let x = minX; x < maxX; x++) {
          row[x] = "GROUND";
        }
      }
    }
  }

  // Paint hazards
  if (Array.isArray(spec.hazards)) {
    for (const rect of spec.hazards) {
      const minX = Math.max(0, rect.x);
      const maxX = Math.min(spec.width, rect.x + rect.w);
      const minY = Math.max(0, rect.y);
      const maxY = Math.min(spec.height, rect.y + rect.h);

      for (let y = minY; y < maxY; y++) {
        const row = tiles[y];
        if (!row) continue;
        for (let x = minX; x < maxX; x++) {
          row[x] = "HAZARD";
        }
      }
    }
  }

  // Place START and GOAL
  if (
    spec.start.x >= 0 &&
    spec.start.x < spec.width &&
    spec.start.y >= 0 &&
    spec.start.y < spec.height
  ) {
    const row = tiles[spec.start.y];
    if (row) row[spec.start.x] = "START";
  }

  if (
    spec.goal.x >= 0 &&
    spec.goal.x < spec.width &&
    spec.goal.y >= 0 &&
    spec.goal.y < spec.height
  ) {
    const row = tiles[spec.goal.y];
    if (row) row[spec.goal.x] = "GOAL";
  }

  const level: Level = {
    width: spec.width,
    height: spec.height,
    tiles,
    constraints: spec.constraints,
  };

  const validation = validateLevelStructure(level);
  if (!validation.valid) {
    throw new Error(
      `LevelSpec compiled to invalid Level: ${validation.errors.join("; ")}`
    );
  }

  return level;
}
