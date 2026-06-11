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
import { resolveHookAgentId } from "./agent-id-resolver";
import { recordHookEventInBuffer, getRecentHookEventsFromBuffer, createSingleRequestHookEventRecorder } from "./hook-event-buffer";
import { resolveCodexOfficialHookState } from "./codex-official-turns";
import { buildToolInputFingerprint, normalizeHookToolUseId, truncateDeep } from "./permission-utils";
import CodexSubagentClassifier from "../agents/codex-subagent-classifier";

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

function readBool(raw: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function resolvePermissionAgentId(raw: Record<string, unknown>, url: URL): string {
  const resolved = resolveHookAgentId(raw);
  if (!resolved.defaulted) return resolved.agentId;
  const hinted = url.searchParams.get("agentId")?.trim();
  return hinted || resolved.agentId;
}

function normalizeStatePayload(raw: Record<string, unknown>): AgentStateEvent {
  const resolved = resolveHookAgentId(raw);
  return {
    agentId: resolved.agentId,
    sessionId: readString(raw, "sessionId", "session_id") || "",
    event: readString(raw, "event") || "",
    rawState: readString(raw, "rawState", "raw_state", "state") || undefined,
    cwd: readString(raw, "cwd") || undefined,
    toolName: readString(raw, "toolName", "tool_name") || undefined,
    sourcePid: readNumber(raw, "sourcePid", "source_pid"),
    agentPid: readNumber(raw, "agentPid", "agent_pid", "claude_pid", "codex_pid"),
    model: readString(raw, "model") || undefined,
    provider: readString(raw, "provider") || undefined,
    occurredAt: readNumber(raw, "occurredAt", "occurred_at") ?? Date.now(),
    hookSource: readString(raw, "hook_source") || undefined,
    sessionTitle: readString(raw, "session_title") || undefined,
    turnId: readString(raw, "turn_id") || undefined,
    toolUseId: normalizeHookToolUseId(raw.tool_use_id ?? raw.toolUseId ?? raw.toolUseID) || undefined,
    toolInputFingerprint: raw.tool_input && typeof raw.tool_input === "object"
      ? buildToolInputFingerprint(raw.tool_input) ?? undefined : undefined,
    assistantLastOutput: readString(raw, "assistant_last_output") || undefined,
    assistantLastOutputTruncated: readBool(raw, "assistant_last_output_truncated"),
    codexSessionRole: readString(raw, "codex_session_role") || undefined,
    codexOriginator: readString(raw, "codex_originator") || undefined,
    codexSource: readString(raw, "codex_source") || undefined,
    headless: readBool(raw, "headless"),
    preserveState: readBool(raw, "preserve_state"),
    editor: readString(raw, "editor") || undefined,
    permissionMode: readString(raw, "permission_mode") || undefined,
    transcriptPath: readString(raw, "transcript_path") || undefined,
  };
}

function normalizePermissionPayload(raw: Record<string, unknown>, url: URL): PermissionRequest {
  const rawInput = raw.rawInput ?? raw.raw_input ?? raw.tool_input ?? raw;
  return {
    id: readString(raw, "id") || crypto.randomUUID(),
    agentId: resolvePermissionAgentId(raw, url),
    sessionId: readString(raw, "sessionId", "session_id") || "",
    toolName: readString(raw, "toolName", "tool_name") || "",
    summary: readString(raw, "summary", "tool_input_description") || "",
    cwd: readString(raw, "cwd") || undefined,
    riskHint: readString(raw, "riskHint", "risk_hint") || undefined,
    rawInput,
    suggestions: (raw.suggestions as PermissionRequest["suggestions"]) ?? (raw.permission_suggestions as PermissionRequest["suggestions"]) ?? [],
    requiresTextInput: (raw.requiresTextInput as boolean) ?? (raw.requires_text_input as boolean) ?? false,
    createdAt: readNumber(raw, "createdAt", "created_at") ?? Date.now(),
    toolUseId: normalizeHookToolUseId(raw.tool_use_id ?? raw.toolUseId ?? raw.toolUseID) || undefined,
    toolInputFingerprint: raw.tool_input && typeof raw.tool_input === "object"
      ? buildToolInputFingerprint(raw.tool_input) ?? undefined : undefined,
    hookSource: readString(raw, "hook_source") || undefined,
    turnId: readString(raw, "turn_id") || undefined,
    permissionMode: readString(raw, "permission_mode") || undefined,
    transcriptPath: readString(raw, "transcript_path") || undefined,
  };
}

export class BeaconServer {
  private stateStore: StateStore;
  private permissionStore: PermissionStore;
  private settings: SettingsStore;
  private onStateEvent?: (event: AgentStateEvent) => void;
  private port: number | null = null;
  private server: ReturnType<typeof createServer> | null = null;
  private hookEventBuffer = new Map<string, unknown[]>();
  private codexOfficialTurns = new Map<string, { sessionId: string; hadToolUse: boolean }>();
  private codexClassifier = new CodexSubagentClassifier();

  constructor(
    stateStore: StateStore,
    permissionStore: PermissionStore,
    settings: SettingsStore,
    onStateEvent?: (event: AgentStateEvent) => void,
  ) {
    this.stateStore = stateStore;
    this.permissionStore = permissionStore;
    this.settings = settings;
    this.onStateEvent = onStateEvent;
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

  getRecentHookEvents(options: { since?: number; agentId?: string } = {}): unknown[] {
    return getRecentHookEventsFromBuffer(this.hookEventBuffer, options);
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
        await this.handleState(req, res);
        return;
      }

      if (req.method === "POST" && url.pathname === "/permission") {
        await this.handlePermission(req, res, url);
        return;
      }

      res.writeHead(404).end("Not Found");
    } catch (err) {
      console.error("[BeaconServer] Request error:", err);
      this.sendJson(res, 500, { error: "Internal server error" });
    }
  }

  private async handleState(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    const raw = JSON.parse(body) as Record<string, unknown>;
    const event = normalizeStatePayload(raw);

    log.info("server", "State hook received", {
      agentId: event.agentId,
      sessionId: event.sessionId,
      event: event.event,
      rawState: event.rawState,
      toolName: event.toolName,
      cwd: event.cwd,
      hookSource: event.hookSource,
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

    const recorder = createSingleRequestHookEventRecorder(
      (data, route, outcome) => recordHookEventInBuffer(this.hookEventBuffer, data, route, outcome),
      raw,
      "state",
    );

    const settings = this.settings.get();
    const agentSettings = settings.agents[event.agentId];
    if (agentSettings && !agentSettings.stateEnabled) {
      log.info("server", "State hook ignored, stateEnabled=false", {
        agentId: event.agentId,
        sessionId: event.sessionId,
      });
      recorder.droppedByDisabled();
      this.sendJson(res, 200, { status: "ignored" });
      return;
    }

    if (event.hookSource === "codex-official" && event.agentId === "codex") {
      const codexResult = resolveCodexOfficialHookState(
        raw, event.rawState || "", this.codexOfficialTurns, this.codexClassifier,
      );
      if (codexResult.drop) {
        recorder.accepted();
        this.sendJson(res, 200, { status: "dropped-stop-hook" });
        return;
      }
      if (codexResult.headless) event.headless = true;
      if (codexResult.state && codexResult.state !== event.rawState) {
        event.rawState = codexResult.state;
      }
    }

    recorder.accepted();
    this.stateStore.handleStateEvent(event);
    this.onStateEvent?.(event);
    this.sendJson(res, 200, { status: "ok" });
  }

  private async handlePermission(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const body = await this.readBody(req);
    const raw = JSON.parse(body) as Record<string, unknown>;
    const request = normalizePermissionPayload(raw, url);

    log.info("server", "Permission hook received", {
      agentId: request.agentId,
      sessionId: request.sessionId,
      toolName: request.toolName,
      summary: request.summary,
      hookSource: request.hookSource,
    });

    recordHookEventInBuffer(this.hookEventBuffer, raw, "permission", "accepted");

    const settings = this.settings.get();
    const agentSettings = settings.agents[request.agentId];
    if (!agentSettings || !agentSettings.permissionEnabled) {
      log.info("server", "Permission hook ignored, permissionEnabled=false", {
        agentId: request.agentId,
      });
      this.sendJson(res, 200, { decision: "no-decision", reason: "permission handling disabled" });
      return;
    }

    const decision = await this.permissionStore.enqueue(request);
    this.sendJson(res, 200, formatPermissionResponse(request.agentId, decision));
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
    res.writeHead(status, {
      "Content-Type": "application/json",
      "x-clawd-server": "ai-status-beacon",
    });
    res.end(JSON.stringify(body));
  }
}