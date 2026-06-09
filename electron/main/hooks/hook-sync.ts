import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { app } from "electron";
import type { HookSyncResult } from "../../../shared/types";
import type { AgentDescriptor } from "../../../shared/agent-types";
import { getAgent } from "../agents/registry";

const BEACON_MARKER = "ai-status-beacon";

export class HookSyncService {
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  syncAgent(agentId: string): HookSyncResult {
    const agent = getAgent(agentId);
    if (!agent) {
      return { agentId, installed: false, hookStatus: "unsupported", message: "Unknown agent" };
    }

    const platform = process.platform === "win32" ? "win" : "mac";
    const configPaths = agent.configPaths.filter((p) => p.platform === platform && p.type === "settings");

    if (configPaths.length === 0) {
      return { agentId, installed: false, hookStatus: "unsupported", message: "No config path for this platform" };
    }

    const configPath = configPaths[0].path;

    if (!existsSync(configPath)) {
      return { agentId, installed: false, hookStatus: "missing", message: "Config file not found" };
    }

    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      this.mergeHooks(config, agent);
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { agentId, installed: true, hookStatus: "synced" };
    } catch (err) {
      return {
        agentId,
        installed: true,
        hookStatus: "error",
        message: `Failed to sync: ${(err as Error).message}`,
      };
    }
  }

  private mergeHooks(config: Record<string, unknown>, agent: AgentDescriptor): void {
    const nodeBin = this.resolveNodeBin();
    const hooksDir = this.resolveHooksDir();

    // 在命令中注入 Agent ID，脚本仍从 stdin 读取真实 hook 事件。
    const stateHookCmd = this.buildHookCommand({
      nodeBin,
      hooksDir,
      scriptName: "state-hook.js",
      agentId: agent.id,
    });
    const permissionHookCmd = this.buildHookCommand({
      nodeBin,
      hooksDir,
      scriptName: "permission-hook.js",
      agentId: agent.id,
    });

    // Ensure hooks object exists
    if (!config.hooks || typeof config.hooks !== "object") {
      config.hooks = {};
    }
    const hooks = config.hooks as Record<string, unknown[]>;

    if (agent.capabilities.state) {
      this.mergeHookEntry(hooks, "SessionStart", stateHookCmd);
      this.mergeHookEntry(hooks, "SessionEnd", stateHookCmd);
      this.mergeHookEntry(hooks, "Stop", stateHookCmd);
      this.mergeHookEntry(hooks, "PreToolUse", stateHookCmd);
      this.mergeHookEntry(hooks, "PostToolUse", stateHookCmd);
      this.mergeHookEntry(hooks, "UserPromptSubmit", stateHookCmd);
      this.mergeHookEntry(hooks, "Notification", stateHookCmd);
    }

    if (agent.capabilities.permission) {
      this.mergeHookEntry(hooks, "PreToolUse", permissionHookCmd);
    }
  }

  private mergeHookEntry(hooks: Record<string, unknown[]>, event: string, command: string): void {
    if (!hooks[event]) {
      hooks[event] = [];
    }
    const entries = hooks[event] as Array<Record<string, unknown>>;

    // Remove old beacon hook for this event
    const filtered = entries.filter((e) => {
      const cmd = (e.command as string) ?? "";
      return !cmd.includes(BEACON_MARKER);
    });

    filtered.push({
      type: "command",
      command: command,
      _marker: BEACON_MARKER,
    });

    hooks[event] = filtered;
  }

  private resolveNodeBin(): string {
    if (process.platform === "win32") {
      return "node";
    }
    // macOS: resolve to full path since hooks run with minimal PATH
    try {
      const { execSync } = require("child_process");
      return execSync("which node", { encoding: "utf-8" }).trim();
    } catch {
      return "node";
    }
  }

  private resolveHooksDir(): string {
    if (app.isPackaged) {
      return join(process.resourcesPath, "hooks");
    }
    return join(process.cwd(), "hooks");
  }

  private buildHookCommand(options: {
    nodeBin: string;
    hooksDir: string;
    scriptName: string;
    agentId: string;
  }): string {
    const { nodeBin, hooksDir, scriptName, agentId } = options;
    return `${nodeBin} "${join(hooksDir, scriptName)}" --agent-id "${agentId}"`;
  }
}
