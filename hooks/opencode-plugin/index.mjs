import { readFileSync } from "fs";

const AGENT_ID = "opencode";
const RUNTIME_PATH = `${process.env.HOME || process.env.USERPROFILE}/.ai-status-beacon/runtime.json`;

function readPort() {
  try {
    return JSON.parse(readFileSync(RUNTIME_PATH, "utf8")).port;
  } catch {
    return null;
  }
}

async function postState(body) {
  const port = readPort();
  if (!port) return;
  await fetch(`http://127.0.0.1:${port}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: AGENT_ID, ...body }),
  }).catch(() => {});
}

export default async function plugin() {
  return {
    event: async ({ event }) => {
      if (!event || !event.type) return;
      await postState({ event: event.type, session_id: event.properties?.sessionID || "default" });
    },
  };
}
