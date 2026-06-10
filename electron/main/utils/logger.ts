import { app } from "electron";
import { createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

const MAX_LOG_FILES = 10;
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogCategory = "server" | "agent" | "business";

class Logger {
  private stream: ReturnType<typeof createWriteStream> | null = null;
  private logDir: string;
  private isDev: boolean;

  constructor() {
    this.isDev = !app.isPackaged;
    this.logDir = join(app.getPath("userData"), "logs");
    if (!existsSync(this.logDir)) mkdirSync(this.logDir, { recursive: true });
    this.rotate();
    this.openStream();
  }

  debug(category: LogCategory, message: string, ...args: unknown[]): void {
    this.write("debug", category, message, args);
  }

  info(category: LogCategory, message: string, ...args: unknown[]): void {
    this.write("info", category, message, args);
  }

  warn(category: LogCategory, message: string, ...args: unknown[]): void {
    this.write("warn", category, message, args);
  }

  error(category: LogCategory, message: string, ...args: unknown[]): void {
    this.write("error", category, message, args);
  }

  private write(level: LogLevel, category: LogCategory, message: string, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${args.length ? " " + args.map((a) => JSON.stringify(a)).join(" ") : ""}\n`;

    if (this.stream) {
      this.stream.write(line);
    }

    if (this.isDev && level === "debug") {
      console.debug(line.trim());
      return;
    }
    if (this.isDev && level === "info") {
      console.info(line.trim());
      return;
    }
    if (level === "error") {
      console.error(line.trim());
    } else if (level === "warn") {
      console.warn(line.trim());
    }
  }

  private openStream(): void {
    const date = new Date().toISOString().split("T")[0];
    const file = join(this.logDir, `beacon-${date}.log`);
    this.stream = createWriteStream(file, { flags: "a" });
  }

  private rotate(): void {
    try {
      const files = readdirSync(this.logDir)
        .filter((f) => f.startsWith("beacon-") && f.endsWith(".log"))
        .sort();
      while (files.length > MAX_LOG_FILES) {
        const oldest = files.shift();
        if (oldest) unlinkSync(join(this.logDir, oldest));
      }
    } catch {
      // ignore rotation errors
    }
  }
}

let logger: Logger | null = null;

export function getLogger(): Logger {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}
