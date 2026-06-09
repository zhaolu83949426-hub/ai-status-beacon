#!/usr/bin/env node
// State hook — reads event from stdin and POSTs to the beacon server.

const http = require("http");
const path = require("path");
const fs = require("fs");

const HOME = process.env.HOME || process.env.USERPROFILE;
const RUNTIME_PATH = path.join(HOME, ".ai-status-beacon", "runtime.json");

function discoverPort() {
  try {
    const data = JSON.parse(fs.readFileSync(RUNTIME_PATH, "utf-8"));
    return data.port || null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, "");
    args[key] = argv[i + 1];
  }
  return args;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

function parsePayload(input) {
  try {
    return JSON.parse(input);
  } catch {
    return { event: "unknown", rawInput: input };
  }
}

function enrichPayload(payload, args) {
  if (!payload.agentId) {
    payload.agentId = payload.agent_id || args["agent-id"] || process.env.BEACON_AGENT_ID || "unknown";
  }
  if (!payload.occurredAt) {
    payload.occurredAt = Date.now();
  }
  return payload;
}

async function main() {
  const port = discoverPort();
  if (!port) {
    process.exit(0);
  }

  const args = parseArgs(process.argv);
  const input = args.event ? JSON.stringify(args) : await readStdin();

  if (!input.trim()) {
    process.exit(0);
  }

  const payload = enrichPayload(parsePayload(input), args);

  const body = JSON.stringify(payload);

  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/state",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 2000,
    },
    (res) => {
      res.resume();
      res.on("end", () => process.exit(0));
    }
  );

  req.on("error", () => process.exit(0));
  req.on("timeout", () => { req.destroy(); process.exit(0); });
  req.write(body);
  req.end();
}

main().catch(() => process.exit(0));
