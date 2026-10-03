import type { Level, LevelSpec, VerificationResult, LevelPatch } from "../types.js";
import { BFSVerifier } from "../verifier/BFSVerifier.js";
import { applyPatch } from "../verifier/patches.js";
import { LevelRepairer, createMockRepairModel, type LevelRepairModel } from "./repairer.js";
import {
  CHASM_BROKEN_LEVEL,
  HAZARD_OBSTRUCTED_LEVEL,
  EASY_LEVEL_FIXTURE,
  MEDIUM_LEVEL_FIXTURE,
  PLAYABLE_INSUFFICIENT_JUMPS_FIXTURE,
  PLAYABLE_TRIVIAL_ROUTE_FIXTURE,
} from "../verifier/fixtures.js";

export interface BenchmarkScenario {
  id: string;
  name: string;
  intent: string;
  level: Level;
  spec?: LevelSpec | undefined;
}

export interface StrategyMetrics {
  strategy: "First-Shot" | "Post-Repair" | "Naive-Heuristic";
  scenarioCount: number;
  initialFailures: number;
  finalSuccesses: number;
  successRate: number; // percentage 0-100
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

/**
 * Deterministic benchmark suite covering valid levels, reachability chasms,
 * hazard walls, and constraint violations.
 */
export function getDefaultBenchmarkScenarios(): BenchmarkScenario[] {
  return [
    {
      id: "SCENARIO_1_EASY_VALID",
      name: "Easy Tutorial Level",
      intent: "Create an easy 1-jump level across a small gap",
      level: EASY_LEVEL_FIXTURE,
    },
    {
      id: "SCENARIO_2_MEDIUM_VALID",
      name: "Medium Stepped Course",
      intent: "Design a medium 2-jump level with staggered platforms",
      level: MEDIUM_LEVEL_FIXTURE,
    },
    {
      id: "SCENARIO_3_CHASM_GAP",
      name: "Unreachable Chasm Gap",
      intent: "Jump across a dangerous wide chasm",
      level: CHASM_BROKEN_LEVEL,
    },
    {
      id: "SCENARIO_4_HAZARD_WALL",
      name: "Hazard Wall Obstruction",
      intent: "Traverse a corridor to reach the goal flag",
      level: HAZARD_OBSTRUCTED_LEVEL,
    },
    {
      id: "SCENARIO_5_INSUFFICIENT_JUMPS",
      name: "Insufficient Jumps Violation",
      intent: "Navigate a level requiring at least 3 distinct jumps",
      level: PLAYABLE_INSUFFICIENT_JUMPS_FIXTURE,
    },
    {
      id: "SCENARIO_6_TRIVIAL_ROUTE",
      name: "Trivial Walking Route Violation",
      intent: "Design a level requiring jump execution without flat floor walking bypass",
      level: PLAYABLE_TRIVIAL_ROUTE_FIXTURE,
    },
  ];
}

/**
 * Naive Heuristic Repairer:
 * A simple rule-based baseline that attempts naive local gap-filling
 * or hazard clearing, but lacks global puzzle reasoning and constraint awareness.
 */
export function naiveHeuristicRepair(
  level: Level,
  verification: VerificationResult
): LevelPatch {
  if (verification.status === "PASSED") {
    return { operations: [] };
  }

  const ce = verification.counterexample;

  // Rule 1: Reachability failure with collision at hazard -> clear collision tile
  if (ce.collision_at && level.tiles[ce.collision_at.y]?.[ce.collision_at.x] === "HAZARD") {
    return {
      operations: [
        {
          type: "REPLACE_TILE",
          x: ce.collision_at.x,
          y: ce.collision_at.y,
          newTile: "AIR",
        },
      ],
    };
  }

  // Rule 2: Reachability failure -> place a single GROUND tile directly ahead of failure_node
  if (ce.status === "FAILED_REACHABILITY") {
    const fn = ce.failure_node;
    const targetX = fn.x + 1;
    if (
      targetX >= 0 &&
      targetX < level.width &&
      level.tiles[fn.y]?.[targetX] !== "START" &&
      level.tiles[fn.y]?.[targetX] !== "GOAL"
    ) {
      return {
        operations: [
          {
            type: "REPLACE_TILE",
            x: targetX,
            y: fn.y,
            newTile: "GROUND",
          },
        ],
      };
    }
  }

  // Rule 3: Naive heuristic cannot reason about required_jumps, min_path_length, or no_trivial_route
  return { operations: [] };
}

export interface BenchmarkRunnerOptions {
  repairModel?: LevelRepairModel;
  maxAttempts?: number;
}

/**
 * Runs the complete ablation benchmark comparing:
 * A. First-Shot (Generate → Verify)
 * B. Post-Repair (Generate → Verify → AI Repair Loop → Verify)
 * C. Naive Heuristic (Generate → Verify → Heuristic Repair → Verify)
 */
export async function runAblationBenchmark(
  scenarios: BenchmarkScenario[] = getDefaultBenchmarkScenarios(),
  options: BenchmarkRunnerOptions = {}
): Promise<BenchmarkReport> {
  const verifier = new BFSVerifier();
  const repairModel = options.repairModel ?? createMockRepairModel();
  const repairer = new LevelRepairer(repairModel, {
    maxAttempts: options.maxAttempts ?? 3,
  });

  const scenarioRecords: ScenarioBenchmarkRecord[] = [];

  // Metrics accumulators
  let fsSuccesses = 0;
  let fsTotalVerifTime = 0;

  let prSuccesses = 0;
  let prTotalAttempts = 0;
  let prTotalPatchOps = 0;
  let prTotalRepairTime = 0;
  let prTotalVerifTime = 0;

  let nhSuccesses = 0;
  let nhTotalAttempts = 0;
  let nhTotalPatchOps = 0;
  let nhTotalRepairTime = 0;
  let nhTotalVerifTime = 0;

  for (const scenario of scenarios) {
    // ---------------------------------------------------------
    // Strategy A: First-Shot (Verify candidate directly)
    // ---------------------------------------------------------
    const fsStart = performance.now();
    const fsResult = verifier.verify(scenario.level);
    const fsTime = performance.now() - fsStart;
    fsTotalVerifTime += fsTime;

    const fsPassed = fsResult.status === "PASSED";
    if (fsPassed) fsSuccesses++;

    // ---------------------------------------------------------
    // Strategy B: Post-Repair (AI Surgical Repair Loop)
    // ---------------------------------------------------------
    const prStart = performance.now();
    const prLoopResult = await repairer.repair(
      scenario.intent,
      scenario.level,
      scenario.spec
    );
    const prTime = performance.now() - prStart;
    prTotalRepairTime += prTime;

    const prPassed = prLoopResult.success;
    if (prPassed) prSuccesses++;
    prTotalAttempts += prLoopResult.attempts;

    let prOpsCount = 0;
    for (const att of prLoopResult.history) {
      if (att.proposedPatch?.operations) {
        prOpsCount += att.proposedPatch.operations.length;
      }
    }
    prTotalPatchOps += prOpsCount;

    // ---------------------------------------------------------
    // Strategy C: Naive Heuristic Repair
    // ---------------------------------------------------------
    const nhStart = performance.now();
    let nhPassed = false;
    let nhOpsCount = 0;

    if (fsPassed) {
      nhPassed = true;
    } else {
      const nhPatch = naiveHeuristicRepair(scenario.level, fsResult);
      nhOpsCount = nhPatch.operations.length;
      nhTotalPatchOps += nhOpsCount;
      nhTotalAttempts += 1;

      if (nhPatch.operations.length > 0) {
        const applyRes = applyPatch(scenario.level, nhPatch);
        if (applyRes.success) {
          const nhVerifyStart = performance.now();
          const nhVerif = verifier.verify(applyRes.level);
          nhTotalVerifTime += performance.now() - nhVerifyStart;
          nhPassed = nhVerif.status === "PASSED";
        }
      }
    }
    const nhTime = performance.now() - nhStart;
    nhTotalRepairTime += nhTime;
    if (nhPassed) nhSuccesses++;

    scenarioRecords.push({
      scenarioId: scenario.id,
      name: scenario.name,
      intent: scenario.intent,
      firstShotPassed: fsPassed,
      postRepairPassed: prPassed,
      naiveHeuristicPassed: nhPassed,
      firstShotLatencyMs: Number(fsTime.toFixed(3)),
      postRepairLatencyMs: Number(prTime.toFixed(3)),
      naiveHeuristicLatencyMs: Number(nhTime.toFixed(3)),
      aiRepairAttempts: prLoopResult.attempts,
      aiPatchOperations: prOpsCount,
    });
  }

  const n = scenarios.length || 1;
  const initialFailures = scenarios.length - fsSuccesses;

  const firstShotMetrics: StrategyMetrics = {
    strategy: "First-Shot",
    scenarioCount: scenarios.length,
    initialFailures,
    finalSuccesses: fsSuccesses,
    successRate: Number(((fsSuccesses / n) * 100).toFixed(1)),
    avgRepairAttempts: 0,
    avgPatchOperations: 0,
    avgVerificationLatencyMs: Number((fsTotalVerifTime / n).toFixed(3)),
    avgRepairLatencyMs: 0,
  };

  const postRepairMetrics: StrategyMetrics = {
    strategy: "Post-Repair",
    scenarioCount: scenarios.length,
    initialFailures,
    finalSuccesses: prSuccesses,
    successRate: Number(((prSuccesses / n) * 100).toFixed(1)),
    avgRepairAttempts: Number((prTotalAttempts / n).toFixed(2)),
    avgPatchOperations: Number((prTotalPatchOps / n).toFixed(2)),
    avgVerificationLatencyMs: Number((fsTotalVerifTime / n).toFixed(3)),
    avgRepairLatencyMs: Number((prTotalRepairTime / n).toFixed(3)),
  };

  const naiveHeuristicMetrics: StrategyMetrics = {
    strategy: "Naive-Heuristic",
    scenarioCount: scenarios.length,
    initialFailures,
    finalSuccesses: nhSuccesses,
    successRate: Number(((nhSuccesses / n) * 100).toFixed(1)),
    avgRepairAttempts: Number((nhTotalAttempts / n).toFixed(2)),
    avgPatchOperations: Number((nhTotalPatchOps / n).toFixed(2)),
    avgVerificationLatencyMs: Number((nhTotalVerifTime / n).toFixed(3)),
    avgRepairLatencyMs: Number((nhTotalRepairTime / n).toFixed(3)),
  };

  return {
    timestamp: new Date().toISOString(),
    totalScenarios: scenarios.length,
    strategies: {
      firstShot: firstShotMetrics,
      postRepair: postRepairMetrics,
      naiveHeuristic: naiveHeuristicMetrics,
    },
    scenarios: scenarioRecords,
  };
}
