import { describe, expect, it } from "vitest";
import { applyCodexJsonlEntry, type CodexJsonlSnapshot } from "../electron/main/agents/codex-jsonl-parser";

function createSnapshot(): CodexJsonlSnapshot {
  return {
    sessionId: null,
    cwd: "",
    hadToolUse: false,
    lastTransitionEvent: null,
  };
}

describe("Codex JSONL parser", () => {
  it("resolves turn_aborted to idle immediately", () => {
    const snapshot = createSnapshot();

    applyCodexJsonlEntry(snapshot, {
      type: "session_meta",
      payload: { id: "session-1", cwd: "D:/work" },
    });

    const transition = applyCodexJsonlEntry(snapshot, {
      type: "event_msg",
      payload: { type: "turn_aborted" },
    });

    expect(transition).toEqual({
      sessionId: "session-1",
      event: "JsonlTurnAborted",
      cwd: "D:/work",
    });
  });

  it("marks task_complete as completion when the turn used tools", () => {
    const snapshot = createSnapshot();

    applyCodexJsonlEntry(snapshot, {
      type: "session_meta",
      payload: { id: "session-2" },
    });
    applyCodexJsonlEntry(snapshot, {
      type: "response_item",
      payload: { type: "function_call" },
    });

    const transition = applyCodexJsonlEntry(snapshot, {
      type: "event_msg",
      payload: { type: "task_complete" },
    });

    expect(transition?.event).toBe("JsonlTaskComplete");
  });

  it("marks task_complete as idle when the turn ended without tools", () => {
    const snapshot = createSnapshot();

    applyCodexJsonlEntry(snapshot, {
      type: "session_meta",
      payload: { id: "session-3" },
    });
    applyCodexJsonlEntry(snapshot, {
      type: "event_msg",
      payload: { type: "task_started" },
    });

    const transition = applyCodexJsonlEntry(snapshot, {
      type: "event_msg",
      payload: { type: "task_complete" },
    });

    expect(transition?.event).toBe("JsonlTaskCompleteIdle");
  });
});
