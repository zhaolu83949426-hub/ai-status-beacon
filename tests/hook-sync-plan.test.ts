import { describe, expect, it } from "vitest";
import { claudeCodeDescriptor } from "../agents/claude-code";
import { codexDescriptor } from "../agents/codex";
import { copilotCliDescriptor } from "../agents/copilot-cli";
import { geminiCliDescriptor } from "../agents/gemini-cli";
import { antigravityCliDescriptor } from "../agents/antigravity-cli";
import { applyHookPlan, buildHookPlan, inspectHookStatus } from "../electron/main/hooks/hook-sync-plan";
import type { AgentDescriptor } from "../shared/agent-types";

describe("Hook Sync Plan", () => {
  function createPlan(agent: AgentDescriptor, overrides?: { stateEnabled?: boolean; permissionEnabled?: boolean }) {
    return buildHookPlan({
      agent,
      settings: {
        stateEnabled: overrides?.stateEnabled ?? true,
        permissionEnabled: overrides?.permissionEnabled ?? true,
      },
      nodeBin: "node",
      hooksDir: "C:/beacon/hooks",
      port: 23337,
      platform: "win32",
    });
  }

  it("registers Claude command hooks and PermissionRequest HTTP hook", () => {
    const config: Record<string, unknown> = { hooks: {} };
    const plan = createPlan(claudeCodeDescriptor);

    applyHookPlan(config, plan);

    const hooks = config.hooks as Record<string, any>;
    expect(hooks.SessionStart[0].hooks[0].command).toContain("clawd-hook.js");
    expect(hooks.PermissionRequest[0].hooks[0]).toEqual({
      type: "http",
      url: "http://127.0.0.1:23337/permission",
      timeout: 600,
    });
    expect(inspectHookStatus(config, plan)).toBe("synced");
  });

  it("removes legacy generic beacon hooks while preserving third-party hooks", () => {
    const config: Record<string, unknown> = {
      hooks: {
        PreToolUse: [{
          matcher: "",
          hooks: [
            { type: "command", command: 'node "C:/third-party.js" PreToolUse' },
            { type: "command", command: '& "node" "C:/old/state-hook.js" PreToolUse' },
          ],
        }],
      },
    };

    applyHookPlan(config, createPlan(claudeCodeDescriptor));

    const entries = (config.hooks as Record<string, any>).PreToolUse;
    const commands = entries.flatMap((entry: any) => entry.hooks.map((hook: any) => hook.command).filter(Boolean));
    expect(commands).toContain('node "C:/third-party.js" PreToolUse');
    expect(commands.some((command: string) => command.includes("state-hook.js"))).toBe(false);
  });

  it("registers only reference Codex official hook events", () => {
    const config: Record<string, unknown> = { hooks: {} };
    const plan = createPlan(codexDescriptor);

    applyHookPlan(config, plan);

    const hooks = config.hooks as Record<string, unknown>;
    expect(Object.keys(hooks).sort()).toEqual([
      "PermissionRequest",
      "PostToolUse",
      "PreToolUse",
      "SessionStart",
      "Stop",
      "UserPromptSubmit",
    ]);
    expect(JSON.stringify(hooks)).toContain("codex-hook.js");
    expect(JSON.stringify(hooks)).not.toContain("state-hook.js");
  });

  it("uses Copilot user-global hooks shape", () => {
    const config: Record<string, unknown> = { hooks: {} };
    applyHookPlan(config, createPlan(copilotCliDescriptor));

    const hook = (config.hooks as Record<string, any>).permissionRequest[0];
    expect(hook.type).toBe("command");
    expect(hook.bash).toContain("copilot-hook.js");
    expect(hook.powershell).toContain("copilot-hook.js");
    expect(hook.timeoutSec).toBe(600);
  });

  it("uses Gemini nested named command hooks", () => {
    const config: Record<string, unknown> = { hooks: {} };
    applyHookPlan(config, createPlan(geminiCliDescriptor));

    const hook = (config.hooks as Record<string, any>).BeforeAgent[0];
    expect(hook.matcher).toBe("*");
    expect(hook.hooks[0].name).toBe("clawd");
    expect(hook.hooks[0].command).toContain("gemini-hook.js");
  });

  it("uses Antigravity clawd root group", () => {
    const config: Record<string, unknown> = {};
    const plan = createPlan(antigravityCliDescriptor);

    applyHookPlan(config, plan);

    expect(config.clawd).toBeDefined();
    expect(JSON.stringify(config.clawd)).toContain("antigravity-hook.js");
    expect(inspectHookStatus(config, plan)).toBe("synced");
  });
});
