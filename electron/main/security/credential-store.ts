import { safeStorage } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";

// Uses Electron safeStorage for cross-platform credential encryption.
// Falls back to encrypted JSON file when keytar is unavailable.

const CREDENTIALS_FILE = "credentials.enc.json";

interface CredentialEntry {
  account: string;
  kind: string;
  encrypted: string; // base64-encoded, safeStorage-encrypted
}

function credentialsPath(): string {
  return join(app.getPath("userData"), CREDENTIALS_FILE);
}

function loadStore(): CredentialEntry[] {
  const path = credentialsPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStore(entries: CredentialEntry[]): void {
  writeFileSync(credentialsPath(), JSON.stringify(entries, null, 2), "utf-8");
}

export class CredentialStore {
  save(accountId: string, kind: string, value: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn("[CredentialStore] Encryption not available, credentials stored in plaintext");
    }
    const encrypted = safeStorage.encryptString(value).toString("base64");
    const entries = loadStore();
    const idx = entries.findIndex(
      (e) => e.account === accountId && e.kind === kind,
    );
    const entry: CredentialEntry = { account: accountId, kind, encrypted };
    if (idx >= 0) {
      entries[idx] = entry;
    } else {
      entries.push(entry);
    }
    saveStore(entries);
  }

  get(accountId: string, kind: string): string | null {
    const entries = loadStore();
    const entry = entries.find(
      (e) => e.account === accountId && e.kind === kind,
    );
    if (!entry) return null;
    try {
      const buffer = Buffer.from(entry.encrypted, "base64");
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  delete(accountId: string, kind?: string): void {
    let entries = loadStore();
    if (kind) {
      entries = entries.filter(
        (e) => !(e.account === accountId && e.kind === kind),
      );
    } else {
      entries = entries.filter((e) => e.account !== accountId);
    }
    saveStore(entries);
  }
}
