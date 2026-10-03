import type {
  Level,
  LevelSpec,
  LevelPatch,
  Counterexample,
  VerificationResult,
  PhysicsConfig,
} from "../types.js";

// ============================================================
// Client Commands (Discriminated Union)
// ============================================================

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

// ============================================================
// Server Events (Discriminated Union)
// ============================================================

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
// Client Message Validator
// ============================================================

export interface CommandValidationResult {
  valid: boolean;
  errors: string[];
  command?: ClientCommand;
}

const KNOWN_COMMAND_TYPES = new Set([
  "START_SESSION",
  "SABOTAGE_LEVEL",
  "REGRESS_PHYSICS",
  "REPAIR_SESSION",
  "GET_SESSION",
  "RUN_BENCHMARK",
]);

/**
 * Validates untrusted incoming client messages.
 * Rejects unknown types, malformed structures, or missing required fields.
 */
export function validateClientCommand(input: unknown): CommandValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Command must be a non-null object"] };
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw.type !== "string") {
    errors.push("Missing or invalid 'type' property; expected string");
    return { valid: false, errors };
  }

  if (!KNOWN_COMMAND_TYPES.has(raw.type)) {
    errors.push(`Unknown command type: "${raw.type}"`);
    return { valid: false, errors };
  }

  switch (raw.type) {
    case "START_SESSION": {
      if (typeof raw.intent !== "string" || raw.intent.trim().length === 0) {
        errors.push("START_SESSION requires a non-empty 'intent' string");
      }
      if (raw.sessionId !== undefined && typeof raw.sessionId !== "string") {
        errors.push("'sessionId' must be a string if provided");
      }
      if (raw.physicsConfig !== undefined && (typeof raw.physicsConfig !== "object" || raw.physicsConfig === null)) {
        errors.push("'physicsConfig' must be an object if provided");
      }
      break;
    }

    case "SABOTAGE_LEVEL": {
      if (typeof raw.sessionId !== "string" || raw.sessionId.trim().length === 0) {
        errors.push("SABOTAGE_LEVEL requires a non-empty 'sessionId' string");
      }
      if (raw.action !== "DROP_HAZARD" && raw.action !== "CUT_BRIDGE") {
        errors.push("SABOTAGE_LEVEL requires 'action' to be 'DROP_HAZARD' or 'CUT_BRIDGE'");
      }
      if (raw.x !== undefined && (typeof raw.x !== "number" || !Number.isInteger(raw.x))) {
        errors.push("'x' coordinate must be an integer if provided");
      }
      if (raw.y !== undefined && (typeof raw.y !== "number" || !Number.isInteger(raw.y))) {
        errors.push("'y' coordinate must be an integer if provided");
      }
      break;
    }

    case "REGRESS_PHYSICS": {
      if (typeof raw.sessionId !== "string" || raw.sessionId.trim().length === 0) {
        errors.push("REGRESS_PHYSICS requires a non-empty 'sessionId' string");
      }
      if (!raw.physicsConfig || typeof raw.physicsConfig !== "object") {
        errors.push("REGRESS_PHYSICS requires a 'physicsConfig' object");
      }
      break;
    }

    case "REPAIR_SESSION": {
      if (typeof raw.sessionId !== "string" || raw.sessionId.trim().length === 0) {
        errors.push("REPAIR_SESSION requires a non-empty 'sessionId' string");
      }
      break;
    }

    case "GET_SESSION": {
      if (typeof raw.sessionId !== "string" || raw.sessionId.trim().length === 0) {
        errors.push("GET_SESSION requires a non-empty 'sessionId' string");
      }
      break;
    }

    case "RUN_BENCHMARK": {
      break;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    command: raw as unknown as ClientCommand,
  };
}
