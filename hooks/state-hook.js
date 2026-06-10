#!/usr/bin/env node
// Unified hook — reads event from stdin, routes to /state or /permission based on event type.

const http = require("http");
const path = require("path");
const fs = require("fs");

const HOME = process.env.HOME || process.env.USERPROFILE;
const RUNTIME_PATH = path.join(HOME, ".ai-status-beacon", "runtime.json");
const DEBUG_LOG = path.join(HOME, ".ai-status-beacon", "hook-debug.log");
const STDIN_TIMEOUT_MS = 3000;
const STATE_HOOK_TIMEOUT_MS = 2000;
const PERMISSION_HOOK_TIMEOUT_MS = 300000;
const STATE_HOOK_PATH = "/state";
const PERMISSION_HOOK_PATH = "/permission";
const PERMISSION_EVENT = "PermissionRequest";

function debugLog(message) {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(DEBUG_LOG, line, { encoding: "utf-8" });
  } catch {}
}

function discoverPort() {
  try {
    const data = JSON.parse(fs.readFileSync(RUNTIME_PATH, "utf-8"));
    return data.port || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = { event: null };
  let index = 2;
  if (argv[index] && !argv[index].startsWith("--")) {
    args.event = argv[index];
    index++;
  }
  for (let i = index; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

function readStdinWithTimeout() {
  return new Promise((resolve) => {
    let input = "";
    const timer = setTimeout(() => {
      process.stdin.destroy();
      resolve(input);
    }, STDIN_TIMEOUT_MS);
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => { clearTimeout(timer); resolve(input); });
    process.stdin.on("error", () => { clearTimeout(timer); resolve(input); });
  });
}

function parsePayload(input) {
  try {
    return JSON.parse(input);
  } catch {
    return { event: "unknown", rawInput: input };
  }
}

function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `session-${ts}-${rand}`;
}

function isPermissionEvent(payload, args) {
  if (payload.event === PERMISSION_EVENT) return true;
  if (payload.hook_event_name === PERMISSION_EVENT) return true;
  if (args.event === PERMISSION_EVENT) return true;
  return false;
}

function enrichPayload(payload, args) {
  if (!payload.event && args.event) {
    payload.event = args.event;
  }
  if (!payload.agentId) {
    payload.agentId = payload.agent_id || args["agent-id"] || process.env.BEACON_AGENT_ID || "unknown";
  }
  if (!payload.sessionId && !payload.session_id) {
    payload.sessionId = generateSessionId();
  }
  if (!payload.occurredAt) {
    payload.occurredAt = Date.now();
  }
  if (!payload.createdAt) {
    payload.createdAt = Date.now();
  }
  return payload;
}

async function main() {
  debugLog(`invoked: ${process.argv.join(" ")}`);

  const port = discoverPort();
  if (!port) {
    debugLog("exit: no port discovered");
    process.exit(0);
  }

  const args = parseArgs(process.argv);
  const input = await readStdinWithTimeout();

  debugLog(`stdin: ${input.length > 0 ? input.slice(0, 200) : "(empty)"}`);

  if (!input.trim() && !args.event) {
    debugLog("exit: no input and no event arg");
    process.exit(0);
  }

  const payload = enrichPayload(input.trim() ? parsePayload(input) : {}, args);
  const isPermission = isPermissionEvent(payload, args);
  const hookPath = isPermission ? PERMISSION_HOOK_PATH : STATE_HOOK_PATH;
  const timeout = isPermission ? PERMISSION_HOOK_TIMEOUT_MS : STATE_HOOK_TIMEOUT_MS;

  const body = JSON.stringify(payload);
  debugLog(`posting to port ${port}${hookPath}: ${body.slice(0, 300)}`);

  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: hookPath,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout,
    },
    (res) => {
      let respBody = "";
      res.on("data", (chunk) => { respBody += chunk; });
      res.on("end", () => {
        debugLog(`response: ${res.statusCode} ${respBody.slice(0, 200)}`);
        if (isPermission) {
          process.stdout.write(respBody);
        }
        process.exit(0);
      });
    }
  );

  req.on("error", (err) => {
    debugLog(`request error: ${err.message}`);
    if (isPermission) {
      process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    }
    process.exit(0);
  });
  req.on("timeout", () => {
    debugLog("request timeout");
    req.destroy();
    if (isPermission) {
      process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    }
    process.exit(0);
  });
  req.write(body);
  req.end();
}

main().catch((err) => {
  debugLog(`fatal: ${err.message}`);
  process.stdout.write(JSON.stringify({ decision: "no-decision" }));
  process.exit(0);
});
