import * as http from "node:http";
import { ForgeSession, type SessionOptions } from "./session.js";
import { validateClientCommand, type ClientCommand } from "./protocol.js";
import { runAblationBenchmark } from "../ai/benchmark.js";
import type { IntentCompilerModel } from "../ai/compiler.js";
import type { LevelRepairModel } from "../ai/repairer.js";

export interface ServerOptions {
  compilerModel?: IntentCompilerModel | undefined;
  repairModel?: LevelRepairModel | undefined;
  port?: number | undefined;
}

/**
 * ForgeServer provides HTTP REST, Server-Sent Events (SSE), and unified
 * command endpoints to orchestrate ForgeLoop sessions without frontend or database coupling.
 */
export class ForgeServer {
  private sessions: Map<string, ForgeSession> = new Map();
  private httpServer: http.Server | null = null;
  private compilerModel?: IntentCompilerModel | undefined;
  private repairModel?: LevelRepairModel | undefined;

  constructor(options: ServerOptions = {}) {
    this.compilerModel = options.compilerModel;
    this.repairModel = options.repairModel;
  }

  public get sessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Creates a new isolated ForgeSession.
   */
  public createSession(intent: string, options: SessionOptions = {}): ForgeSession {
    const session = new ForgeSession(intent, {
      compilerModel: options.compilerModel ?? this.compilerModel,
      repairModel: options.repairModel ?? this.repairModel,
      sessionId: options.sessionId,
      physicsConfig: options.physicsConfig,
      maxRepairAttempts: options.maxRepairAttempts,
    });
    this.sessions.set(session.id, session);
    return session;
  }


  /**
   * Retrieves an existing session by ID.
   */
  public getSession(sessionId: string): ForgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Processes a structured ClientCommand according to the protocol.
   */
  public async handleCommand(input: unknown): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    details?: unknown;
  }> {
    const validation = validateClientCommand(input);
    if (!validation.valid || !validation.command) {
      return {
        success: false,
        error: `Invalid command: ${validation.errors.join("; ")}`,
        details: validation.errors,
      };
    }

    const command = validation.command;

    switch (command.type) {
      case "START_SESSION": {
        const session = this.createSession(command.intent, {
          sessionId: command.sessionId,
          physicsConfig: command.physicsConfig,
        });
        const state = await session.run();
        return {
          success: true,
          data: { sessionId: session.id, state },
        };
      }

      case "GET_SESSION": {
        const session = this.getSession(command.sessionId);
        if (!session) {
          return { success: false, error: `Session "${command.sessionId}" not found` };
        }
        return { success: true, data: session.getState() };
      }

      case "SABOTAGE_LEVEL": {
        const session = this.getSession(command.sessionId);
        if (!session) {
          return { success: false, error: `Session "${command.sessionId}" not found` };
        }
        const state = await session.sabotage(command.action, command.x, command.y);
        return { success: true, data: state };
      }

      case "REGRESS_PHYSICS": {
        const session = this.getSession(command.sessionId);
        if (!session) {
          return { success: false, error: `Session "${command.sessionId}" not found` };
        }
        const state = await session.regressPhysics(command.physicsConfig);
        return { success: true, data: state };
      }

      case "RUN_BENCHMARK": {
        const report = await runAblationBenchmark();
        return { success: true, data: report };
      }

      default: {
        return { success: false, error: `Unhandled command type: ${(command as any).type}` };
      }
    }
  }

  /**
   * Starts the Node.js HTTP server.
   */
  public async listen(port = 3000): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res).catch((err) => {
          console.error("Unhandled HTTP error:", err);
          if (!res.headersSent) {
            this.sendJson(res, 500, { error: "Internal server error", message: err.message });
          }
        });
      });

      this.httpServer.on("error", (err) => reject(err));
      this.httpServer.listen(port, () => {
        const address = this.httpServer?.address();
        const actualPort = typeof address === "object" && address ? address.port : port;
        resolve(actualPort);
      });
    });
  }

  /**
   * Closes the HTTP server.
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Routes incoming HTTP requests with CORS support.
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Add CORS headers for web development integration
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;

    // 1. Health Check
    if (req.method === "GET" && pathname === "/health") {
      this.sendJson(res, 200, {
        status: "ok",
        activeSessions: this.sessionCount,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. Ablation Benchmark
    if (req.method === "GET" && pathname === "/api/benchmark") {
      const report = await runAblationBenchmark();
      this.sendJson(res, 200, report);
      return;
    }

    // 3. Unified Command Gateway
    if (req.method === "POST" && pathname === "/api/command") {
      const body = await this.readJsonBody(req);
      const result = await this.handleCommand(body);
      const status = result.success ? 200 : 400;
      this.sendJson(res, status, result);
      return;
    }

    // 4. Create Session
    if (req.method === "POST" && pathname === "/api/sessions") {
      const body = await this.readJsonBody(req);
      if (!body || typeof body.intent !== "string" || body.intent.trim().length === 0) {
        this.sendJson(res, 400, { error: "Missing or invalid 'intent' in request body" });
        return;
      }

      const session = this.createSession(body.intent, {
        sessionId: body.sessionId,
        physicsConfig: body.physicsConfig,
      });

      // Execute session asynchronously
      const statePromise = session.run();

      // Return immediately if requested, or wait for initial generation
      if (url.searchParams.get("sync") === "true") {
        const state = await statePromise;
        this.sendJson(res, 200, { sessionId: session.id, state });
      } else {
        // Start run and return created ID
        this.sendJson(res, 201, { sessionId: session.id, initialStatus: "RUNNING" });
      }
      return;
    }

    // 5. Get Session State
    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      const sessionId = sessionMatch[1];
      if (!sessionId) {
        this.sendJson(res, 400, { error: "Missing session ID" });
        return;
      }
      const session = this.getSession(sessionId);
      if (!session) {
        this.sendJson(res, 404, { error: `Session "${sessionId}" not found` });
        return;
      }
      this.sendJson(res, 200, session.getState());
      return;
    }

    // 6. Server-Sent Events (SSE) Live Stream
    const eventsMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if (req.method === "GET" && eventsMatch) {
      const sessionId = eventsMatch[1];
      if (!sessionId) {
        this.sendJson(res, 400, { error: "Missing session ID" });
        return;
      }
      const session = this.getSession(sessionId);
      if (!session) {
        this.sendJson(res, 404, { error: `Session "${sessionId}" not found` });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Stream existing recorded events
      for (const event of session.events) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // Subscribe to subsequent live events
      const unsubscribe = session.subscribe((event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      });

      req.on("close", () => {
        unsubscribe();
      });
      return;
    }

    // 7. Sabotage Session
    const sabotageMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/sabotage$/);
    if (req.method === "POST" && sabotageMatch) {
      const sessionId = sabotageMatch[1];
      if (!sessionId) {
        this.sendJson(res, 400, { error: "Missing session ID" });
        return;
      }
      const session = this.getSession(sessionId);
      if (!session) {
        this.sendJson(res, 404, { error: `Session "${sessionId}" not found` });
        return;
      }
      const body = await this.readJsonBody(req);
      const action = body?.action === "CUT_BRIDGE" ? "CUT_BRIDGE" : "DROP_HAZARD";
      const state = await session.sabotage(action, body?.x, body?.y);
      this.sendJson(res, 200, state);
      return;
    }

    // 404 Route Not Found
    this.sendJson(res, 404, { error: `Endpoint not found: ${req.method} ${pathname}` });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        if (!body.trim()) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err: any) {
          reject(new Error(`Malformed JSON request body: ${err.message}`));
        }
      });
      req.on("error", (err) => reject(err));
    });
  }
}

/**
 * Convenience factory to create a ForgeServer instance.
 */
export function createForgeServer(options?: ServerOptions): ForgeServer {
  return new ForgeServer(options);
}
