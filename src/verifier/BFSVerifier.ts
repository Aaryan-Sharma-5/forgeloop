import type {
  Action,
  Counterexample,
  GameState,
  Level,
  PhysicsConfig,
  VerificationMetrics,
  VerificationResult,
} from "../types.js";
import { PhysicsEngine } from "./PhysicsEngine.js";
import { validateLevelStructure } from "../shared/validation.js";

const ACTIONS: Action[] = [
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "JUMP_SHORT",
  "JUMP_LONG",
  "WAIT",
];

interface QueueNode {
  state: GameState;
  actions: Action[];
}

export class BFSVerifier {
  constructor(private readonly physicsConfig?: Partial<PhysicsConfig>) {}

  verify(level: Level, configOverride?: Partial<PhysicsConfig>): VerificationResult {
    // 1. Zero-trust structural validation
    const validation = validateLevelStructure(level);
    if (!validation.valid) {
      const counterexample: Counterexample = {
        status: "INVALID_STRUCTURE",
        reason: `Level structure invalid: ${validation.errors.join("; ")}`,
        failure_node: { x: 0, y: 0 },
        attempted_action: null,
        collision_at: null,
        metrics: {
          states_explored: 0,
          action_sequence_length: null,
          critical_jumps_required: 0,
          alternative_solution_count: 0,
          max_reached_distance: 0,
        },
      };

      return {
        status: "FAILED",
        counterexample,
        metrics: {
          states_explored: 0,
          action_sequence_length: null,
          critical_jumps_required: 0,
          alternative_solution_count: 0,
          max_reached_distance: 0,
        },
      };
    }

    const start = this.findTile(level, "START")!;
    const goal = this.findTile(level, "GOAL")!;

    const config = { ...this.physicsConfig, ...configOverride };
    const engine = new PhysicsEngine(level, config);

    const initialFacing: -1 | 1 = goal.x >= start.x ? 1 : -1;
    const startState: GameState = {
      x: start.x,
      y: start.y,
      facing: initialFacing,
      grounded: this.isGrounded(level, start.x, start.y),
    };

    const queue: QueueNode[] = [{ state: startState, actions: [] }];
    const visited = new Set<string>();
    visited.add(this.stateKey(startState));

    let head = 0;
    let statesExplored = 0;
    let maxReachedDistance = 0;

    let closestReachableToGoal: GameState = startState;
    let minManhattanDistToGoal = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y);

    let closestNodeFailure: {
      action: Action;
      collisionAt: { x: number; y: number } | null;
      reason: string;
    } | null = null;

    let solution: Action[] | null = null;
    let solutionCount = 0;
    let criticalJumps = Number.POSITIVE_INFINITY;

    while (head < queue.length) {
      const node = queue[head];
      if (!node) break;
      head++;
      statesExplored++;

      const distFromStart = Math.abs(node.state.x - start.x);
      if (distFromStart > maxReachedDistance) {
        maxReachedDistance = distFromStart;
      }

      const manhattanToGoal =
        Math.abs(node.state.x - goal.x) + Math.abs(node.state.y - goal.y);

      if (manhattanToGoal < minManhattanDistToGoal) {
        minManhattanDistToGoal = manhattanToGoal;
        closestReachableToGoal = node.state;
        closestNodeFailure = null; // Reset for new closest node
      }

      // Check if goal tile reached
      if (node.state.x === goal.x && node.state.y === goal.y) {
        if (solution === null) {
          solution = node.actions;
          criticalJumps = node.actions.filter((a) => a.startsWith("JUMP_")).length;
        }
        solutionCount++;
        if (solutionCount >= 16) break;
        continue;
      }

      for (const action of ACTIONS) {
        const transition = engine.applyAction(node.state, action);

        if (!transition.nextState) {
          // If this is from our closest reachable node to goal, capture it
          if (
            node.state.x === closestReachableToGoal.x &&
            node.state.y === closestReachableToGoal.y &&
            !closestNodeFailure
          ) {
            closestNodeFailure = {
              action,
              collisionAt: transition.collisionAt,
              reason: transition.reason ?? "Transition blocked",
            };
          }
          continue;
        }

        const next = transition.nextState;
        if (next.x === goal.x && next.y === goal.y) {
          const nextActions = [...node.actions, action];
          if (solution === null) {
            solution = nextActions;
            criticalJumps = nextActions.filter((a) => a.startsWith("JUMP_")).length;
          }
          solutionCount++;
          if (solutionCount >= 16) break;
        }

        const key = this.stateKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        queue.push({ state: next, actions: [...node.actions, action] });
      }
    }

    const metrics: VerificationMetrics = {
      states_explored: statesExplored,
      action_sequence_length: solution?.length ?? null,
      critical_jumps_required: Number.isFinite(criticalJumps) ? criticalJumps : 0,
      alternative_solution_count: Math.max(0, solutionCount - 1),
      max_reached_distance: maxReachedDistance,
    };

    // If a solution exists, verify declared design constraints
    if (solution) {
      const jumpsInSolution = metrics.critical_jumps_required;
      const pathLength = solution.length;

      // 1. Required jumps constraint
      if (
        level.constraints.required_jumps !== undefined &&
        jumpsInSolution < level.constraints.required_jumps
      ) {
        return {
          status: "FAILED",
          counterexample: {
            status: "CONSTRAINT_VIOLATION",
            reason: `Level solved with ${jumpsInSolution} jumps, but requires ${level.constraints.required_jumps} jumps`,
            failure_node: { x: goal.x, y: goal.y },
            attempted_action: null,
            collision_at: null,
            violated: {
              constraint: "required_jumps",
              required: level.constraints.required_jumps,
              actual: jumpsInSolution,
              details: `Solution path bypassed required jump challenges with only ${jumpsInSolution} jumps`,
            },
            metrics,
          },
          metrics,
        };
      }

      // 2. Minimum path length constraint
      if (
        level.constraints.min_path_length !== undefined &&
        pathLength < level.constraints.min_path_length
      ) {
        return {
          status: "FAILED",
          counterexample: {
            status: "CONSTRAINT_VIOLATION",
            reason: `Shortest solution length (${pathLength}) is below required minimum (${level.constraints.min_path_length})`,
            failure_node: { x: goal.x, y: goal.y },
            attempted_action: null,
            collision_at: null,
            violated: {
              constraint: "min_path_length",
              required: level.constraints.min_path_length,
              actual: pathLength,
            },
            metrics,
          },
          metrics,
        };
      }

      // 3. No trivial route constraint
      if (level.constraints.no_trivial_route) {
        if (jumpsInSolution === 0) {
          return {
            status: "FAILED",
            counterexample: {
              status: "CONSTRAINT_VIOLATION",
              reason: "Level violated no_trivial_route: goal reachable via pure walking without any jumps",
              failure_node: { x: goal.x, y: goal.y },
              attempted_action: null,
              collision_at: null,
              violated: {
                constraint: "no_trivial_route",
                required: ">= 1 jump",
                actual: "0 jumps",
                details: "Flat walking path found connecting START directly to GOAL",
              },
              metrics,
            },
            metrics,
          };
        }
      }

      return {
        status: "PASSED",
        action_sequence: solution,
        metrics,
      };
    }

    // Reachability failed: compute clear spatial gap to GOAL
    const gapDx = goal.x - closestReachableToGoal.x;
    const gapDy = goal.y - closestReachableToGoal.y;

    const counterexample: Counterexample = {
      status: "FAILED_REACHABILITY",
      reason:
        closestNodeFailure?.reason ??
        `No reachable path to GOAL exists. Closest reachable state is ${minManhattanDistToGoal} tiles away.`,
      failure_node: {
        x: closestReachableToGoal.x,
        y: closestReachableToGoal.y,
      },
      attempted_action: closestNodeFailure?.action ?? null,
      collision_at: closestNodeFailure?.collisionAt ?? null,
      gap_to_goal: {
        dx: gapDx,
        dy: gapDy,
        manhattan_distance: minManhattanDistToGoal,
      },
      metrics,
    };

    return {
      status: "FAILED",
      counterexample,
      metrics,
    };
  }

  private findTile(level: Level, tile: "START" | "GOAL") {
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.tiles[y]?.[x] === tile) return { x, y };
      }
    }
    return null;
  }

  private isGrounded(level: Level, x: number, y: number): boolean {
    return level.tiles[y + 1]?.[x] === "GROUND";
  }

  private stateKey(state: GameState): string {
    return `${state.x},${state.y},${state.facing},${state.grounded ? 1 : 0}`;
  }
}
