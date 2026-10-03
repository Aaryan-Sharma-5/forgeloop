import type {
  Action,
  Counterexample,
  DifficultyScore,
  Level,
  VerificationMetrics,
} from "../types.js";

export const DIFFICULTY_THRESHOLDS = {
  EASY_MAX: 34,
  MEDIUM_MAX: 69,
};

export interface ConstraintCheckOptions {
  enforceDifficulty?: boolean;
}

export interface ConstraintCheckResult {
  satisfied: boolean;
  counterexample?: Counterexample;
  difficulty: DifficultyScore;
}

/**
 * Deterministically evaluates the difficulty profile of a verified level
 * using measurable search and trajectory metrics.
 *
 * Formula:
 *   score = action_length_component
 *         + critical_jump_component
 *         + exploration_complexity_component
 *         - alternative_route_penalty
 *
 * Calibrated Profiles:
 *   EASY:   score < 35
 *   MEDIUM: 35 <= score < 70
 *   HARD:   score >= 70
 */
export function evaluateDifficulty(metrics: VerificationMetrics): DifficultyScore {
  const pathLength = metrics.action_sequence_length ?? 0;
  const criticalJumps = metrics.critical_jumps_required ?? 0;
  const explored = metrics.states_explored ?? 0;
  const alternatives = metrics.alternative_solution_count ?? 0;

  const actionLengthScore = pathLength * 2;
  const criticalJumpScore = criticalJumps * 15;
  const explorationComplexityScore = Math.min(30, Math.floor(explored / 4));
  const alternativePenalty = Math.min(20, alternatives * 2);

  const rawScore =
    actionLengthScore +
    criticalJumpScore +
    explorationComplexityScore -
    alternativePenalty;

  const score = Math.max(0, rawScore);

  let grade: "EASY" | "MEDIUM" | "HARD";
  if (score <= DIFFICULTY_THRESHOLDS.EASY_MAX) {
    grade = "EASY";
  } else if (score <= DIFFICULTY_THRESHOLDS.MEDIUM_MAX) {
    grade = "MEDIUM";
  } else {
    grade = "HARD";
  }

  return {
    score,
    grade,
    breakdown: {
      actionLengthScore,
      criticalJumpScore,
      explorationComplexityScore,
      alternativePenalty,
    },
  };
}

/**
 * Deterministically evaluates declared level constraints against a verified solution.
 * Emits structured Counterexample objects on any constraint violation.
 */
export function checkConstraints(
  level: Level,
  solution: Action[],
  metrics: VerificationMetrics,
  options?: ConstraintCheckOptions
): ConstraintCheckResult {
  const difficulty = evaluateDifficulty(metrics);
  const pathLength = solution.length;
  const jumpsInSolution = metrics.critical_jumps_required;

  // Find goal coordinate for failure node referencing
  let goalPos = { x: level.width - 1, y: 0 };
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.tiles[y]?.[x] === "GOAL") {
        goalPos = { x, y };
        break;
      }
    }
  }

  const enrichedMetrics: VerificationMetrics = {
    ...metrics,
    difficulty,
  };

  // 1. Check required jumps
  if (
    level.constraints.required_jumps !== undefined &&
    jumpsInSolution < level.constraints.required_jumps
  ) {
    return {
      satisfied: false,
      difficulty,
      counterexample: {
        status: "CONSTRAINT_VIOLATION",
        reason: `Level solved with ${jumpsInSolution} jumps, but requires ${level.constraints.required_jumps} jumps`,
        failure_node: goalPos,
        attempted_action: null,
        collision_at: null,
        violated: {
          constraint: "required_jumps",
          required: level.constraints.required_jumps,
          actual: jumpsInSolution,
          details: `Solution path bypassed required jump challenges with only ${jumpsInSolution} jumps`,
        },
        metrics: enrichedMetrics,
      },
    };
  }

  // 2. Check minimum path length
  if (
    level.constraints.min_path_length !== undefined &&
    pathLength < level.constraints.min_path_length
  ) {
    return {
      satisfied: false,
      difficulty,
      counterexample: {
        status: "CONSTRAINT_VIOLATION",
        reason: `Shortest solution length (${pathLength}) is below required minimum (${level.constraints.min_path_length})`,
        failure_node: goalPos,
        attempted_action: null,
        collision_at: null,
        violated: {
          constraint: "min_path_length",
          required: level.constraints.min_path_length,
          actual: pathLength,
        },
        metrics: enrichedMetrics,
      },
    };
  }

  // 3. Check no trivial route
  if (level.constraints.no_trivial_route) {
    if (jumpsInSolution === 0) {
      return {
        satisfied: false,
        difficulty,
        counterexample: {
          status: "CONSTRAINT_VIOLATION",
          reason: "Level violated no_trivial_route: goal reachable via pure walking without any jumps",
          failure_node: goalPos,
          attempted_action: null,
          collision_at: null,
          violated: {
            constraint: "no_trivial_route",
            required: ">= 1 jump",
            actual: "0 jumps",
            details: "Flat walking path found connecting START directly to GOAL",
          },
          metrics: enrichedMetrics,
        },
      };
    }
  }

  // 4. Check target difficulty profile if enforcement requested
  if (options?.enforceDifficulty && level.constraints.target_difficulty) {
    if (difficulty.grade !== level.constraints.target_difficulty) {
      return {
        satisfied: false,
        difficulty,
        counterexample: {
          status: "CONSTRAINT_VIOLATION",
          reason: `Measured difficulty is ${difficulty.grade} (score: ${difficulty.score}), but target is ${level.constraints.target_difficulty}`,
          failure_node: goalPos,
          attempted_action: null,
          collision_at: null,
          violated: {
            constraint: "target_difficulty",
            required: level.constraints.target_difficulty,
            actual: difficulty.grade,
            details: `Difficulty score was ${difficulty.score}, placing it into ${difficulty.grade}`,
          },
          metrics: enrichedMetrics,
        },
      };
    }
  }

  return {
    satisfied: true,
    difficulty,
  };
}
