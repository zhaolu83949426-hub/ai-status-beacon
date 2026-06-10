const http = require("http");
const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || process.env.USERPROFILE;
const RUNTIME_PATH = path.join(HOME, ".ai-status-beacon", "runtime.json");
const PERMISSION_EVENTS = new Set(["PermissionRequest", "permissionRequest"]);
const STATE_TIMEOUT_MS = 2000;
const PERMISSION_TIMEOUT_MS = 300000;

function runHook(agentId, options = {}) {
  main(agentId, options).catch(() => {
    if (options.permissionOutput) process.stdout.write(options.permissionOutput);
    process.exit(0);
  });
}

async function main(agentId, options) {
  const port = discoverPort();
  const input = await readStdin();
  const payload = enrichPayload(parsePayload(input), agentId, readEvent(options));
  const isPermission = PERMISSION_EVENTS.has(payload.event) || PERMISSION_EVENTS.has(payload.hook_event_name);
  if (!port) return exitWithoutServer(isPermission, options);
  await postPayload(port, isPermission ? "/permission" : "/state", payload, isPermission);
}

function discoverPort() {
  try {
    const data = JSON.parse(fs.readFileSync(RUNTIME_PATH, "utf-8"));
    return Number.isInteger(data.port) ? data.port : null;
  } catch {
    return null;
  }
}

function readEvent(options) {
  if (options.codexOfficial) return null;
  return process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
}

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", () => resolve(input));
  });
}

function parsePayload(input) {
  if (!String(input || "").trim()) return {};
  try {
    return JSON.parse(input);
  } catch {
    return { rawInput: input };
  }
}

function enrichPayload(payload, agentId, eventArg) {
  const next = payload && typeof payload === "object" ? payload : {};
  next.agent_id = next.agent_id || next.agentId || agentId;
  next.agentId = next.agentId || next.agent_id;
  next.event = next.event || next.hook_event_name || eventArg || "unknown";
  next.session_id = next.session_id || next.sessionId || next.conversation_id || "default";
  next.sessionId = next.sessionId || next.session_id;
  next.createdAt = next.createdAt || Date.now();
  next.occurredAt = next.occurredAt || Date.now();
  return next;
}

function exitWithoutServer(isPermission, options) {
  if (isPermission) process.stdout.write(options.permissionOutput || JSON.stringify({ decision: "no-decision" }));
  else if (options.stateOutput) process.stdout.write(options.stateOutput);
  process.exit(0);
}

function postPayload(port, route, payload, isPermission) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: route,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: isPermission ? PERMISSION_TIMEOUT_MS : STATE_TIMEOUT_MS,
    }, (res) => {
      let output = "";
      res.on("data", (chunk) => { output += chunk; });
      res.on("end", () => {
        if (isPermission) process.stdout.write(output);
        resolve();
        process.exit(0);
      });
    });
    req.on("error", () => {
      if (isPermission) process.stdout.write(JSON.stringify({ decision: "no-decision" }));
      resolve();
      process.exit(0);
    });
    req.on("timeout", () => {
      req.destroy();
      if (isPermission) process.stdout.write(JSON.stringify({ decision: "no-decision" }));
      resolve();
      process.exit(0);
    });
    req.write(body);
    req.end();
  });
}

module.exports = { runHook };
