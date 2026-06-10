import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";
import { homedir } from "os";
import type { AgentStateEvent, PermissionRequest } from "../../../shared/types";
import type { StateStore } from "../state/state-store";
import type { PermissionStore } from "../permission/permission-store";
import type { SettingsStore } from "../settings/settings-store";
import { formatPermissionResponse } from "../permission/permission-response-adapter";
import { getLogger } from "../utils/logger";

const PORT_START = 23333;
const PORT_END = 23337;
const MAX_BODY_SIZE = 512 * 1024;
const RUNTIME_DIR = join(homedir(), ".ai-status-beacon");
const RUNTIME_FILE = join(RUNTIME_DIR, "runtime.json");
const log = getLogger();

function readString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

function readNumber(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function normalizeStatePayload(raw: Record<string, unknown>): AgentStateEvent {
  return {
    agentId: readString(raw, "agentId", "agent_id") || "",
    sessionId: readString(raw, "sessionId", "session_id") || "",
    event: readString(raw, "event") || "",
    rawState: readString(raw, "rawState", "raw_state", "state") || undefined,
    cwd: readString(raw, "cwd") || undefined,
    toolName: readString(raw, "toolName", "tool_name") || undefined,
    sourcePid: readNumber(raw, "sourcePid", "source_pid"),
    agentPid: readNumber(raw, "agentPid", "agent_pid", "claude_pid"),
    model: readString(raw, "model") || undefined,
    provider: readString(raw, "provider") || undefined,
    occurredAt: readNumber(raw, "occurredAt", "occurred_at") ?? Date.now(),
  };
}

function normalizePermissionPayload(raw: Record<string, unknown>): PermissionRequest {
  const rawInput = raw.rawInput ?? raw.raw_input ?? raw.tool_input ?? raw;
  return {
    id: readString(raw, "id") || crypto.randomUUID(),
    agentId: readString(raw, "agentId", "agent_id") || "",
    sessionId: readString(raw, "sessionId", "session_id") || "",
    toolName: readString(raw, "toolName", "tool_name") || "",
    summary: readString(raw, "summary", "tool_input_description") || "",
    cwd: readString(raw, "cwd") || undefined,
    riskHint: readString(raw, "riskHint", "risk_hint") || undefined,
    rawInput,
    suggestions: (raw.suggestions as PermissionRequest["suggestions"]) ?? [],
    requiresTextInput: (raw.requiresTextInput as boolean) ?? (raw.requires_text_input as boolean) ?? false,
    createdAt: readNumber(raw, "createdAt", "created_at") ?? Date.now(),
  };
}

export class BeaconServer {
  private stateStore: StateStore;
  private permissionStore: PermissionStore;
  private settings: SettingsStore;
  private port: number | null = null;
  private server: ReturnType<typeof createServer> | null = null;

  constructor(stateStore: StateStore, permissionStore: PermissionStore, settings: SettingsStore) {
    this.stateStore = stateStore;
    this.permissionStore = permissionStore;
    this.settings = settings;
  }

  async start(): Promise<void> {
    this.port = await this.findAvailablePort();
    this.server = createServer((req, res) => this.handleRequest(req, res));
    this.server.listen(this.port, "127.0.0.1", () => {
      console.log(`[BeaconServer] Listening on 127.0.0.1:${this.port}`);
      this.writeRuntimeConfig();
    });
  }

  getPort(): number | null {
    return this.port;
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.removeRuntimeConfig();
  }

  private async findAvailablePort(): Promise<number> {
    for (let port = PORT_START; port <= PORT_END; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const testServer = createServer();
          testServer.once("error", reject);
          testServer.listen(port, "127.0.0.1", () => {
            testServer.close(() => resolve());
          });
        });
        return port;
      } catch {
        continue;
      }
    }
    throw new Error(`No available port in range ${PORT_START}-${PORT_END}`);
  }

  private writeRuntimeConfig(): void {
    try {
      if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
      writeFileSync(RUNTIME_FILE, JSON.stringify({
        app: "ai-status-beacon",
        port: this.port,
        pid: process.pid,
      }, null, 2));
    } catch (err) {
      console.error("[BeaconServer] Failed to write runtime config:", err);
    }
  }

  private removeRuntimeConfig(): void {
    try {
      if (existsSync(RUNTIME_FILE)) {
        const data = JSON.parse(readFileSync(RUNTIME_FILE, "utf-8"));
        if (data.pid === process.pid) {
          writeFileSync(RUNTIME_FILE, JSON.stringify({ app: "ai-status-beacon", port: null }));
        }
      }
    } catch {
      // ignore
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.port}`);

    try {
      if (req.method === "GET" && url.pathname === "/health") {
        this.sendJson(res, 200, {
          app: "ai-status-beacon",
          port: this.port,
          version: app.getVersion(),
          status: "ok",
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/state") {
        this.sendJson(res, 200, { available: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/state") {
        const body = await this.readBody(req);
        const event = normalizeStatePayload(JSON.parse(body) as Record<string, unknown>);

        log.info("server", "State hook received", {
          agentId: event.agentId,
          sessionId: event.sessionId,
          event: event.event,
          rawState: event.rawState,
          toolName: event.toolName,
          cwd: event.cwd,
        });

        if (!event.agentId || !event.sessionId || !event.event) {
          log.warn("server", "State hook missing required fields", {
            agentId: event.agentId,
            sessionId: event.sessionId,
            event: event.event,
          });
          this.sendJson(res, 400, { error: "Missing required fields: agentId, sessionId, event" });
          return;
        }

        event.occurredAt = event.occurredAt ?? Date.now();

        // Check if agent state monitoring is enabled
        const settings = this.settings.get();
        const agentSettings = settings.agents[event.agentId];
        if (agentSettings && !agentSettings.stateEnabled) {
          log.info("server", "State hook ignored, stateEnabled=false", {
            agentId: event.agentId,
            sessionId: event.sessionId,
            event: event.event,
          });
          this.sendJson(res, 200, { status: "ignored" });
          return;
        }

        this.stateStore.handleStateEvent(event);
        this.sendJson(res, 200, { status: "ok" });
        return;
      }

      if (req.method === "POST" && url.pathname === "/permission") {
        const body = await this.readBody(req);
        const request = normalizePermissionPayload(JSON.parse(body) as Record<string, unknown>);

        log.info("server", "Permission hook received", {
          agentId: request.agentId,
          sessionId: request.sessionId,
          toolName: request.toolName,
          summary: request.summary,
        });

        // Check if agent permission handling is enabled
        const settings = this.settings.get();
        const agentSettings = settings.agents[request.agentId];
        if (!agentSettings || !agentSettings.permissionEnabled) {
          log.info("server", "Permission hook ignored, permissionEnabled=false", {
            agentId: request.agentId,
            sessionId: request.sessionId,
            toolName: request.toolName,
          });
          this.sendJson(res, 200, { decision: "no-decision", reason: "permission handling disabled" });
          return;
        }

        // Enqueue and wait for user decision
        const decision = await this.permissionStore.enqueue(request);
        this.sendJson(res, 200, formatPermissionResponse(request.agentId, decision));
        return;
      }

      res.writeHead(404).end("Not Found");
    } catch (err) {
      console.error("[BeaconServer] Request error:", err);
      this.sendJson(res, 500, { error: "Internal server error" });
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_SIZE) {
          reject(new Error("Body too large"));
          req.destroy();
          return;
        }
        data += chunk.toString();
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });
  }

  private sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }
}
