export * from "./types.js";
export { PhysicsEngine, DEFAULT_PHYSICS_CONFIG } from "./verifier/PhysicsEngine.js";
export { BFSVerifier } from "./verifier/BFSVerifier.js";
export { validateLevelStructure, compileLevelSpec } from "./shared/validation.js";
export {
  validatePatch,
  applyPatch,
  computePatch,
  DEFAULT_MAX_PATCH_OPERATIONS,
} from "./verifier/patches.js";
export {
  checkConstraints,
  evaluateDifficulty,
  DIFFICULTY_THRESHOLDS,
} from "./verifier/constraints.js";
export * as fixtures from "./verifier/fixtures.js";

// Phase 4: AI Intent Compiler & Generator
export {
  LEVEL_SPEC_JSON_SCHEMA,
  validateLevelSpec,
  isLevelSpec,
  type SpecValidationResult,
} from "./ai/schemas.js";
export {
  INTENT_COMPILER_SYSTEM_PROMPT,
  buildIntentCompilerPrompt,
  type IntentPromptOptions,
} from "./ai/prompts.js";
export {
  IntentCompiler,
  createGroqCompilerModel,
  createMockCompilerModel,
  extractJsonFromText,
  DEFAULT_MOCK_SPECS,
  type IntentCompilerModel,
  type IntentCompilationResult,
  type GroqCompilerModelOptions,
} from "./ai/compiler.js";
export {
  LevelGenerator,
  generateFromSpec,
  generateLevelFromIntent,
  type LevelGenerationResult,
} from "./ai/generator.js";

// Phase 5: AI Repairer & Benchmark Ablation
export {
  LevelRepairer,
  createGroqRepairModel,
  createMockRepairModel,
  validatePatchShape,
  buildRepairPrompt,
  REPAIRER_SYSTEM_PROMPT,
  type LevelRepairModel,
  type RepairPromptInput,
  type RepairAttempt,
  type RepairLoopResult,
  type RepairOptions,
  type GroqRepairModelOptions,
} from "./ai/repairer.js";
export {
  runAblationBenchmark,
  getDefaultBenchmarkScenarios,
  naiveHeuristicRepair,
  type BenchmarkScenario,
  type BenchmarkReport,
  type StrategyMetrics,
  type ScenarioBenchmarkRecord,
  type BenchmarkRunnerOptions,
} from "./ai/benchmark.js";

// Phase 6: Backend Orchestration Server & Protocol
export {
  validateClientCommand,
  type ClientCommand,
  type ServerEvent,
  type StartSessionCommand,
  type SabotageLevelCommand,
  type RegressPhysicsCommand,
  type RepairSessionCommand,
  type GetSessionCommand,
  type RunBenchmarkCommand,
  type SessionStartedEvent,
  type IntentReceivedEvent,
  type SpecGeneratedEvent,
  type LevelGeneratedEvent,
  type VerificationStartedEvent,
  type VerificationCompletedEvent,
  type RepairStartedEvent,
  type PatchProposedEvent,
  type PatchAppliedEvent,
  type RepairCompletedEvent,
  type SessionCompletedEvent,
  type ErrorEvent,
  type CommandValidationResult,
} from "./server/protocol.js";
export {
  ForgeSession,
  type SessionOptions,
  type SessionSnapshot,
  type SessionTerminalState,
} from "./server/session.js";
export {
  ForgeServer,
  createForgeServer,
  type ServerOptions,
} from "./server/server.js";

import { BFSVerifier } from "./verifier/BFSVerifier.js";
import type { Level, PhysicsConfig } from "./types.js";

export function verifyLevel(level: Level, config?: Partial<PhysicsConfig>) {
  return new BFSVerifier(config).verify(level);
}



