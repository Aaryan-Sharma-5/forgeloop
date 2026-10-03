import type { Level, LevelSpec } from "../types.js";
import { compileLevelSpec } from "../shared/validation.js";
import { validateLevelSpec } from "./schemas.js";
import { IntentCompiler, type IntentCompilerModel, type IntentPromptOptions } from "./compiler.js";

export interface LevelGenerationResult {
  intent: string;
  spec: LevelSpec;
  level: Level;
}

/**
 * Deterministically compiles a geometric LevelSpec into a verified discrete Level.
 * Strictly validates the LevelSpec IR before compilation.
 * 
 * NOTE: Compilation only creates the level structure. It NEVER treats
 * generation as proof of playability, constraint satisfaction, or difficulty.
 * Verification must be independently executed via BFSVerifier.
 */
export function generateFromSpec(spec: LevelSpec): Level {
  const validation = validateLevelSpec(spec);
  if (!validation.valid || !validation.spec) {
    throw new Error(
      `Cannot generate Level from invalid LevelSpec:\n${validation.errors.join("\n")}`
    );
  }

  return compileLevelSpec(validation.spec);
}

/**
 * LevelGenerator orchestrates IntentCompiler (AI / mock model)
 * and the deterministic LevelSpec → Level compilation pipeline.
 */
export class LevelGenerator {
  constructor(private compiler: IntentCompiler) {}

  /**
   * Generates a discrete Level from natural-language intent.
   * 1. Compiles intent into geometric LevelSpec.
   * 2. Strictly validates LevelSpec schema and geometry.
   * 3. Deterministically paints platforms and hazards into a discrete Level.
   */
  async generate(
    intent: string,
    options?: IntentPromptOptions
  ): Promise<LevelGenerationResult> {
    const compilation = await this.compiler.compile(intent, options);

    if (!compilation.validation.valid || !compilation.spec) {
      throw new Error(
        `Level generation failed intent validation:\n${compilation.validation.errors.join("\n")}`
      );
    }

    const level = compileLevelSpec(compilation.spec);

    return {
      intent,
      spec: compilation.spec,
      level,
    };
  }
}

/**
 * Convenience helper to instantiate a generator and produce a Level from intent.
 */
export async function generateLevelFromIntent(
  intent: string,
  model: IntentCompilerModel,
  options?: IntentPromptOptions
): Promise<LevelGenerationResult> {
  const compiler = new IntentCompiler(model);
  const generator = new LevelGenerator(compiler);
  return generator.generate(intent, options);
}
