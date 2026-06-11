import { existsSync, openSync, closeSync, readSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join, basename } from "path";
import type { AgentSession, AgentStateEvent } from "../../../shared/types";
import type { StateStore } from "../state/state-store";
import { getLogger } from "../utils/logger";
import { applyCodexJsonlEntry, createPermissionTransition, clearPendingApproval, setPendingApproval, type CodexJsonlSnapshot, type CodexJsonlTransition } from "./codex-jsonl-parser";
import CodexSubagentClassifier from "./codex-subagent-classifier";
import { extractAssistantTextFromRecord, clampAssistantOutputText } from "./codex-assistant-output";

const POLL_INTERVAL_MS = 1500;
const MAX_TRACKED_FILES = 50;
const MAX_PARTIAL_BYTES = 64 * 1024;
const ACTIVE_SESSION_WINDOW_MS = 5 * 60 * 1000;
const BACKFILL_GRACE_MS = 5_000;
const OFFICIAL_HOOK_TTL_MS = 10 * 60 * 1000;
const APPROVAL_HEURISTIC_MS = 2000;
const BACKFILL_SNAPSHOT_EVENTS = new Set<CodexJsonlTransition["event"]>([
  "JsonlTaskStarted",
  "JsonlUserMessage",
  "JsonlGuardianAssessment",
  "JsonlExecCommandEnd",
  "JsonlPatchApplyEnd",
  "JsonlCustomToolCallOutput",
  "JsonlFunctionCall",
  "JsonlCustomToolCall",
  "JsonlWebSearchCall",
  "JsonlContextCompacted",
  "JsonlPermissionRequest",
]);
const OFFICIAL_HOOK_COVERED_EVENTS = new Set<CodexJsonlTransition["event"]>([
  "JsonlTaskStarted",
  "JsonlUserMessage",
  "JsonlGuardianAssessment",
  "JsonlExecCommandEnd",
  "JsonlPatchApplyEnd",
  "JsonlCustomToolCallOutput",
  "JsonlFunctionCall",
  "JsonlCustomToolCall",
  "JsonlTaskComplete",
  "JsonlTaskCompleteIdle",
]);
const WORKING_LIKE_STATES = new Set(["thinking", "working", "juggling"]);
const ROLLOUT_FILE_RE = /^rollout-.+-([0-9a-f-]{36})\.jsonl$/i;

interface TrackedFile {
  offset: number;
  partial: string;
  lastEventTime: number;
  backfilling: boolean;
  snapshot: CodexJsonlSnapshot;
  assistantLastOutput: string | null;
  assistantLastOutputTruncated: boolean;
  isSubagent: boolean;
}

function getCodexSessionsDir(): string {
  return join(homedir(), ".codex", "sessions");
}

function buildEvent(transition: CodexJsonlTransition, extra?: { assistantLastOutput?: string; assistantLastOutputTruncated?: boolean; headless?: boolean }): AgentStateEvent {
  const event: AgentStateEvent = {
    agentId: "codex",
    sessionId: transition.sessionId,
    event: transition.event,
    cwd: transition.cwd,
    occurredAt: Date.now(),
  };
  if (extra?.assistantLastOutput) {
    (event as any).assistantLastOutput = extra.assistantLastOutput;
    if (extra.assistantLastOutputTruncated) {
      (event as any).assistantLastOutputTruncated = true;
    }
  }
  if (extra?.headless) {
    (event as any).headless = true;
  }
  if (transition.permissionDetail) {
    (event as any).permissionDetail = transition.permissionDetail;
  }
  return event;
}

function createSnapshot(fileName: string): CodexJsonlSnapshot {
  const match = basename(fileName).match(ROLLOUT_FILE_RE);
  return {
    sessionId: match?.[1] ?? null,
    cwd: "",
    hadToolUse: false,
    lastTransitionEvent: null,
    pendingApprovalDetail: null,
  };
}

function collectRecentDayDirs(rootDir: string): string[] {
  const out: string[] = [];
  let years: string[] = [];
  try {
    years = readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return out;
  }

  for (const year of years) {
    const yearPath = join(rootDir, year);
    let months: string[] = [];
    try {
      months = readdirSync(yearPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a));
    } catch {
      continue;
    }
    for (const month of months) {
      const monthPath = join(yearPath, month);
      let days: string[] = [];
      try {
        days = readdirSync(monthPath, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
          .map((entry) => entry.name)
          .sort((a, b) => b.localeCompare(a));
      } catch {
        continue;
      }
      for (const day of days) {
        out.push(join(monthPath, day));
        if (out.length >= 7) return out;
      }
    }
  }
  return out;
}

function collectActiveDayDirs(rootDir: string): string[] {
  const now = Date.now();
  const out = new Set<string>();
  let years: string[] = [];
  try {
    years = readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  for (const year of years) {
    const yearPath = join(rootDir, year);
    let months: string[] = [];
    try {
      months = readdirSync(yearPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
        .map((entry) => entry.name);
    } catch {
      continue;
    }
    for (const month of months) {
      const monthPath = join(yearPath, month);
      let days: string[] = [];
      try {
        days = readdirSync(monthPath, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && /^\d{2}$/.test(entry.name))
          .map((entry) => entry.name);
      } catch {
        continue;
      }
      for (const day of days) {
        const dayDir = join(monthPath, day);
        let files: string[] = [];
        try {
          files = readdirSync(dayDir);
        } catch {
          continue;
        }
        for (const fileName of files) {
          if (!fileName.startsWith("rollout-") || !fileName.endsWith(".jsonl")) continue;
          try {
            if (now - statSync(join(dayDir, fileName)).mtimeMs < ACTIVE_SESSION_WINDOW_MS) {
              out.add(dayDir);
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
  }
  return Array.from(out);
}

export class CodexJsonlMonitor {
  private stateStore: StateStore;
  private isEnabled: () => boolean;
  private timer?: ReturnType<typeof setInterval>;
  private tracked = new Map<string, TrackedFile>();
  private officialHookSessions = new Map<string, number>();
  private startedAtMs = Date.now();
  private classifier = new CodexSubagentClassifier();

  constructor(stateStore: StateStore, isEnabled: () => boolean) {
    this.stateStore = stateStore;
    this.isEnabled = isEnabled;
  }

  markOfficialHookSession(sessionId: string): void {
    if (!sessionId) return;
    this.officialHookSessions.set(sessionId, Date.now());
  }

  start(): void {
    if (this.timer || !this.isEnabled()) return;
    this.startedAtMs = Date.now();
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.tracked.clear();
    this.officialHookSessions.clear();
  }

  private poll(): void {
    try {
      const rootDir = getCodexSessionsDir();
      const sessionDirs = collectActiveDayDirs(rootDir).length > 0
        ? collectActiveDayDirs(rootDir)
        : collectRecentDayDirs(rootDir);
      const activeFiles = new Set<string>();
      for (const dir of Array.from(sessionDirs)) {
        let files: string[] = [];
        try {
          files = readdirSync(dir);
        } catch {
          continue;
        }
        for (const fileName of files) {
          if (!fileName.startsWith("rollout-") || !fileName.endsWith(".jsonl")) continue;
          const filePath = join(dir, fileName);
          if (!this.tracked.has(filePath) && !this.shouldAttachFile(filePath)) continue;
          activeFiles.add(filePath);
          this.pollFile(filePath, fileName);
        }
      }
      this.pruneTracked(activeFiles);
      this.pruneOfficialHookSessions();
    } catch (error) {
      getLogger().warn("agent", "Codex JSONL monitor poll failed", error);
    }
  }

  private shouldAttachFile(filePath: string): boolean {
    try {
      return Date.now() - statSync(filePath).mtimeMs < ACTIVE_SESSION_WINDOW_MS;
    } catch {
      return false;
    }
  }

  private pollFile(filePath: string, fileName: string): void {
    const stat = statSync(filePath);
    let tracked = this.tracked.get(filePath);
    if (!tracked) {
      tracked = {
        offset: 0,
        partial: "",
        lastEventTime: Date.now(),
        backfilling: stat.size > 0 && stat.mtimeMs < this.startedAtMs - BACKFILL_GRACE_MS,
        snapshot: createSnapshot(fileName),
        assistantLastOutput: null,
        assistantLastOutputTruncated: false,
        isSubagent: false,
      };
      this.tracked.set(filePath, tracked);
    }

    if (stat.size < tracked.offset) {
      tracked.offset = 0;
      tracked.partial = "";
      tracked.snapshot = createSnapshot(fileName);
      tracked.backfilling = false;
    }
    if (stat.size <= tracked.offset) return;

    const readLength = stat.size - tracked.offset;
    const buffer = Buffer.alloc(readLength);
    const fd = openSync(filePath, "r");
    try {
      readSync(fd, buffer, 0, readLength, tracked.offset);
    } finally {
      closeSync(fd);
    }
    tracked.offset = stat.size;

    const text = tracked.partial + buffer.toString("utf8");
    const lines = text.split("\n");
    const remainder = lines.pop() || "";
    tracked.partial = remainder.length > MAX_PARTIAL_BYTES ? "" : remainder;

    for (const line of lines) {
      this.processLine(tracked, line);
    }

    if (tracked.backfilling) {
      this.emitBackfillSnapshot(tracked);
      tracked.backfilling = false;
    }
  }

  private processLine(tracked: TrackedFile, line: string): void {
    const text = line.trim();
    if (!text) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return;
    }

    const assistantText = extractAssistantTextFromRecord(parsed);
    if (assistantText) {
      const assistantOutput = clampAssistantOutputText(assistantText);
      if (assistantOutput) {
        tracked.assistantLastOutput = assistantOutput.text;
        tracked.assistantLastOutputTruncated = assistantOutput.truncated;
      }
    }

    if (parsed.type === "session_meta" && parsed.payload && typeof parsed.payload === "object") {
      const payload = parsed.payload as Record<string, unknown>;
      tracked.isSubagent = this.classifier.registerSession(tracked.snapshot.sessionId || "", { sessionMeta: payload }) === "subagent";
    }

    const transition = applyCodexJsonlEntry(tracked.snapshot, parsed);
    if (!transition) {
      if (parsed.type === "response_item" && parsed.payload && typeof parsed.payload === "object") {
        const payload = parsed.payload as Record<string, unknown>;
        if (payload.name === "shell_command" || payload.name === "exec_command") {
          setPendingApproval(tracked.snapshot, payload);
          const command = this.extractShellCommand(payload);
          if (command) {
            tracked.snapshot.pendingApprovalDetail = { command, rawPayload: payload };
            if (this.isExplicitApprovalRequest(payload)) {
              const permissionTransition = createPermissionTransition(tracked.snapshot, 0);
              if (permissionTransition && !tracked.backfilling) {
                tracked.lastEventTime = Date.now();
                if (!this.shouldSuppressTransition(permissionTransition)) {
                  this.stateStore.handleStateEvent(buildEvent(permissionTransition, {
                    assistantLastOutput: tracked.assistantLastOutput,
                    assistantLastOutputTruncated: tracked.assistantLastOutputTruncated,
                    headless: tracked.isSubagent,
                  }));
                }
              }
              clearPendingApproval(tracked.snapshot);
            } else if (!tracked.backfilling) {
              setTimeout(() => {
                const permissionTransition = createPermissionTransition(tracked.snapshot, 0);
                if (permissionTransition && !this.shouldSuppressTransition(permissionTransition)) {
                  this.stateStore.handleStateEvent(buildEvent(permissionTransition, {
                    assistantLastOutput: tracked.assistantLastOutput,
                    assistantLastOutputTruncated: tracked.assistantLastOutputTruncated,
                    headless: tracked.isSubagent,
                  }));
                }
              }, APPROVAL_HEURISTIC_MS);
            }
          }
        }
      }
      return;
    }

    tracked.lastEventTime = Date.now();
    if (tracked.backfilling) return;
    if (this.shouldSuppressTransition(transition)) return;

    this.stateStore.handleStateEvent(buildEvent(transition, {
      assistantLastOutput: tracked.assistantLastOutput,
      assistantLastOutputTruncated: tracked.assistantLastOutputTruncated,
      headless: tracked.isSubagent,
    }));
  }

  private extractShellCommand(payload: Record<string, unknown>): string {
    try {
      let args: unknown = payload.arguments;
      if (typeof args === "string") {
        args = JSON.parse(args);
      }
      if (args && typeof args === "object") {
        const obj = args as Record<string, unknown>;
        if (typeof obj.command === "string") return obj.command;
        if (typeof obj.cmd === "string") return obj.cmd;
      }
    } catch {}
    return "";
  }

  private isExplicitApprovalRequest(payload: Record<string, unknown>): boolean {
    try {
      let args: unknown = payload.arguments;
      if (typeof args === "string") {
        args = JSON.parse(args);
      }
      if (args && typeof args === "object") {
        const obj = args as Record<string, unknown>;
        if (obj.sandbox_permissions === "require_escalated") return true;
        if (typeof obj.justification === "string" && obj.justification.trim()) return true;
      }
    } catch {}
    return false;
  }

  private emitBackfillSnapshot(tracked: TrackedFile): void {
    const event = tracked.snapshot.lastTransitionEvent;
    if (!event || !BACKFILL_SNAPSHOT_EVENTS.has(event) || !tracked.snapshot.sessionId) return;
    const transition: CodexJsonlTransition = {
      sessionId: tracked.snapshot.sessionId,
      event,
      cwd: tracked.snapshot.cwd || undefined,
    };
    if (tracked.snapshot.pendingApprovalDetail && event === "JsonlPermissionRequest") {
      transition.permissionDetail = tracked.snapshot.pendingApprovalDetail;
    }
    if (this.shouldSuppressTransition(transition)) return;
    this.stateStore.handleStateEvent(buildEvent(transition, {
      assistantLastOutput: tracked.assistantLastOutput,
      assistantLastOutputTruncated: tracked.assistantLastOutputTruncated,
      headless: tracked.isSubagent,
    }));
  }

  private shouldSuppressTransition(transition: CodexJsonlTransition): boolean {
    if (!OFFICIAL_HOOK_COVERED_EVENTS.has(transition.event)) return false;
    if (!this.hasRecentOfficialHookSession(transition.sessionId)) return false;
    if (transition.event === "JsonlTaskComplete" || transition.event === "JsonlTaskCompleteIdle") {
      return !this.shouldAllowCompletionFallback(transition.sessionId);
    }
    return true;
  }

  private hasRecentOfficialHookSession(sessionId: string): boolean {
    const lastHookAt = this.officialHookSessions.get(sessionId);
    if (!lastHookAt) return false;
    if (Date.now() - lastHookAt > OFFICIAL_HOOK_TTL_MS) {
      this.officialHookSessions.delete(sessionId);
      return false;
    }
    return true;
  }

  private shouldAllowCompletionFallback(sessionId: string): boolean {
    const session = this.findSession(sessionId);
    if (!session || session.agentId !== "codex") return false;
    return WORKING_LIKE_STATES.has(session.state);
  }

  private findSession(sessionId: string): AgentSession | undefined {
    return this.stateStore.getSessions().find((session) => session.agentId === "codex" && session.id === sessionId);
  }

  private pruneTracked(activeFiles: Set<string>): void {
    for (const filePath of Array.from(this.tracked.keys())) {
      if (activeFiles.has(filePath)) continue;
      if (this.tracked.get(filePath)?.snapshot.pendingApprovalTimer) {
        clearTimeout(this.tracked.get(filePath)!.snapshot.pendingApprovalTimer!);
      }
      this.tracked.delete(filePath);
    }
    if (this.tracked.size <= MAX_TRACKED_FILES) return;
    const staleFiles = Array.from(this.tracked.entries())
      .sort((a, b) => a[1].lastEventTime - b[1].lastEventTime)
      .slice(0, this.tracked.size - MAX_TRACKED_FILES);
    for (const [filePath] of staleFiles) {
      if (this.tracked.get(filePath)?.snapshot.pendingApprovalTimer) {
        clearTimeout(this.tracked.get(filePath)!.snapshot.pendingApprovalTimer!);
      }
      this.tracked.delete(filePath);
    }
  }

  private pruneOfficialHookSessions(): void {
    const now = Date.now();
    for (const [sessionId, lastHookAt] of Array.from(this.officialHookSessions.entries())) {
      if (now - lastHookAt > OFFICIAL_HOOK_TTL_MS) {
        this.officialHookSessions.delete(sessionId);
      }
    }
  }
}