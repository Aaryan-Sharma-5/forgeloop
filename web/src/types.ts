// ============================================================
// Canonical Game & Verifier Types
// ============================================================

export type TileType = "AIR" | "GROUND" | "HAZARD" | "START" | "GOAL";

export interface LevelConstraints {
  required_jumps: number;
  min_path_length: number;
  target_difficulty: "EASY" | "MEDIUM" | "HARD";
  no_trivial_route?: boolean;
}

export interface Level {
  width: number;
  height: number;
  tiles: TileType[][]; // [y][x]
  constraints: LevelConstraints;
}

export interface RectSpec {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelSpec {
  width: number;
  height: number;
  platforms: RectSpec[];
  hazards: RectSpec[];
  start: { x: number; y: number };
  goal: { x: number; y: number };
  constraints: LevelConstraints;
}

export interface GameState {
  x: number;
  y: number;
  grounded: boolean;
  facing: -1 | 1;
}

export type PlayerState = GameState;

export type Action =
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "JUMP_SHORT"
  | "JUMP_LONG"
  | "WAIT";

export interface PhysicsConfig {
  shortJumpDistance: number;
  longJumpDistance: number;
  jumpApexHeight: number;
  gravityStep: number;
}

export interface Counterexample {
  status: "FAILED_REACHABILITY" | "CONSTRAINT_VIOLATION" | "INVALID_STRUCTURE";
  reason: string;
  failure_node: { x: number; y: number };
  attempted_action: Action | null;
  collision_at: { x: number; y: number } | null;
  gap_to_goal?: { dx: number; dy: number; manhattan_distance: number };
  violated?: {
    constraint: "required_jumps" | "min_path_length" | "target_difficulty" | "no_trivial_route" | string;
    required: number | string;
    actual: number | string;
    details?: string;
  };
  metrics: VerificationMetrics;
}

export type DifficultyGrade = "EASY" | "MEDIUM" | "HARD";

export interface DifficultyBreakdown {
  actionLengthScore: number;
  criticalJumpScore: number;
  explorationComplexityScore: number;
  alternativePenalty: number;
}

export interface DifficultyScore {
  score: number;
  grade: DifficultyGrade;
  breakdown: DifficultyBreakdown;
}

export interface VerificationMetrics {
  states_explored: number;
  action_sequence_length: number | null;
  critical_jumps_required: number;
  alternative_solution_count: number;
  max_reached_distance: number;
  difficulty?: DifficultyScore;
}

export interface VerificationSuccess {
  status: "PASSED";
  action_sequence: Action[];
  metrics: VerificationMetrics;
}

export interface VerificationFailure {
  status: "FAILED";
  counterexample: Counterexample;
  metrics: VerificationMetrics;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

export interface LevelPatchOperation {
  type: "REPLACE_TILE";
  x: number;
  y: number;
  newTile: TileType;
}

export interface LevelPatch {
  operations: LevelPatchOperation[];
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

// ============================================================
// Server Protocol & Event Stream Types
// ============================================================

export type SessionTerminalState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface SessionSnapshot {
  sessionId: string;
  intent: string;
  terminalState: SessionTerminalState;
  spec: LevelSpec | null;
  level: Level | null;
  verification: VerificationResult | null;
  repairHistory: RepairAttempt[];
  events: ServerEvent[];
}

export interface StartSessionCommand {
  type: "START_SESSION";
  sessionId?: string;
  intent: string;
  physicsConfig?: Partial<PhysicsConfig>;
}

export interface SabotageLevelCommand {
  type: "SABOTAGE_LEVEL";
  sessionId: string;
  action: "DROP_HAZARD" | "CUT_BRIDGE";
  x?: number;
  y?: number;
}

export interface RegressPhysicsCommand {
  type: "REGRESS_PHYSICS";
  sessionId: string;
  physicsConfig: Partial<PhysicsConfig>;
}

export interface RepairSessionCommand {
  type: "REPAIR_SESSION";
  sessionId: string;
}

export interface GetSessionCommand {
  type: "GET_SESSION";
  sessionId: string;
}

export interface RunBenchmarkCommand {
  type: "RUN_BENCHMARK";
}

export type ClientCommand =
  | StartSessionCommand
  | SabotageLevelCommand
  | RegressPhysicsCommand
  | RepairSessionCommand
  | GetSessionCommand
  | RunBenchmarkCommand;

export interface SessionStartedEvent {
  type: "SESSION_STARTED";
  sessionId: string;
  timestamp: string;
}

export interface IntentReceivedEvent {
  type: "INTENT_RECEIVED";
  sessionId: string;
  intent: string;
  timestamp: string;
}

export interface SpecGeneratedEvent {
  type: "SPEC_GENERATED";
  sessionId: string;
  spec: LevelSpec;
  timestamp: string;
}

export interface LevelGeneratedEvent {
  type: "LEVEL_GENERATED";
  sessionId: string;
  level: Level;
  timestamp: string;
}

export interface VerificationStartedEvent {
  type: "VERIFICATION_STARTED";
  sessionId: string;
  phase: "FIRST_SHOT" | "POST_PATCH" | "POST_SABOTAGE" | "POST_REGRESSION";
  attempt?: number;
  timestamp: string;
}

export interface VerificationCompletedEvent {
  type: "VERIFICATION_COMPLETED";
  sessionId: string;
  phase: "FIRST_SHOT" | "POST_PATCH" | "POST_SABOTAGE" | "POST_REGRESSION";
  result: VerificationResult;
  timestamp: string;
}

export interface RepairStartedEvent {
  type: "REPAIR_STARTED";
  sessionId: string;
  attempt: number;
  maxAttempts: number;
  counterexample: Counterexample;
  timestamp: string;
}

export interface PatchProposedEvent {
  type: "PATCH_PROPOSED";
  sessionId: string;
  attempt: number;
  patch: LevelPatch;
  timestamp: string;
}

export interface PatchAppliedEvent {
  type: "PATCH_APPLIED";
  sessionId: string;
  attempt: number;
  patch: LevelPatch;
  level: Level;
  timestamp: string;
}

export interface RepairCompletedEvent {
  type: "REPAIR_COMPLETED";
  sessionId: string;
  success: boolean;
  attempts: number;
  finalLevel: Level;
  timestamp: string;
}

export interface SessionCompletedEvent {
  type: "SESSION_COMPLETED";
  sessionId: string;
  success: boolean;
  attempts: number;
  finalLevel: Level;
  verification: VerificationResult;
  timestamp: string;
}

export interface ErrorEvent {
  type: "ERROR";
  sessionId?: string;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export type ServerEvent =
  | SessionStartedEvent
  | IntentReceivedEvent
  | SpecGeneratedEvent
  | LevelGeneratedEvent
  | VerificationStartedEvent
  | VerificationCompletedEvent
  | RepairStartedEvent
  | PatchProposedEvent
  | PatchAppliedEvent
  | RepairCompletedEvent
  | SessionCompletedEvent
  | ErrorEvent;

// ============================================================
// Benchmark Types
// ============================================================

export interface StrategyMetrics {
  strategy: "First-Shot" | "Post-Repair" | "Naive-Heuristic";
  scenarioCount: number;
  initialFailures: number;
  finalSuccesses: number;
  successRate: number;
  avgRepairAttempts: number;
  avgPatchOperations: number;
  avgVerificationLatencyMs: number;
  avgRepairLatencyMs: number;
}

export interface ScenarioBenchmarkRecord {
  scenarioId: string;
  name: string;
  intent: string;
  firstShotPassed: boolean;
  postRepairPassed: boolean;
  naiveHeuristicPassed: boolean;
  firstShotLatencyMs: number;
  postRepairLatencyMs: number;
  naiveHeuristicLatencyMs: number;
  aiRepairAttempts: number;
  aiPatchOperations: number;
}

export interface BenchmarkReport {
  timestamp: string;
  totalScenarios: number;
  strategies: {
    firstShot: StrategyMetrics;
    postRepair: StrategyMetrics;
    naiveHeuristic: StrategyMetrics;
  };
  scenarios: ScenarioBenchmarkRecord[];
}
