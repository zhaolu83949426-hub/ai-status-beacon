import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { basename, dirname, join } from "path";
import { app } from "electron";
import type { AgentDescriptor, AgentConfigPath } from "../../../shared/agent-types";
import type { AgentSettings, HookSyncResult } from "../../../shared/types";
import { getAgent } from "../agents/registry";
import { ensureCodexHooksFeature, isCodexHooksFeatureEnabled } from "./codex-hooks-feature";
import { applyHookPlan, buildHookPlan, inspectHookStatus } from "./hook-sync-plan";

export class HookSyncService {
  private port: number;
  private agentSettings: Record<string, AgentSettings>;

  constructor(port: number, agentSettings: Record<string, AgentSettings>) {
    this.port = port;
    this.agentSettings = agentSettings;
  }

  syncAgent(agentId: string): HookSyncResult {
    return this.withAgent(agentId, (agent, configPath) => {
      try {
        this.ensureFeatureConfig(agent);
        const result = this.syncByFormat(agent, configPath);
        return { agentId, installed: true, hookStatus: result };
      } catch (err) {
        return { agentId, installed: true, hookStatus: "error", message: `Failed to sync: ${(err as Error).message}` };
      }
    });
  }

  getHookStatus(agentId: string): HookSyncResult {
    return this.withAgent(agentId, (agent, configPath) => {
      try {
        const result = this.inspectByFormat(agent, configPath);
        return { agentId, installed: true, hookStatus: result };
      } catch (err) {
        return { agentId, installed: true, hookStatus: "error", message: `Failed to inspect: ${(err as Error).message}` };
      }
    });
  }

  private withAgent(
    agentId: string,
    action: (agent: AgentDescriptor, configPath: AgentConfigPath) => HookSyncResult,
  ): HookSyncResult {
    const agent = getAgent(agentId);
    if (!agent) return { agentId, installed: false, hookStatus: "unsupported", message: "Unknown agent" };
    const configPath = this.getConfigPath(agent);
    if (!configPath) return { agentId, installed: false, hookStatus: "unsupported", message: "No config path for this platform" };
    if (!existsSync(configPath.path) && !this.canCreateConfig(agent)) {
      return { agentId, installed: false, hookStatus: "missing", message: "Config path not found" };
    }
    return action(agent, configPath);
  }

  private syncByFormat(agent: AgentDescriptor, configPath: AgentConfigPath): HookSyncResult["hookStatus"] {
    if (agent.hookConfig?.configFormat === "kimi-toml") return this.syncKimi(agent, configPath.path);
    if (agent.hookConfig?.configFormat === "kiro-agent-json") return this.syncKiro(agent, configPath.path);
    if (agent.hookConfig?.configFormat === "opencode-plugin") return this.syncOpencode(configPath.path);
    if (agent.hookConfig?.configFormat === "openclaw-plugin") return this.syncOpenClaw(configPath.path);
    if (agent.hookConfig?.configFormat === "pi-extension") return this.syncPi(configPath.path);
    if (agent.hookConfig?.configFormat === "hermes-plugin") return this.syncHermes(configPath.path);
    const config = this.readJsonConfig(configPath.path);
    const plan = this.createPlan(agent);
    applyHookPlan(config, plan);
    this.writeJsonConfig(configPath.path, config);
    return this.inspectJson(agent, config);
  }

  private inspectByFormat(agent: AgentDescriptor, configPath: AgentConfigPath): HookSyncResult["hookStatus"] {
    if (agent.hookConfig?.configFormat === "kimi-toml") return this.inspectKimi(agent, configPath.path);
    if (agent.hookConfig?.configFormat === "kiro-agent-json") return this.inspectKiro(agent, configPath.path);
    if (agent.hookConfig?.configFormat === "opencode-plugin") return this.inspectOpencode(configPath.path);
    if (agent.hookConfig?.configFormat === "openclaw-plugin") return this.inspectOpenClaw(configPath.path);
    if (agent.hookConfig?.configFormat === "pi-extension") return this.inspectManagedDir(configPath.path, ["index.ts", "pi-extension-core.js"]);
    if (agent.hookConfig?.configFormat === "hermes-plugin") return this.inspectManagedDir(configPath.path, ["plugin.yaml", "__init__.py"]);
    return this.inspectJson(agent, this.readJsonConfig(configPath.path));
  }

  private inspectJson(agent: AgentDescriptor, config: Record<string, unknown>): HookSyncResult["hookStatus"] {
    const status = inspectHookStatus(config, this.createPlan(agent));
    if (status !== "synced") return status;
    return this.isFeatureConfigSynced(agent) ? "synced" : "outdated";
  }

  private syncKimi(agent: AgentDescriptor, filePath: string): HookSyncResult["hookStatus"] {
    const current = readFileSync(filePath, "utf-8");
    const next = this.buildKimiText(agent, current);
    if (next !== current) writeFileSync(filePath, next, "utf-8");
    return this.inspectKimi(agent, filePath);
  }

  private inspectKimi(agent: AgentDescriptor, filePath: string): HookSyncResult["hookStatus"] {
    const text = readFileSync(filePath, "utf-8");
    return this.readKimiEvents(text, agent.hookConfig?.scriptName ?? "").length === (agent.hookConfig?.events.length ?? 0)
      ? "synced"
      : "outdated";
  }

  private syncKiro(agent: AgentDescriptor, agentsDir: string): HookSyncResult["hookStatus"] {
    const files = this.getKiroFiles(agentsDir);
    for (const filePath of files) this.syncKiroFile(agent, filePath);
    return this.inspectKiro(agent, agentsDir);
  }

  private inspectKiro(agent: AgentDescriptor, agentsDir: string): HookSyncResult["hookStatus"] {
    const files = this.getKiroFiles(agentsDir);
    if (files.length === 0) return "missing";
    return files.every((filePath) => this.inspectKiroFile(agent, filePath)) ? "synced" : "outdated";
  }

  private syncKiroFile(agent: AgentDescriptor, filePath: string): void {
    const config = this.readJsonConfig(filePath);
    const plan = this.createPlan(agent);
    applyHookPlan(config, plan);
    if (!config.name) config.name = basename(filePath, ".json");
    this.writeJsonConfig(filePath, config);
  }

  private inspectKiroFile(agent: AgentDescriptor, filePath: string): boolean {
    return inspectHookStatus(this.readJsonConfig(filePath), this.createPlan(agent)) === "synced";
  }

  private syncOpencode(configPath: string): HookSyncResult["hookStatus"] {
    const config = existsSync(configPath) ? this.readJsonConfig(configPath) : { $schema: "https://opencode.ai/config.json" };
    const pluginDir = this.resourcePath("opencode-plugin");
    const plugins = Array.isArray(config.plugin) ? config.plugin as string[] : [];
    config.plugin = this.upsertPath(plugins, pluginDir, "opencode-plugin");
    this.writeJsonConfig(configPath, config);
    return this.inspectOpencode(configPath);
  }

  private inspectOpencode(configPath: string): HookSyncResult["hookStatus"] {
    const config = this.readJsonConfig(configPath);
    const pluginDir = this.resourcePath("opencode-plugin");
    return Array.isArray(config.plugin) && config.plugin.includes(pluginDir) ? "synced" : "outdated";
  }

  private syncOpenClaw(configPath: string): HookSyncResult["hookStatus"] {
    const config = existsSync(configPath) ? this.readJsonConfig(configPath) : {};
    const pluginDir = this.resourcePath("openclaw-plugin");
    const plugins = this.ensureObject(config, "plugins");
    const load = this.ensureObject(plugins, "load");
    load.paths = this.upsertPath(Array.isArray(load.paths) ? load.paths as string[] : [], pluginDir, "openclaw-plugin");
    const entries = this.ensureObject(plugins, "entries");
    entries["clawd-on-desk"] = { enabled: true, hooks: { allowConversationAccess: false } };
    this.writeJsonConfig(configPath, config);
    return this.inspectOpenClaw(configPath);
  }

  private inspectOpenClaw(configPath: string): HookSyncResult["hookStatus"] {
    const config = this.readJsonConfig(configPath);
    const paths = (((config.plugins as any)?.load as any)?.paths) as unknown;
    return Array.isArray(paths) && paths.includes(this.resourcePath("openclaw-plugin")) ? "synced" : "outdated";
  }

  private syncPi(extensionDir: string): HookSyncResult["hookStatus"] {
    this.copyManagedDir(extensionDir, { "pi-extension.ts": "index.ts", "pi-extension-core.js": "pi-extension-core.js" });
    return this.inspectManagedDir(extensionDir, ["index.ts", "pi-extension-core.js"]);
  }

  private syncHermes(pluginDir: string): HookSyncResult["hookStatus"] {
    this.copyManagedDir(pluginDir, { "hermes-plugin/plugin.yaml": "plugin.yaml", "hermes-plugin/__init__.py": "__init__.py" });
    return this.inspectManagedDir(pluginDir, ["plugin.yaml", "__init__.py"]);
  }

  private inspectManagedDir(dirPath: string, files: string[]): HookSyncResult["hookStatus"] {
    return files.every((file) => existsSync(join(dirPath, file))) ? "synced" : "outdated";
  }

  private buildKimiText(agent: AgentDescriptor, text: string): string {
    const stripped = this.stripKimiBlocks(text, agent.hookConfig?.scriptName ?? "");
    const command = this.buildScriptCommand(agent.hookConfig?.scriptName ?? "kimi-hook.js");
    const blocks = (agent.hookConfig?.events ?? []).map((event) => [
      "[[hooks]]",
      `event = "${event}"`,
      `command = '${command}'`,
      'matcher = ""',
      "timeout = 30",
    ].join("\n")).join("\n\n");
    return `${stripped.trimEnd()}\n\n${blocks}\n`;
  }

  private stripKimiBlocks(text: string, marker: string): string {
    const lines = text.split(/\r?\n/);
    const output: string[] = [];
    for (let i = 0; i < lines.length;) {
      if (!/^\s*\[\[hooks\]\]/.test(lines[i])) {
        output.push(lines[i++]);
        continue;
      }
      const start = i++;
      while (i < lines.length && !/^\s*\[\[?[^\]]+\]\]?/.test(lines[i])) i++;
      const block = lines.slice(start, i).join("\n");
      if (!block.includes(marker)) output.push(block);
    }
    return output.join("\n");
  }

  private readKimiEvents(text: string, marker: string): string[] {
    const events: string[] = [];
    for (const block of text.split(/\n(?=\s*\[\[hooks\]\])/)) {
      if (!block.includes(marker)) continue;
      const match = block.match(/event\s*=\s*"([^"]+)"/);
      if (match) events.push(match[1]);
    }
    return events;
  }

  private getKiroFiles(agentsDir: string): string[] {
    const files = readdirSync(agentsDir).filter((file) => file.endsWith(".json") && !file.includes(".example") && file !== "kiro_default.json");
    const clawdPath = join(agentsDir, "clawd.json");
    if (!existsSync(clawdPath)) writeFileSync(clawdPath, JSON.stringify({ name: "clawd", description: "Clawd desktop pet hook integration", hooks: {} }, null, 2));
    return [...new Set([...files.map((file) => join(agentsDir, file)), clawdPath])];
  }

  private createPlan(agent: AgentDescriptor) {
    return buildHookPlan({
      agent,
      settings: this.getAgentSettings(agent.id),
      nodeBin: this.resolveNodeBin(),
      hooksDir: this.resolveHooksDir(),
      port: this.port,
      platform: process.platform,
    });
  }

  private getConfigPath(agent: AgentDescriptor): AgentConfigPath | null {
    const platform = process.platform === "win32" ? "win" : "mac";
    return agent.configPaths.find((p) => p.platform === platform && this.isWritableConfigPath(p)) ?? null;
  }

  private isWritableConfigPath(configPath: AgentConfigPath): boolean {
    return ["settings", "agents-dir", "plugin", "extension"].includes(configPath.type);
  }

  private canCreateConfig(agent: AgentDescriptor): boolean {
    return ["opencode-plugin", "openclaw-plugin", "pi-extension", "hermes-plugin"].includes(agent.hookConfig?.configFormat ?? "");
  }

  private getAgentSettings(agentId: string): AgentSettings {
    return this.agentSettings[agentId] ?? { stateEnabled: false, permissionEnabled: false };
  }

  private ensureFeatureConfig(agent: AgentDescriptor): void {
    const featurePath = this.getFeatureConfigPath(agent);
    if (featurePath) ensureCodexHooksFeature(featurePath);
  }

  private isFeatureConfigSynced(agent: AgentDescriptor): boolean {
    const featurePath = this.getFeatureConfigPath(agent);
    return featurePath ? isCodexHooksFeatureEnabled(featurePath) : true;
  }

  private getFeatureConfigPath(agent: AgentDescriptor): string | null {
    const platform = process.platform === "win32" ? "win" : "mac";
    return agent.configPaths.find((p) => p.platform === platform && p.type === "feature")?.path ?? null;
  }

  private readJsonConfig(filePath: string): Record<string, unknown> {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  }

  private writeJsonConfig(filePath: string, config: Record<string, unknown>): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  }

  private ensureObject(target: Record<string, unknown>, key: string): Record<string, unknown> {
    if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
    return target[key] as Record<string, unknown>;
  }

  private upsertPath(paths: string[], desiredPath: string, basenameMarker: string): string[] {
    const index = paths.findIndex((entry) => entry === desiredPath || entry.replace(/\\/g, "/").endsWith(`/${basenameMarker}`));
    if (index === -1) return [...paths, desiredPath];
    return paths.map((entry, i) => i === index ? desiredPath : entry);
  }

  private copyManagedDir(targetDir: string, files: Record<string, string>): void {
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    for (const [source, target] of Object.entries(files)) {
      copyFileSync(this.resourcePath(source), join(targetDir, target));
    }
  }

  private buildScriptCommand(scriptName: string): string {
    const scriptPath = `${this.resolveHooksDir()}/${scriptName}`.replace(/\\/g, "/");
    const command = `"${this.resolveNodeBin()}" "${scriptPath}"`;
    return process.platform === "win32" ? `& ${command}` : command;
  }

  private resolveNodeBin(): string {
    if (process.platform === "win32") return "node";
    try {
      const { execSync } = require("child_process");
      return execSync("which node", { encoding: "utf-8" }).trim();
    } catch {
      return "node";
    }
  }

  private resolveHooksDir(): string {
    return app.isPackaged ? join(process.resourcesPath, "hooks") : join(process.cwd(), "hooks");
  }

  private resourcePath(name: string): string {
    return join(this.resolveHooksDir(), ...name.split("/")).replace(/\\/g, "/");
  }
}
