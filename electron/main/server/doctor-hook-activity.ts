import { readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";

const DEFAULT_CONNECTION_TEST_DURATION_MS = 10000;
const MAX_CONNECTION_TEST_DURATION_MS = 30000;

function clampDurationMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONNECTION_TEST_DURATION_MS;
  return Math.max(1000, Math.min(MAX_CONNECTION_TEST_DURATION_MS, Math.floor(value)));
}

function findRecentMatchingFiles(options: {
  rootDir: string;
  since?: number;
  maxDepth?: number;
  maxEntries?: number;
  predicate?: (name: string) => boolean;
}): Array<{ path: string; mtimeMs: number }> {
  const { rootDir, since = 0, maxDepth = 4, maxEntries = 1000, predicate } = options;
  if (!rootDir) return [];

  const out: Array<{ path: string; mtimeMs: number }> = [];
  const stack = [{ dir: rootDir, depth: 0 }];
  let visited = 0;
  while (stack.length && visited < maxEntries) {
    const current = stack.pop()!;
    let entries: Array<{ name: string; isDir: boolean; isFile: boolean }>;
    try {
      entries = readdirSync(current.dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        isDir: e.isDirectory(),
        isFile: e.isFile(),
      }));
    } catch { continue; }
    for (const entry of entries) {
      if (visited >= maxEntries) break;
      visited++;
      if (!entry.name) continue;
      const fullPath = join(current.dir, entry.name);
      if (entry.isDir) {
        if (current.depth < maxDepth) stack.push({ dir: fullPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile) continue;
      if (predicate && !predicate(entry.name)) continue;
      try {
        const stat = statSync(fullPath);
        if (Number.isFinite(stat.mtimeMs) && stat.mtimeMs >= since) {
          out.push({ path: fullPath, mtimeMs: stat.mtimeMs });
        }
      } catch {}
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function scanCodexMtimeActivity(options: { since: number }): Array<{ agentId: string; count: number; latestMtime: number }> {
  const rootDir = join(homedir(), ".codex", "sessions");
  const files = findRecentMatchingFiles({
    rootDir,
    since: options.since,
    maxDepth: 4,
    maxEntries: 1500,
    predicate: (name) => name.startsWith("rollout-") && name.endsWith(".jsonl"),
  });
  if (!files.length) return [];
  return [{
    agentId: "codex",
    count: files.length,
    latestMtime: Math.max(...files.map((f) => f.mtimeMs)),
  }];
}

interface ConnectionTestResult {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: string;
  level: string | null;
  detail: string;
}

function evaluateConnectionTest(input: {
  events: Array<{ agentId: string; outcome: string }>;
  fileActivity: Array<{ agentId: string }>;
}): Omit<ConnectionTestResult, "id" | "startedAt" | "endedAt" | "durationMs"> {
  const { events = [], fileActivity = [] } = input;
  const accepted = events.filter((e) => e.outcome === "accepted");
  const dropped = events.filter((e) => typeof e.outcome === "string" && e.outcome.startsWith("dropped-"));

  if (accepted.length) {
    const agents = [...new Set(accepted.map((e) => e.agentId).filter(Boolean))].sort();
    return {
      status: "http-verified",
      level: null,
      detail: `HTTP path verified (${accepted.length} accepted event${accepted.length === 1 ? "" : "s"}${agents.length ? `: ${agents.join(", ")}` : ""}).`,
    };
  }

  if (dropped.length) {
    const outcomes = [...new Set(dropped.map((e) => e.outcome).filter(Boolean))].sort();
    return {
      status: "http-dropped",
      level: "warning",
      detail: `HTTP works but events were dropped (${outcomes.join(", ")}).`,
    };
  }

  if (fileActivity.length) {
    const agents = [...new Set(fileActivity.map((e) => e.agentId).filter(Boolean))].sort();
    return {
      status: "http-blocked",
      level: "warning",
      detail: `File activity changed for ${agents.join(", ")}, but no HTTP hook event reached the server.`,
    };
  }

  return {
    status: "no-activity",
    level: "warning",
    detail: "No hook HTTP event or fallback log file activity was detected.",
  };
}

async function runConnectionTest(options: {
  durationMs?: number;
  getRecentHookEvents?: (opts: { since: number }) => Array<{ agentId: string; outcome: string }>;
}): Promise<ConnectionTestResult> {
  const durationMs = clampDurationMs(options.durationMs ?? DEFAULT_CONNECTION_TEST_DURATION_MS);
  const startedAt = Date.now();
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  const endedAt = Date.now();
  const events = options.getRecentHookEvents ? options.getRecentHookEvents({ since: startedAt }) : [];
  const fileActivity = scanCodexMtimeActivity({ since: startedAt });
  const evaluated = evaluateConnectionTest({ events, fileActivity });
  return {
    id: "hook-event-waterline",
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs,
    ...evaluated,
  };
}

export {
  DEFAULT_CONNECTION_TEST_DURATION_MS,
  evaluateConnectionTest,
  findRecentMatchingFiles,
  runConnectionTest,
  scanCodexMtimeActivity,
};
export type { ConnectionTestResult };