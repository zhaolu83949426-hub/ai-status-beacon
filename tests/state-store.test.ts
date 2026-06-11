import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: () => "D:/open-sprout/ai-status-beacon/.tmp-test",
  },
}));

import { StateStore } from "../electron/main/state/state-store";
import { registerAgentEventMap } from "../electron/main/state/state-mapper";
import { claudeCodeDescriptor } from "../agents/claude-code";

function createStore() {
  registerAgentEventMap("claude-code", claudeCodeDescriptor.eventMap);
  return new StateStore({
    get: () => ({
      statusBar: {
        lightMode: "single",
        placement: { edge: "top", displayId: "display-1", offsetRatio: 0.5 },
      },
    }),
  } as any);
}

describe("StateStore stale cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears stale thinking sessions quickly when no follow-up event arrives", () => {
    vi.useFakeTimers();
    const store = createStore();

    store.handleStateEvent({
      agentId: "claude-code",
      sessionId: "session-1",
      event: "UserPromptSubmit",
      occurredAt: Date.now(),
    });

    expect(store.getAggregatedState()).toBe("thinking");

    vi.advanceTimersByTime(50_000);

    expect(store.getAggregatedState()).toBe("idle");
    store.destroy();
  });

  it("keeps working sessions until the longer active timeout is reached", () => {
    vi.useFakeTimers();
    const store = createStore();

    store.handleStateEvent({
      agentId: "claude-code",
      sessionId: "session-2",
      event: "PreToolUse",
      occurredAt: Date.now(),
    });

    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(store.getAggregatedState()).toBe("working");

    vi.advanceTimersByTime(70_000);
    expect(store.getAggregatedState()).toBe("idle");
    store.destroy();
  });

  it("drops stale thinking sessions before aggregating a newer event", () => {
    vi.useFakeTimers();
    const store = createStore();

    store.handleStateEvent({
      agentId: "claude-code",
      sessionId: "stale-session",
      event: "UserPromptSubmit",
      occurredAt: Date.now(),
    });

    vi.advanceTimersByTime(46_000);

    store.handleStateEvent({
      agentId: "codex",
      sessionId: "codex-session",
      event: "Stop",
      occurredAt: Date.now(),
    });

    expect(store.getAggregatedState()).toBe("idle");
    store.destroy();
  });
});
