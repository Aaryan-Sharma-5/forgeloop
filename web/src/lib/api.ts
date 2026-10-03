import type {
  ClientCommand,
  SessionSnapshot,
  BenchmarkReport,
  PhysicsConfig,
} from "../types.ts";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Creates a new ForgeLoop session with a natural-language intent.
 */
export async function createSession(
  intent: string,
  physicsConfig?: Partial<PhysicsConfig>
): Promise<{ sessionId: string; state?: SessionSnapshot }> {
  const res = await fetch(`${API_BASE}/api/sessions?sync=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, physicsConfig }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create session (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Fetches current session snapshot by ID.
 */
export async function getSession(sessionId: string): Promise<SessionSnapshot> {
  const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch session "${sessionId}" (${res.status})`);
  }
  return res.json();
}

/**
 * Injects judge sabotage (DROP_HAZARD or CUT_BRIDGE) to test real-time verifier detection and repair.
 */
export async function sabotageSession(
  sessionId: string,
  action: "DROP_HAZARD" | "CUT_BRIDGE",
  x?: number,
  y?: number
): Promise<SessionSnapshot> {
  const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/sabotage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, x, y }),
  });

  if (!res.ok) {
    throw new Error(`Sabotage failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

/**
 * Unified command gateway executing any valid protocol ClientCommand.
 */
export async function sendCommand(
  command: ClientCommand
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const res = await fetch(`${API_BASE}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  const json = await res.json();
  if (!res.ok && json.error) {
    throw new Error(json.error);
  }

  return json;
}

/**
 * Runs the live 3-way ablation benchmark suite.
 */
export async function getBenchmark(): Promise<BenchmarkReport> {
  const res = await fetch(`${API_BASE}/api/benchmark`);
  if (!res.ok) {
    throw new Error(`Failed to run benchmark (${res.status})`);
  }
  return res.json();
}

/**
 * Checks backend health and active sessions.
 */
export async function checkHealth(): Promise<{ status: string; activeSessions: number }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  createSession,
  getSession,
  sabotageSession,
  sendCommand,
  getBenchmark,
  checkHealth,
};

export default api;
