import type {
  Level,
  LevelSpec,
  LevelPatch,
  LevelPatchOperation,
  Counterexample,
  VerificationResult,
  TileType,
} from "../types.js";
import { validatePatch, applyPatch, type PatchOptions } from "../verifier/patches.js";
import { BFSVerifier } from "../verifier/BFSVerifier.js";
import { extractJsonFromText } from "./compiler.js";
import {
  CHASM_REPAIR_PATCH,
  HAZARD_REPAIR_PATCH,
} from "../verifier/fixtures.js";

export interface RepairPromptInput {
  intent: string;
  spec?: LevelSpec | undefined;
  level: Level;
  verification: VerificationResult;
  counterexample: Counterexample;
  attempt: number;
  maxAttempts: number;
}

/**
 * Isolated model interface for surgical level repair.
 * Prevents tight coupling to external vendor SDK internals.
 */
export interface LevelRepairModel {
  repairLevel(input: RepairPromptInput): Promise<unknown>;
}

export interface RepairAttempt {
  attempt: number;
  counterexample: Counterexample;
  proposedPatch: LevelPatch | null;
  patchValid: boolean;
  patchErrors: string[];
  verificationBefore: VerificationResult;
  verificationAfter: VerificationResult | null;
}

export interface RepairLoopResult {
  success: boolean;
  initialVerification: VerificationResult;
  finalVerification: VerificationResult;
  attempts: number;
  history: RepairAttempt[];
  finalLevel: Level;
}

export interface RepairOptions {
  maxAttempts?: number;
  patchOptions?: PatchOptions;
}

/**
 * System prompt instructing the LLM to act as the ForgeLoop Surgical Level Repairer.
 */
export const REPAIRER_SYSTEM_PROMPT = `You are the ForgeLoop Surgical Level Repairer, an AI system that fixes platformer levels failing deterministic verification.

### Core Directives
1. **The BFSVerifier is authoritative**: The counterexample is incontrovertible ground truth. Do not question or hallucinate verification results.
2. **Smallest Surgical Repair**: Make the minimal tile replacements needed to resolve the counterexample (ideally 1 to 3 operations).
3. **Preserve Intent & Geometry**: Do not rebuild the entire level. Keep existing platforms, hazards, and aesthetic layout intact.
4. **Endpoint Protection**: You must NEVER overwrite or move the START or GOAL tiles.
5. **No Code / No Prose**: Output ONLY a valid JSON object matching the LevelPatch schema. Do not output markdown fences or commentary.

### Patch Format
{
  "operations": [
    {
      "type": "REPLACE_TILE",
      "x": <integer>,
      "y": <integer>,
      "newTile": "AIR" | "GROUND" | "HAZARD"
    }
  ]
}
`;

/**
 * Builds the user prompt describing the failure and counterexample for repair.
 */
export function buildRepairPrompt(input: RepairPromptInput): string {
  const { counterexample, level, attempt, maxAttempts, intent } = input;
  const failureNode = counterexample.failure_node;
  const gap = counterexample.gap_to_goal;
  const violated = counterexample.violated;

  let reasonDetails = `Reason: ${counterexample.reason}`;
  if (violated) {
    reasonDetails += `\nConstraint Violated: "${violated.constraint}" (Required: ${violated.required}, Actual: ${violated.actual})`;
    if (violated.details) {
      reasonDetails += `\nDetails: ${violated.details}`;
    }
  }

  const gapStr = gap
    ? `dx: ${gap.dx}, dy: ${gap.dy}, Manhattan distance: ${gap.manhattan_distance}`
    : "N/A";

  const gridAscii = level.tiles
    .map((row, y) => `Row ${y.toString().padStart(2, " ")}: ${row.map((t) => t[0]).join("")}`)
    .join("\n");

  return `Repair attempt ${attempt} of ${maxAttempts} for design intent:
"${intent}"

Level Dimensions: width=${level.width}, height=${level.height}
Verification Status: ${counterexample.status}
${reasonDetails}
Failure Node (closest reached): (${failureNode.x}, ${failureNode.y})
Gap to Goal: ${gapStr}
Collision At: ${counterexample.collision_at ? `(${counterexample.collision_at.x}, ${counterexample.collision_at.y})` : "None"}

Current Level Grid (A=AIR, G=GROUND, H=HAZARD, S=START, F=GOAL):
${gridAscii}

Instructions:
- Provide a minimal LevelPatch to resolve this failure while preserving original gameplay intent.
- Output ONLY the JSON object with "operations".`;
}

/**
 * Options for configuring the Groq API repair model adapter.
 */
export interface GroqRepairModelOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
}

/**
 * Factory for a Groq API repair model adapter using native fetch.
 */
export function createGroqRepairModel(
  options: GroqRepairModelOptions = {}
): LevelRepairModel {
  const envKey =
    typeof globalThis !== "undefined" && (globalThis as any).process?.env?.GROQ_API_KEY
      ? ((globalThis as any).process.env.GROQ_API_KEY as string)
      : undefined;
  const apiKey = options.apiKey ?? envKey;
  const model = options.model ?? "llama-3.3-70b-versatile";
  const temperature = options.temperature ?? 0.1;
  const baseUrl = options.baseUrl ?? "https://api.groq.com/openai/v1/chat/completions";

  return {
    async repairLevel(input: RepairPromptInput): Promise<unknown> {
      if (!apiKey) {
        throw new Error(
          "Groq API key is required. Set GROQ_API_KEY environment variable or pass apiKey in options."
        );
      }

      const prompt = buildRepairPrompt(input);
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: REPAIRER_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq Repair API failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Groq Repair API returned empty content");
      }

      return content;
    },
  };
}

/**
 * Validates the raw JSON shape of a LevelPatch before domain validation.
 */
export function validatePatchShape(
  input: unknown
): { valid: boolean; errors: string[]; patch?: LevelPatch } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Patch must be a non-null object"] };
  }

  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.operations)) {
    return { valid: false, errors: ["Patch must contain an 'operations' array"] };
  }

  const VALID_TILES = new Set(["AIR", "GROUND", "HAZARD", "START", "GOAL"]);
  const ops: LevelPatchOperation[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.operations.length; i++) {
    const op = raw.operations[i];
    if (!op || typeof op !== "object") {
      errors.push(`Operation #${i} must be an object`);
      continue;
    }
    const rOp = op as Record<string, unknown>;
    if (rOp.type !== "REPLACE_TILE") {
      errors.push(`Operation #${i} type must be "REPLACE_TILE"`);
    }
    if (typeof rOp.x !== "number" || !Number.isInteger(rOp.x)) {
      errors.push(`Operation #${i} x must be an integer`);
    }
    if (typeof rOp.y !== "number" || !Number.isInteger(rOp.y)) {
      errors.push(`Operation #${i} y must be an integer`);
    }
    if (typeof rOp.newTile !== "string" || !VALID_TILES.has(rOp.newTile)) {
      errors.push(`Operation #${i} newTile "${rOp.newTile}" is invalid`);
    }

    if (errors.length === 0) {
      ops.push({
        type: "REPLACE_TILE",
        x: rOp.x as number,
        y: rOp.y as number,
        newTile: rOp.newTile as TileType,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    patch: { operations: ops },
  };
}

/**
 * Creates a deterministic mock repair model for testing, offline demo execution,
 * and reliable benchmark ablation.
 */
export function createMockRepairModel(
  customHandler?: (input: RepairPromptInput) => LevelPatch | unknown
): LevelRepairModel {
  return {
    async repairLevel(input: RepairPromptInput): Promise<unknown> {
      if (customHandler) {
        return customHandler(input);
      }

      const { counterexample, level } = input;

      // 1. Chasm Failure: 5-tile impossible gap (matches CHASM_BROKEN_LEVEL fixture)
      if (
        counterexample.status === "FAILED_REACHABILITY" &&
        counterexample.failure_node.x === 3 &&
        counterexample.failure_node.y === 3 &&
        level.width === 12
      ) {
        return CHASM_REPAIR_PATCH;
      }

      // 2. Hazard Obstruction Failure: Hazard wall at x=3 (matches HAZARD_OBSTRUCTED_LEVEL)
      if (
        counterexample.status === "FAILED_REACHABILITY" &&
        level.tiles[2]?.[3] === "HAZARD" &&
        level.width === 10
      ) {
        return HAZARD_REPAIR_PATCH;
      }


      // 3. Insufficient Jumps Violation: add a 1-tile gap forcing a jump
      if (counterexample.violated?.constraint === "required_jumps") {
        const floorY = level.height - 2;
        // Introduce a gap at x=3
        return {
          operations: [
            { type: "REPLACE_TILE", x: 3, y: floorY, newTile: "AIR" },
            { type: "REPLACE_TILE", x: 3, y: floorY + 1, newTile: "HAZARD" },
          ],
        };
      }

      // 4. Insufficient Path Length Violation: add detour or obstacle
      if (counterexample.violated?.constraint === "min_path_length") {
        // Place a small hurdle to require jumping and repositioning
        return {
          operations: [
            { type: "REPLACE_TILE", x: 3, y: 3, newTile: "GROUND" },
          ],
        };
      }

      // 5. Trivial Route Violation: Flat floor bypass with 0 jumps
      if (counterexample.violated?.constraint === "no_trivial_route") {
        // Cut a gap on the walking floor so player must jump across
        const floorY = level.height - 2;
        return {
          operations: [
            { type: "REPLACE_TILE", x: 2, y: floorY, newTile: "AIR" },
            { type: "REPLACE_TILE", x: 2, y: floorY + 1, newTile: "HAZARD" },
          ],
        };
      }

      // 6. Generic Reachability Gap Repair (deterministic stepping stone)
      if (counterexample.status === "FAILED_REACHABILITY") {
        const fn = counterexample.failure_node;
        // Find goal position
        let goalX = level.width - 1;
        let goalY = fn.y;
        for (let y = 0; y < level.height; y++) {
          for (let x = 0; x < level.width; x++) {
            if (level.tiles[y]?.[x] === "GOAL") {
              goalX = x;
              goalY = y;
            }
          }
        }

        // Place stepping stone midway
        const stepX = Math.min(level.width - 2, Math.max(1, fn.x + 2));
        const stepY = Math.min(level.height - 1, fn.y + 1);

        return {
          operations: [
            { type: "REPLACE_TILE", x: stepX, y: stepY, newTile: "GROUND" },
          ],
        };
      }

      // Default empty patch
      return { operations: [] };
    },
  };
}

/**
 * LevelRepairer coordinates the iterative, bounded counterexample-guided repair loop.
 */
export class LevelRepairer {
  private verifier: BFSVerifier;

  constructor(
    private model: LevelRepairModel,
    private defaultOptions: RepairOptions = {}
  ) {
    this.verifier = new BFSVerifier();
  }

  /**
   * Executes the bounded repair loop:
   * verify → if PASSED, return
   * while attempt <= maxAttempts:
   *   generate patch → validate patch → apply patch → re-verify
   */
  async repair(
    intent: string,
    initialLevel: Level,
    spec?: LevelSpec,
    options?: RepairOptions
  ): Promise<RepairLoopResult> {
    const maxAttempts = options?.maxAttempts ?? this.defaultOptions.maxAttempts ?? 3;
    const patchOptions = options?.patchOptions ?? this.defaultOptions.patchOptions;

    let currentLevel = initialLevel;
    let currentVerification = this.verifier.verify(currentLevel);
    const initialVerification = currentVerification;
    const history: RepairAttempt[] = [];

    // If already passed, no repair needed
    if (currentVerification.status === "PASSED") {
      return {
        success: true,
        initialVerification,
        finalVerification: currentVerification,
        attempts: 0,
        history,
        finalLevel: currentLevel,
      };
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const counterexample = currentVerification.counterexample;

      const input: RepairPromptInput = {
        intent,
        spec,
        level: currentLevel,
        verification: currentVerification,
        counterexample,
        attempt,
        maxAttempts,
      };

      let proposedPatch: LevelPatch | null = null;
      let patchValid = false;
      let patchErrors: string[] = [];
      let verificationAfter: VerificationResult | null = null;

      try {
        const rawResponse = await this.model.repairLevel(input);

        let parsedJson: unknown = rawResponse;
        if (typeof rawResponse === "string") {
          parsedJson = extractJsonFromText(rawResponse);
        }

        // 1. Zero-trust syntactic shape validation
        const shapeValidation = validatePatchShape(parsedJson);
        if (!shapeValidation.valid || !shapeValidation.patch) {
          patchValid = false;
          patchErrors = shapeValidation.errors;
        } else {
          proposedPatch = shapeValidation.patch;

          // 2. Zero-trust domain level validation
          const domainValidation = validatePatch(currentLevel, proposedPatch, patchOptions);
          if (!domainValidation.valid) {
            patchValid = false;
            patchErrors = domainValidation.errors;
          } else {
            patchValid = true;
          }
        }
      } catch (err: any) {
        patchValid = false;
        patchErrors = [`Model output parsing error: ${err.message}`];
      }

      const verificationBefore = currentVerification;

      // If patch is valid, apply and verify
      if (patchValid && proposedPatch) {
        const applyResult = applyPatch(currentLevel, proposedPatch, patchOptions);
        if (applyResult.success) {
          currentLevel = applyResult.level;
          verificationAfter = this.verifier.verify(currentLevel);
          currentVerification = verificationAfter;
        } else {
          patchValid = false;
          patchErrors = applyResult.errors;
        }
      }

      history.push({
        attempt,
        counterexample,
        proposedPatch,
        patchValid,
        patchErrors,
        verificationBefore,
        verificationAfter,
      });


      if (currentVerification.status === "PASSED") {
        return {
          success: true,
          initialVerification,
          finalVerification: currentVerification,
          attempts: attempt,
          history,
          finalLevel: currentLevel,
        };
      }
    }

    return {
      success: false,
      initialVerification,
      finalVerification: currentVerification,
      attempts: maxAttempts,
      history,
      finalLevel: currentLevel,
    };
  }
}
