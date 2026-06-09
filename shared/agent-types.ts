import type { BeaconState, AgentStateEvent, PermissionRequest } from "./types";

export interface AgentConfigPath {
  platform: "win" | "mac";
  path: string;
  type: "settings" | "credentials";
}

export interface AgentDescriptor {
  id: string;
  name: string;
  processNames: {
    win: string[];
    mac: string[];
  };
  configPaths: AgentConfigPath[];
  capabilities: {
    state: boolean;
    permission: boolean;
  };
  defaultStateEnabled: boolean;
  defaultPermissionEnabled: boolean;
  eventMap: Record<string, BeaconState>;
  mapEvent(input: Record<string, unknown>): AgentStateEvent;
  mapPermission(input: Record<string, unknown>): Partial<PermissionRequest>;
}
