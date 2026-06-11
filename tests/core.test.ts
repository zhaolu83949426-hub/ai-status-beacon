import { describe, it, expect } from "vitest";
import { mapEventToBeaconState, registerAgentEventMap } from "../electron/main/state/state-mapper";
import { buildHookPlan } from "../electron/main/hooks/hook-sync-plan";
import type { AgentDescriptor } from "../shared/agent-types";

// We test the pure logic functions without Electron dependencies.
// Import the source directly — vitest handles TS.

// ── State Aggregation ──

describe("State Aggregation", () => {
  // Recreate the priority logic inline since StateStore depends on Electron
  const STATE_PRIORITY: Record<string, number> = {
    idle: 0,
    sleeping: 0,
    "codex-turn-end": 0,
    thinking: 1,
    working: 1,
    attention: 1,
    notification: 2,
    juggling: 1,
    sweeping: 1,
    carrying: 1,
    error: 2,
    approval: 3,
  };

  function aggregate(states: string[]): string {
    let highest = "idle";
    for (const s of states) {
      if (STATE_PRIORITY[s] > STATE_PRIORITY[highest]) highest = s;
    }
    return highest;
  }

  it("returns idle when no sessions", () => {
    expect(aggregate([])).toBe("idle");
  });

  it("returns working when only working sessions", () => {
    expect(aggregate(["working"])).toBe("working");
    expect(aggregate(["working", "working"])).toBe("working");
  });

  it("approval has highest priority", () => {
    expect(aggregate(["working", "approval", "idle"])).toBe("approval");
    expect(aggregate(["error", "approval"])).toBe("approval");
  });

  it("error beats working and idle", () => {
    expect(aggregate(["idle", "working", "error"])).toBe("error");
    expect(aggregate(["working", "error"])).toBe("error");
  });

  it("working beats idle", () => {
    expect(aggregate(["idle", "working"])).toBe("working");
  });

  it("idle is lowest priority", () => {
    expect(aggregate(["idle", "idle"])).toBe("idle");
  });
});

// ── Event Mapping ──

describe("Event Mapping", () => {
  it("uses registered agent event maps", () => {
    registerAgentEventMap("spec-agent", { UserPromptSubmit: "thinking", Stop: "attention" });
    expect(mapEventToBeaconState("spec-agent", "UserPromptSubmit")).toBe("thinking");
    expect(mapEventToBeaconState("spec-agent", "Stop")).toBe("attention");
  });

  it("uses normalized names only inside registered maps", () => {
    registerAgentEventMap("normalized-agent", { ToolCallEnd: "idle" });
    expect(mapEventToBeaconState("normalized-agent", "tool_call_end")).toBe("idle");
  });

  it("does not infer unregistered events", () => {
    expect(mapEventToBeaconState("test", "approval_pending")).toBe("idle");
    expect(mapEventToBeaconState("test", "RunAgentLoop")).toBe("idle");
  });
});

describe("Hook Plan", () => {
  const agent: AgentDescriptor = {
    id: "test-agent",
    name: "Test Agent",
    integrationKind: "claude-settings",
    processNames: { win: [], mac: [] },
    configPaths: [],
    capabilities: { state: true, permission: true },
    eventSource: "hook",
    hookConfig: {
      configFormat: "claude-code-compatible",
      scriptName: "test-hook.js",
      events: ["SessionStart"],
      permissionEvents: ["PermissionRequest"],
    },
    defaultStateEnabled: true,
    defaultPermissionEnabled: true,
    eventMap: {},
    mapEvent: () => ({ agentId: "test-agent", sessionId: "s", event: "SessionStart", occurredAt: Date.now() }),
    mapPermission: () => ({}),
  };

  it("creates permission hook when only permission is enabled", () => {
    const plan = buildHookPlan({
      agent,
      settings: { stateEnabled: false, permissionEnabled: true },
      nodeBin: "node",
      hooksDir: "C:/hooks",
      port: 23333,
      platform: "win32",
    });

    expect(plan.entries.PermissionRequest[0].hooks).toEqual([
      { type: "http", url: "http://127.0.0.1:23333/permission?agentId=test-agent", timeout: 600 },
    ]);
    expect(plan.entries.SessionStart).toBeUndefined();
  });

  it("does not create permission hook when permission is disabled", () => {
    const plan = buildHookPlan({
      agent,
      settings: { stateEnabled: true, permissionEnabled: false },
      nodeBin: "node",
      hooksDir: "C:/hooks",
      port: 23333,
      platform: "win32",
    });

    expect(plan.entries.PermissionRequest).toBeUndefined();
  });
});

// ── Quota Tier Sorting ──

describe("Quota Tier Sorting", () => {
  const TIER_PRIORITY = ["five_hour", "weekly_limit", "seven_day", "premium"];

  function sortAndLimit(tiers: { name: string }[], max = 2) {
    return [...tiers]
      .sort((a, b) => {
        const ai = TIER_PRIORITY.indexOf(a.name);
        const bi = TIER_PRIORITY.indexOf(b.name);
        return (ai === -1 ? TIER_PRIORITY.length : ai) - (bi === -1 ? TIER_PRIORITY.length : bi);
      })
      .slice(0, max);
  }

  it("sorts five_hour before seven_day", () => {
    const result = sortAndLimit([{ name: "seven_day" }, { name: "five_hour" }]);
    expect(result[0].name).toBe("five_hour");
    expect(result[1].name).toBe("seven_day");
  });

  it("limits to max 2 tiers", () => {
    const result = sortAndLimit([
      { name: "premium" },
      { name: "weekly_limit" },
      { name: "five_hour" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("five_hour");
    expect(result[1].name).toBe("weekly_limit");
  });

  it("handles unknown tiers by putting them last", () => {
    const result = sortAndLimit([{ name: "custom_tier" }, { name: "five_hour" }]);
    expect(result[0].name).toBe("five_hour");
    expect(result[1].name).toBe("custom_tier");
  });

  it("returns empty for empty input", () => {
    expect(sortAndLimit([])).toEqual([]);
  });

  it("returns single tier when only one provided", () => {
    const result = sortAndLimit([{ name: "weekly_limit" }]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("weekly_limit");
  });
});

// ── Position Calculation ──

describe("Position Calculation", () => {
  interface Bounds { x: number; y: number; width: number; height: number; }

  function computeBounds(
    edge: string,
    offsetRatio: number,
    workArea: { x: number; y: number; width: number; height: number },
  ): Bounds {
    const capsuleW = 280;
    const capsuleH = 48;

    if (edge === "top" || edge === "bottom") {
      const x = Math.round(workArea.x + (workArea.width - capsuleW) * offsetRatio);
      const y = edge === "top" ? workArea.y : workArea.y + workArea.height - capsuleH;
      return { x, y, width: capsuleW, height: capsuleH };
    } else {
      const x = edge === "left" ? workArea.x : workArea.x + workArea.width - capsuleH;
      const y = Math.round(workArea.y + (workArea.height - capsuleW) * offsetRatio);
      return { x, y, width: capsuleH, height: capsuleW };
    }
  }

  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

  it("positions at top center", () => {
    const b = computeBounds("top", 0.5, workArea);
    expect(b.x).toBe(820); // (1920 - 280) * 0.5
    expect(b.y).toBe(0);
    expect(b.width).toBe(280);
    expect(b.height).toBe(48);
  });

  it("positions at bottom center", () => {
    const b = computeBounds("bottom", 0.5, workArea);
    expect(b.x).toBe(820);
    expect(b.y).toBe(1032); // 1080 - 48
  });

  it("positions at left center", () => {
    const b = computeBounds("left", 0.5, workArea);
    expect(b.x).toBe(0);
    expect(b.y).toBe(400); // (1080 - 280) * 0.5
    expect(b.width).toBe(48);
    expect(b.height).toBe(280);
  });

  it("positions at right center", () => {
    const b = computeBounds("right", 0.5, workArea);
    expect(b.x).toBe(1872); // 1920 - 48
  });

  it("respects offset ratio", () => {
    const b = computeBounds("top", 0.0, workArea);
    expect(b.x).toBe(0);
    const b2 = computeBounds("top", 1.0, workArea);
    expect(b2.x).toBe(1640); // 1920 - 280
  });

  it("handles non-zero workArea origin", () => {
    const wa = { x: 100, y: 50, width: 1600, height: 900 };
    const b = computeBounds("top", 0.5, wa);
    expect(b.x).toBe(760); // 100 + (1600 - 280) * 0.5
    expect(b.y).toBe(50);
  });
});

// ── Settings Validation ──

describe("Settings Validation", () => {
  const RULES = {
    accountDisplayName: { required: true, maxLength: 40 },
    baseUrl: { required: false, maxLength: 2048 },
    apiKey: { required: false, maxLength: 4096 },
    soundPath: { required: false, maxLength: 260 },
  };

  function validate(field: keyof typeof RULES, value: string | null | undefined, ctx?: { isTokenPlan?: boolean }): string | null {
    const rule = RULES[field];
    const str = value ?? "";

    const isRequired = rule.required ||
      (field === "baseUrl" && ctx?.isTokenPlan) ||
      (field === "apiKey" && ctx?.isTokenPlan);

    if (isRequired && !str.trim()) return `${field} is required`;
    if (str.length > rule.maxLength) return `${field} must be at most ${rule.maxLength} characters`;
    return null;
  }

  it("rejects empty required field", () => {
    expect(validate("accountDisplayName", "")).toBeTruthy();
    expect(validate("accountDisplayName", null)).toBeTruthy();
  });

  it("accepts valid display name", () => {
    expect(validate("accountDisplayName", "My Account")).toBeNull();
  });

  it("rejects display name over 40 chars", () => {
    expect(validate("accountDisplayName", "a".repeat(41))).toBeTruthy();
  });

  it("accepts display name at exactly 40 chars", () => {
    expect(validate("accountDisplayName", "a".repeat(40))).toBeNull();
  });

  it("baseUrl not required by default", () => {
    expect(validate("baseUrl", "")).toBeNull();
  });

  it("baseUrl required for token plan", () => {
    expect(validate("baseUrl", "", { isTokenPlan: true })).toBeTruthy();
  });

  it("apiKey required for token plan", () => {
    expect(validate("apiKey", "", { isTokenPlan: true })).toBeTruthy();
  });

  it("soundPath not required", () => {
    expect(validate("soundPath", "")).toBeNull();
  });
});
