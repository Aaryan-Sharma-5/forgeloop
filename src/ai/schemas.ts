import type { LevelSpec, RectSpec, LevelConstraints, DifficultyGrade } from "../types.js";

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  spec?: LevelSpec | undefined;
}

const VALID_DIFFICULTIES: Set<string> = new Set(["EASY", "MEDIUM", "HARD"]);

/**
 * Standard JSON Schema for LevelSpec, suitable for LLM structured output
 * (e.g. Groq / OpenAI response_format).
 */
export const LEVEL_SPEC_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "LevelSpec",
  type: "object",
  required: ["width", "height", "platforms", "hazards", "start", "goal", "constraints"],
  additionalProperties: false,
  properties: {
    width: {
      type: "integer",
      description: "Grid width (columns). Standard default is 12.",
      minimum: 4,
      maximum: 32,
    },
    height: {
      type: "integer",
      description: "Grid height (rows). Standard default is 8.",
      minimum: 4,
      maximum: 16,
    },
    platforms: {
      type: "array",
      description: "List of solid platform rectangles where player can stand.",
      items: {
        type: "object",
        required: ["x", "y", "w", "h"],
        additionalProperties: false,
        properties: {
          x: { type: "integer", description: "Top-left X coordinate (0-indexed)" },
          y: { type: "integer", description: "Top-left Y coordinate (0-indexed, 0 is top)" },
          w: { type: "integer", description: "Width in tiles (>= 1)", minimum: 1 },
          h: { type: "integer", description: "Height in tiles (>= 1)", minimum: 1 },
        },
      },
    },
    hazards: {
      type: "array",
      description: "List of hazard rectangles (lethal upon contact).",
      items: {
        type: "object",
        required: ["x", "y", "w", "h"],
        additionalProperties: false,
        properties: {
          x: { type: "integer", description: "Top-left X coordinate (0-indexed)" },
          y: { type: "integer", description: "Top-left Y coordinate (0-indexed, 0 is top)" },
          w: { type: "integer", description: "Width in tiles (>= 1)", minimum: 1 },
          h: { type: "integer", description: "Height in tiles (>= 1)", minimum: 1 },
        },
      },
    },
    start: {
      type: "object",
      required: ["x", "y"],
      additionalProperties: false,
      properties: {
        x: { type: "integer", description: "Player start X coordinate" },
        y: { type: "integer", description: "Player start Y coordinate" },
      },
    },
    goal: {
      type: "object",
      required: ["x", "y"],
      additionalProperties: false,
      properties: {
        x: { type: "integer", description: "Goal flag X coordinate" },
        y: { type: "integer", description: "Goal flag Y coordinate" },
      },
    },
    constraints: {
      type: "object",
      required: ["required_jumps", "min_path_length", "target_difficulty"],
      additionalProperties: false,
      properties: {
        required_jumps: {
          type: "integer",
          description: "Minimum jump actions required to reach goal",
          minimum: 0,
        },
        min_path_length: {
          type: "integer",
          description: "Minimum discrete action steps (MOVE/JUMP) in verified solution. NOT tile distance! Typically 2 to 4.",
          minimum: 1,
        },
        target_difficulty: {
          type: "string",
          enum: ["EASY", "MEDIUM", "HARD"],
          description: "Calibrated target difficulty tier",
        },
        no_trivial_route: {
          type: "boolean",
          description: "If true, rejects solutions solvable by walking without jumping",
        },
      },
    },
  },
} as const;

/**
 * Strict validator for LevelSpec geometric IR.
 * Validates types, bounds, rectangle geometry, start/goal placement,
 * and constraint specifications without running executable code.
 */
export function validateLevelSpec(input: unknown): SpecValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["LevelSpec must be a non-null object"] };
  }

  const raw = input as Record<string, unknown>;

  // 1. Width & Height
  if (typeof raw.width !== "number" || !Number.isInteger(raw.width) || raw.width <= 0) {
    errors.push(`Invalid width: expected positive integer, got ${raw.width}`);
  }
  if (typeof raw.height !== "number" || !Number.isInteger(raw.height) || raw.height <= 0) {
    errors.push(`Invalid height: expected positive integer, got ${raw.height}`);
  }

  const width = typeof raw.width === "number" && raw.width > 0 ? raw.width : 0;
  const height = typeof raw.height === "number" && raw.height > 0 ? raw.height : 0;

  // 2. Platforms
  if (!Array.isArray(raw.platforms)) {
    errors.push("platforms must be an array of RectSpec objects");
  } else {
    for (let i = 0; i < raw.platforms.length; i++) {
      const p = raw.platforms[i];
      const pErrors = validateRectSpec(p, `platforms[${i}]`, width, height);
      errors.push(...pErrors);
    }
  }

  // 3. Hazards
  if (!Array.isArray(raw.hazards)) {
    errors.push("hazards must be an array of RectSpec objects");
  } else {
    for (let i = 0; i < raw.hazards.length; i++) {
      const h = raw.hazards[i];
      const hErrors = validateRectSpec(h, `hazards[${i}]`, width, height);
      errors.push(...hErrors);
    }
  }

  // 4. Start Position
  if (!raw.start || typeof raw.start !== "object") {
    errors.push("start must be an object with { x, y } coordinates");
  } else {
    const s = raw.start as Record<string, unknown>;
    if (typeof s.x !== "number" || !Number.isInteger(s.x) || s.x < 0 || (width > 0 && s.x >= width)) {
      errors.push(`start.x (${s.x}) out of bounds [0, ${width - 1}]`);
    }
    if (typeof s.y !== "number" || !Number.isInteger(s.y) || s.y < 0 || (height > 0 && s.y >= height)) {
      errors.push(`start.y (${s.y}) out of bounds [0, ${height - 1}]`);
    }
  }

  // 5. Goal Position
  if (!raw.goal || typeof raw.goal !== "object") {
    errors.push("goal must be an object with { x, y } coordinates");
  } else {
    const g = raw.goal as Record<string, unknown>;
    if (typeof g.x !== "number" || !Number.isInteger(g.x) || g.x < 0 || (width > 0 && g.x >= width)) {
      errors.push(`goal.x (${g.x}) out of bounds [0, ${width - 1}]`);
    }
    if (typeof g.y !== "number" || !Number.isInteger(g.y) || g.y < 0 || (height > 0 && g.y >= height)) {
      errors.push(`goal.y (${g.y}) out of bounds [0, ${height - 1}]`);
    }
  }

  // Start & Goal overlap
  if (
    raw.start &&
    typeof raw.start === "object" &&
    raw.goal &&
    typeof raw.goal === "object"
  ) {
    const s = raw.start as { x?: number; y?: number };
    const g = raw.goal as { x?: number; y?: number };
    if (typeof s.x === "number" && s.x === g.x && typeof s.y === "number" && s.y === g.y) {
      errors.push("start and goal cannot be at the exact same coordinate");
    }
  }

  // 6. Constraints
  if (!raw.constraints || typeof raw.constraints !== "object") {
    errors.push("constraints must be an object");
  } else {
    const c = raw.constraints as Record<string, unknown>;
    if (typeof c.required_jumps !== "number" || !Number.isInteger(c.required_jumps) || c.required_jumps < 0) {
      errors.push(`constraints.required_jumps must be non-negative integer, got ${c.required_jumps}`);
    }
    if (typeof c.min_path_length !== "number" || !Number.isInteger(c.min_path_length) || c.min_path_length < 0) {
      errors.push(`constraints.min_path_length must be non-negative integer, got ${c.min_path_length}`);
    }
    if (typeof c.target_difficulty !== "string" || !VALID_DIFFICULTIES.has(c.target_difficulty)) {
      errors.push(`constraints.target_difficulty must be "EASY" | "MEDIUM" | "HARD", got ${c.target_difficulty}`);
    }
    if (c.no_trivial_route !== undefined && typeof c.no_trivial_route !== "boolean") {
      errors.push("constraints.no_trivial_route must be a boolean if provided");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const validatedSpec: LevelSpec = {
    width: raw.width as number,
    height: raw.height as number,
    platforms: (raw.platforms as RectSpec[]).map((p) => ({
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
    })),
    hazards: (raw.hazards as RectSpec[]).map((h) => ({
      x: h.x,
      y: h.y,
      w: h.w,
      h: h.h,
    })),
    start: {
      x: (raw.start as { x: number; y: number }).x,
      y: (raw.start as { x: number; y: number }).y,
    },
    goal: {
      x: (raw.goal as { x: number; y: number }).x,
      y: (raw.goal as { x: number; y: number }).y,
    },
    constraints: {
      required_jumps: (raw.constraints as LevelConstraints).required_jumps,
      min_path_length: (raw.constraints as LevelConstraints).min_path_length,
      target_difficulty: (raw.constraints as LevelConstraints).target_difficulty as DifficultyGrade,
      no_trivial_route: (raw.constraints as LevelConstraints).no_trivial_route ?? false,
    },
  };

  return {
    valid: true,
    errors: [],
    spec: validatedSpec,
  };
}

function validateRectSpec(
  rect: unknown,
  label: string,
  gridWidth: number,
  gridHeight: number
): string[] {
  const errs: string[] = [];
  if (!rect || typeof rect !== "object") {
    errs.push(`${label} must be a RectSpec object { x, y, w, h }`);
    return errs;
  }

  const r = rect as Record<string, unknown>;
  if (typeof r.x !== "number" || !Number.isInteger(r.x)) {
    errs.push(`${label}.x must be an integer, got ${r.x}`);
  }
  if (typeof r.y !== "number" || !Number.isInteger(r.y)) {
    errs.push(`${label}.y must be an integer, got ${r.y}`);
  }
  if (typeof r.w !== "number" || !Number.isInteger(r.w) || r.w <= 0) {
    errs.push(`${label}.w must be a positive integer, got ${r.w}`);
  }
  if (typeof r.h !== "number" || !Number.isInteger(r.h) || r.h <= 0) {
    errs.push(`${label}.h must be a positive integer, got ${r.h}`);
  }

  if (typeof r.x === "number" && typeof r.w === "number" && gridWidth > 0) {
    if (r.x < 0 || r.x >= gridWidth) {
      errs.push(`${label}.x (${r.x}) outside grid width [0, ${gridWidth - 1}]`);
    }
  }

  if (typeof r.y === "number" && typeof r.h === "number" && gridHeight > 0) {
    if (r.y < 0 || r.y >= gridHeight) {
      errs.push(`${label}.y (${r.y}) outside grid height [0, ${gridHeight - 1}]`);
    }
  }

  return errs;
}

export function isLevelSpec(input: unknown): input is LevelSpec {
  return validateLevelSpec(input).valid;
}
