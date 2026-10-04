import type {
  Level,
  LevelSpec,
  LevelPatch,
  VerificationResult,
  PhysicsConfig,
} from "../types.js";
import { BFSVerifier } from "../verifier/BFSVerifier.js";
import { validatePatch, applyPatch } from "../verifier/patches.js";
import {
  IntentCompiler,
  createMockCompilerModel,
  type IntentCompilerModel,
} from "../ai/compiler.js";
import { generateFromSpec } from "../ai/generator.js";
import {
  createMockRepairModel,
  validatePatchShape,
  type LevelRepairModel,
  type RepairAttempt,
  type RepairPromptInput,
} from "../ai/repairer.js";
import { extractJsonFromText } from "../ai/compiler.js";
import type { ServerEvent } from "./protocol.js";

export type SessionTerminalState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface SessionOptions {
  sessionId?: string | undefined;
  physicsConfig?: Partial<PhysicsConfig> | undefined;
  compilerModel?: IntentCompilerModel | undefined;
  repairModel?: LevelRepairModel | undefined;
  maxRepairAttempts?: number | undefined;
}


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

/**
 * ForgeSession orchestrates a single user session:
 * intent → compiler → generator → verifier → surgical repair → final verification.
 * Emits serializable ServerEvents at every transition for real-time frontend streaming.
 */
export class ForgeSession {
  public readonly id: string;
  public readonly intent: string;
  public terminalState: SessionTerminalState = "PENDING";

  public spec: LevelSpec | null = null;
  public level: Level | null = null;
  public verification: VerificationResult | null = null;
  public repairHistory: RepairAttempt[] = [];
  public events: ServerEvent[] = [];

  private listeners: Set<(event: ServerEvent) => void> = new Set();
  private verifier: BFSVerifier;
  private compiler: IntentCompiler;
  private repairModel: LevelRepairModel;
  private maxRepairAttempts: number;

  constructor(intent: string, options: SessionOptions = {}) {
    this.id = options.sessionId ?? `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.intent = intent;
    this.verifier = new BFSVerifier(options.physicsConfig);
    this.compiler = new IntentCompiler(options.compilerModel ?? createMockCompilerModel());
    this.repairModel = options.repairModel ?? createMockRepairModel();
    this.maxRepairAttempts = options.maxRepairAttempts ?? 3;
  }

  /**
   * Subscribes a listener to live server events.
   * Returns an unsubscribe callback.
   */
  public subscribe(listener: (event: ServerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emits a typed ServerEvent to all subscribers and records it in history.
   */
  private emit(event: ServerEvent): void {
    this.events.push(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(`Session ${this.id} listener error:`, err);
      }
    }
  }

  /**
   * Returns a serializable snapshot of the current session state.
   */
  public getState(): SessionSnapshot {
    return {
      sessionId: this.id,
      intent: this.intent,
      terminalState: this.terminalState,
      spec: this.spec,
      level: this.level,
      verification: this.verification,
      repairHistory: [...this.repairHistory],
      events: [...this.events],
    };
  }

  /**
   * Executes the autonomous ForgeLoop lifecycle:
   * 1. Intent received
   * 2. LevelSpec compilation
   * 3. Level generation
   * 4. Initial BFS verification
   * 5. Counterexample-guided surgical repair loop (if needed)
   * 6. Final verification & completion
   */
  public async run(): Promise<SessionSnapshot> {
    this.terminalState = "RUNNING";

    this.emit({
      type: "SESSION_STARTED",
      sessionId: this.id,
      timestamp: new Date().toISOString(),
    });

    this.emit({
      type: "INTENT_RECEIVED",
      sessionId: this.id,
      intent: this.intent,
      timestamp: new Date().toISOString(),
    });

    try {
      // 1. Compile intent into LevelSpec
      let compResult;
      try {
        compResult = await this.compiler.compile(this.intent);
      } catch (compileErr: any) {
        console.warn(
          `[ForgeSession ${this.id}] Live compiler failed (${compileErr.message}), falling back to deterministic mock compiler...`
        );
        const fallbackCompiler = new IntentCompiler(createMockCompilerModel());
        compResult = await fallbackCompiler.compile(this.intent);
      }

      if (!compResult.validation.valid || !compResult.spec) {
        const errorMsg = `Intent compilation failed: ${compResult.validation.errors.join("; ")}`;
        this.terminalState = "FAILED";
        this.emit({
          type: "ERROR",
          sessionId: this.id,
          code: "COMPILER_VALIDATION_ERROR",
          message: errorMsg,
          details: compResult.validation.errors,
          timestamp: new Date().toISOString(),
        });
        return this.getState();
      }

      this.spec = compResult.spec;
      this.emit({
        type: "SPEC_GENERATED",
        sessionId: this.id,
        spec: this.spec,
        timestamp: new Date().toISOString(),
      });

      // 2. Generate discrete Level from LevelSpec
      try {
        this.level = generateFromSpec(this.spec);
      } catch (genErr: any) {
        this.terminalState = "FAILED";
        this.emit({
          type: "ERROR",
          sessionId: this.id,
          code: "GENERATOR_ERROR",
          message: `Level generation failed: ${genErr.message}`,
          timestamp: new Date().toISOString(),
        });
        return this.getState();
      }

      this.emit({
        type: "LEVEL_GENERATED",
        sessionId: this.id,
        level: this.level,
        timestamp: new Date().toISOString(),
      });

      // 3. First-Shot Verification
      this.emit({
        type: "VERIFICATION_STARTED",
        sessionId: this.id,
        phase: "FIRST_SHOT",
        timestamp: new Date().toISOString(),
      });

      this.verification = this.verifier.verify(this.level);

      this.emit({
        type: "VERIFICATION_COMPLETED",
        sessionId: this.id,
        phase: "FIRST_SHOT",
        result: this.verification,
        timestamp: new Date().toISOString(),
      });

      // If First-Shot passes, complete immediately without repair
      if (this.verification.status === "PASSED") {
        this.terminalState = "COMPLETED";
        this.emit({
          type: "SESSION_COMPLETED",
          sessionId: this.id,
          success: true,
          attempts: 0,
          finalLevel: this.level,
          verification: this.verification,
          timestamp: new Date().toISOString(),
        });
        return this.getState();
      }

      // 4. Bounded Surgical Repair Loop
      let currentAttempt = 0;
      let repairPassed = false;
      let currentFailure = this.verification;

      while (currentAttempt < this.maxRepairAttempts && !repairPassed) {
        currentAttempt++;
        const counterexample = currentFailure.counterexample;

        this.emit({
          type: "REPAIR_STARTED",
          sessionId: this.id,
          attempt: currentAttempt,
          maxAttempts: this.maxRepairAttempts,
          counterexample,
          timestamp: new Date().toISOString(),
        });


        const repairInput: RepairPromptInput = {
          intent: this.intent,
          spec: this.spec,
          level: this.level,
          verification: this.verification,
          counterexample,
          attempt: currentAttempt,
          maxAttempts: this.maxRepairAttempts,
        };

        let proposedPatch: LevelPatch | null = null;
        let patchValid = false;
        let patchErrors: string[] = [];
        const verificationBefore = this.verification;
        let verificationAfter: VerificationResult | null = null;

        try {
          let rawPatch: unknown;
          try {
            rawPatch = await this.repairModel.repairLevel(repairInput);
          } catch (repairModelErr: any) {
            console.warn(
              `[ForgeSession ${this.id}] Live repair model failed (${repairModelErr.message}), falling back to deterministic mock repairer...`
            );
            const fallbackRepairer = createMockRepairModel();
            rawPatch = await fallbackRepairer.repairLevel(repairInput);
          }
          let parsed: unknown = rawPatch;
          if (typeof rawPatch === "string") {
            parsed = extractJsonFromText(rawPatch);
          }

          const shapeCheck = validatePatchShape(parsed);
          if (!shapeCheck.valid || !shapeCheck.patch) {
            patchValid = false;
            patchErrors = shapeCheck.errors;
          } else {
            proposedPatch = shapeCheck.patch;
            const domainCheck = validatePatch(this.level, proposedPatch);
            if (!domainCheck.valid) {
              patchValid = false;
              patchErrors = domainCheck.errors;
            } else {
              patchValid = true;
            }
          }
        } catch (patchErr: any) {
          patchValid = false;
          patchErrors = [`Repair patch extraction failed: ${patchErr.message}`];
        }

        if (patchValid && proposedPatch) {
          this.emit({
            type: "PATCH_PROPOSED",
            sessionId: this.id,
            attempt: currentAttempt,
            patch: proposedPatch,
            timestamp: new Date().toISOString(),
          });

          const applyRes = applyPatch(this.level, proposedPatch);
          if (applyRes.success) {
            this.level = applyRes.level;
            this.emit({
              type: "PATCH_APPLIED",
              sessionId: this.id,
              attempt: currentAttempt,
              patch: proposedPatch,
              level: this.level,
              timestamp: new Date().toISOString(),
            });

            this.emit({
              type: "VERIFICATION_STARTED",
              sessionId: this.id,
              phase: "POST_PATCH",
              attempt: currentAttempt,
              timestamp: new Date().toISOString(),
            });

            verificationAfter = this.verifier.verify(this.level);
            this.verification = verificationAfter;

            this.emit({
              type: "VERIFICATION_COMPLETED",
              sessionId: this.id,
              phase: "POST_PATCH",
              result: this.verification,
              timestamp: new Date().toISOString(),
            });

            if (this.verification.status === "PASSED") {
              repairPassed = true;
            } else {
              currentFailure = this.verification;
            }

          } else {
            patchValid = false;
            patchErrors = applyRes.errors;
          }
        }

        this.repairHistory.push({
          attempt: currentAttempt,
          counterexample,
          proposedPatch,
          patchValid,
          patchErrors,
          verificationBefore,
          verificationAfter,
        });
      }

      this.emit({
        type: "REPAIR_COMPLETED",
        sessionId: this.id,
        success: repairPassed,
        attempts: currentAttempt,
        finalLevel: this.level,
        timestamp: new Date().toISOString(),
      });

      this.terminalState = repairPassed ? "COMPLETED" : "FAILED";

      this.emit({
        type: "SESSION_COMPLETED",
        sessionId: this.id,
        success: repairPassed,
        attempts: currentAttempt,
        finalLevel: this.level,
        verification: this.verification,
        timestamp: new Date().toISOString(),
      });

      return this.getState();
    } catch (unexpectedErr: any) {
      this.terminalState = "FAILED";
      this.emit({
        type: "ERROR",
        sessionId: this.id,
        code: "UNEXPECTED_SESSION_ERROR",
        message: unexpectedErr?.message ?? "An unexpected error occurred during session execution",
        details: unexpectedErr?.stack,
        timestamp: new Date().toISOString(),
      });
      return this.getState();
    }
  }

  /**
   * Judge Sabotage Interaction:
   * Actively injects a physical sabotage into the verified level
   * (e.g. dropping a hazard or cutting a bridge) to prove instant real-time
   * counterexample detection and surgical repair.
   */
  public async sabotage(
    action: "DROP_HAZARD" | "CUT_BRIDGE",
    x?: number,
    y?: number
  ): Promise<SessionSnapshot> {
    if (!this.level) {
      this.emit({
        type: "ERROR",
        sessionId: this.id,
        code: "SABOTAGE_ERROR",
        message: "Cannot sabotage session: no active level exists",
        timestamp: new Date().toISOString(),
      });
      return this.getState();
    }

    const targetX = x ?? Math.floor(this.level.width / 2);
    const targetY = y ?? (this.level.height - 2);

    const patch: LevelPatch = {
      operations: [
        {
          type: "REPLACE_TILE",
          x: targetX,
          y: targetY,
          newTile: action === "DROP_HAZARD" ? "HAZARD" : "AIR",
        },
      ],
    };

    const applyRes = applyPatch(this.level, patch);
    if (!applyRes.success) {
      this.emit({
        type: "ERROR",
        sessionId: this.id,
        code: "SABOTAGE_PATCH_FAILED",
        message: applyRes.errors.join("; "),
        timestamp: new Date().toISOString(),
      });
      return this.getState();
    }

    this.level = applyRes.level;
    this.emit({
      type: "PATCH_APPLIED",
      sessionId: this.id,
      attempt: 0,
      patch,
      level: this.level,
      timestamp: new Date().toISOString(),
    });

    this.emit({
      type: "VERIFICATION_STARTED",
      sessionId: this.id,
      phase: "POST_SABOTAGE",
      timestamp: new Date().toISOString(),
    });

    this.verification = this.verifier.verify(this.level);

    this.emit({
      type: "VERIFICATION_COMPLETED",
      sessionId: this.id,
      phase: "POST_SABOTAGE",
      result: this.verification,
      timestamp: new Date().toISOString(),
    });

    return this.getState();
  }

  /**
   * Parametric Rules-Change Regression:
   * Nerfs or buffs player physics and immediately re-evaluates solvability.
   */
  public async regressPhysics(
    config: Partial<PhysicsConfig>
  ): Promise<SessionSnapshot> {
    if (!this.level) {
      this.emit({
        type: "ERROR",
        sessionId: this.id,
        code: "REGRESSION_ERROR",
        message: "Cannot regress physics: no active level exists",
        timestamp: new Date().toISOString(),
      });
      return this.getState();
    }

    this.verifier = new BFSVerifier(config);

    this.emit({
      type: "VERIFICATION_STARTED",
      sessionId: this.id,
      phase: "POST_REGRESSION",
      timestamp: new Date().toISOString(),
    });

    this.verification = this.verifier.verify(this.level);

    this.emit({
      type: "VERIFICATION_COMPLETED",
      sessionId: this.id,
      phase: "POST_REGRESSION",
      result: this.verification,
      timestamp: new Date().toISOString(),
    });

    return this.getState();
  }

  /**
   * Triggers the bounded repair loop on the current level state.
   * Useful when a level is broken by sabotage or physics regression and needs autonomous healing.
   */
  public async repair(): Promise<SessionSnapshot> {
    if (!this.level) {
      this.emit({
        type: "ERROR",
        sessionId: this.id,
        code: "REPAIR_ERROR",
        message: "Cannot repair session: no active level exists",
        timestamp: new Date().toISOString(),
      });
      return this.getState();
    }

    if (!this.verification) {
      this.verification = this.verifier.verify(this.level);
    }

    if (this.verification.status === "PASSED") {
      return this.getState();
    }

    let currentAttempt = 0;
    let repairPassed = false;
    let currentFailure = this.verification;

    while (currentAttempt < this.maxRepairAttempts && !repairPassed) {
      currentAttempt++;
      const counterexample = currentFailure.counterexample;

      this.emit({
        type: "REPAIR_STARTED",
        sessionId: this.id,
        attempt: currentAttempt,
        maxAttempts: this.maxRepairAttempts,
        counterexample,
        timestamp: new Date().toISOString(),
      });

      const repairInput: RepairPromptInput = {
        intent: this.intent,
        spec: this.spec ?? undefined,
        level: this.level,
        verification: this.verification,
        counterexample,
        attempt: currentAttempt,
        maxAttempts: this.maxRepairAttempts,
      };

      let proposedPatch: LevelPatch | null = null;
      let patchValid = false;
      let patchErrors: string[] = [];
      const verificationBefore = this.verification;
      let verificationAfter: VerificationResult | null = null;

      try {
        const rawPatch = await this.repairModel.repairLevel(repairInput);
        let parsed: unknown = rawPatch;
        if (typeof rawPatch === "string") {
          parsed = extractJsonFromText(rawPatch);
        }

        const shapeCheck = validatePatchShape(parsed);
        if (!shapeCheck.valid || !shapeCheck.patch) {
          patchValid = false;
          patchErrors = shapeCheck.errors;
        } else {
          proposedPatch = shapeCheck.patch;
          const domainCheck = validatePatch(this.level, proposedPatch);
          if (!domainCheck.valid) {
            patchValid = false;
            patchErrors = domainCheck.errors;
          } else {
            patchValid = true;
          }
        }
      } catch (patchErr: any) {
        patchValid = false;
        patchErrors = [`Repair patch extraction failed: ${patchErr.message}`];
      }

      if (patchValid && proposedPatch) {
        this.emit({
          type: "PATCH_PROPOSED",
          sessionId: this.id,
          attempt: currentAttempt,
          patch: proposedPatch,
          timestamp: new Date().toISOString(),
        });

        const applyRes = applyPatch(this.level, proposedPatch);
        if (applyRes.success) {
          this.level = applyRes.level;
          this.emit({
            type: "PATCH_APPLIED",
            sessionId: this.id,
            attempt: currentAttempt,
            patch: proposedPatch,
            level: this.level,
            timestamp: new Date().toISOString(),
          });

          this.emit({
            type: "VERIFICATION_STARTED",
            sessionId: this.id,
            phase: "POST_PATCH",
            attempt: currentAttempt,
            timestamp: new Date().toISOString(),
          });

          verificationAfter = this.verifier.verify(this.level);
          this.verification = verificationAfter;

          this.emit({
            type: "VERIFICATION_COMPLETED",
            sessionId: this.id,
            phase: "POST_PATCH",
            result: this.verification,
            timestamp: new Date().toISOString(),
          });

          if (this.verification.status === "PASSED") {
            repairPassed = true;
          } else {
            currentFailure = this.verification;
          }
        } else {
          patchValid = false;
          patchErrors = applyRes.errors;
        }
      }

      this.repairHistory.push({
        attempt: currentAttempt,
        counterexample,
        proposedPatch,
        patchValid,
        patchErrors,
        verificationBefore,
        verificationAfter,
      });
    }

    this.emit({
      type: "REPAIR_COMPLETED",
      sessionId: this.id,
      success: repairPassed,
      attempts: currentAttempt,
      finalLevel: this.level,
      timestamp: new Date().toISOString(),
    });

    this.terminalState = repairPassed ? "COMPLETED" : "FAILED";

    this.emit({
      type: "SESSION_COMPLETED",
      sessionId: this.id,
      success: repairPassed,
      attempts: currentAttempt,
      finalLevel: this.level,
      verification: this.verification,
      timestamp: new Date().toISOString(),
    });

    return this.getState();
  }
}
