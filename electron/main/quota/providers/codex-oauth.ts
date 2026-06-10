import type { QuotaTier } from "../../../../shared/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function queryCodexOauth(_accessToken?: string, _accountId?: string): Promise<QuotaTier[]> {
  try {
    const codexSessionsDir = getCodexSessionsDir();
    if (!fs.existsSync(codexSessionsDir)) {
      return [{
        name: "five_hour",
        utilization: 0,
        resetsAt: null,
        planLabel: "未找到 Codex 会话目录",
      }];
    }

    const result = findRateLimitsInSessions(codexSessionsDir);
    if (!result) {
      return [{
        name: "five_hour",
        utilization: 0,
        resetsAt: null,
        planLabel: "会话日志中无额度信息",
      }];
    }

    return [
      {
        name: "five_hour",
        utilization: result.fiveHourPercent,
        resetsAt: result.fiveHourResetsAt ? new Date(result.fiveHourResetsAt * 1000).toISOString() : null,
        planLabel: `5小时窗口 ${result.fiveHourResetsAt ? formatResetLabel(result.fiveHourResetsAt, false) : "--:--"}`,
      },
      {
        name: "seven_day",
        utilization: result.weekPercent,
        resetsAt: result.weekResetsAt ? new Date(result.weekResetsAt * 1000).toISOString() : null,
        planLabel: `7天窗口 ${result.weekResetsAt ? formatResetLabel(result.weekResetsAt, true) : "--/--"}`,
      },
    ];
  } catch (error: any) {
    throw new Error(`查询 Codex 额度失败: ${error.message}`);
  }
}

function getCodexSessionsDir(): string {
  const homeDir = os.homedir();
  const platform = os.platform();
  
  if (platform === "win32") {
    return path.join(homeDir, ".codex", "sessions");
  }
  return path.join(homeDir, ".codex", "sessions");
}

interface RateLimitResult {
  fiveHourPercent: number;
  fiveHourResetsAt: number | null;
  weekPercent: number;
  weekResetsAt: number | null;
}

function findRateLimitsInSessions(sessionsDir: string): RateLimitResult | null {
  const rolloutPattern = path.join(sessionsDir, "**", "rollout-*.jsonl");
  const files: string[] = [];
  
  try {
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          walkDir(fullPath);
        } else if (item.isFile() && item.name.startsWith("rollout-") && item.name.endsWith(".jsonl")) {
          files.push(fullPath);
        }
      }
    };
    walkDir(sessionsDir);
  } catch (error) {
    return null;
  }

  if (files.length === 0) {
    return null;
  }

  files.sort((a, b) => {
    try {
      return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
    } catch {
      return 0;
    }
  });

  for (const filepath of files.slice(0, 3)) {
    const result = searchFileForRateLimits(filepath);
    if (result) {
      return result;
    }
  }

  return null;
}

function searchFileForRateLimits(filepath: string): RateLimitResult | null {
  try {
    const lines = fs.readFileSync(filepath, "utf-8").split("\n");
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const entry = JSON.parse(line);
        const rateLimits = entry.payload?.rate_limits;
        if (!rateLimits) continue;

        const primary = rateLimits.primary;
        const secondary = rateLimits.secondary;
        
        if (!primary || !secondary) continue;

        return {
          fiveHourPercent: Math.round(primary.used_percent ?? 0),
          fiveHourResetsAt: primary.resets_at ?? null,
          weekPercent: Math.round(secondary.used_percent ?? 0),
          weekResetsAt: secondary.resets_at ?? null,
        };
      } catch {
        continue;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function formatResetLabel(unixSeconds: number, isWeekly: boolean): string {
  try {
    const dt = new Date(unixSeconds * 1000);
    const localOffset = dt.getTimezoneOffset() * 60 * 1000;
    const localTime = new Date(dt.getTime() + localOffset);
    
    if (isWeekly) {
      return `${localTime.getMonth() + 1}-${localTime.getDate()}`;
    }
    return `${String(localTime.getHours()).padStart(2, "0")}:${String(localTime.getMinutes()).padStart(2, "0")}`;
  } catch {
    return isWeekly ? "--/--" : "--:--";
  }
}
