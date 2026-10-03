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
