#!/usr/bin/env node
// Permission hook — sends approval request to beacon server and waits for user decision.

const http = require("http");
const fs = require("fs");
const path = require("path");

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

async function main() {
  const port = discoverPort();
  if (!port) {
    // No server running — return no-decision so agent uses native approval
    process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    process.exit(0);
  }

  // Read stdin
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    process.exit(0);
  }

  const args = parseArgs(process.argv);
  if (!payload.agentId) {
    payload.agentId = payload.agent_id || args["agent-id"] || process.env.BEACON_AGENT_ID || "unknown";
  }
  if (!payload.createdAt) {
    payload.createdAt = Date.now();
  }

  const body = JSON.stringify(payload);

  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/permission",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 300000, // 5 minute timeout — user may take time to decide
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        process.stdout.write(data);
        process.exit(0);
      });
    }
  );

  req.on("error", () => {
    process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    process.exit(0);
  });
  req.on("timeout", () => {
    req.destroy();
    process.stdout.write(JSON.stringify({ decision: "no-decision" }));
    process.exit(0);
  });
  req.write(body);
  req.end();
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ decision: "no-decision" }));
  process.exit(0);
});
