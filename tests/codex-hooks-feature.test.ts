import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexHooksFeature, isCodexHooksFeatureEnabled } from "../electron/main/hooks/codex-hooks-feature";

const tempDirs: string[] = [];

function createTempFile(name: string, initial?: string): string {
  const dir = mkdtempSync(join(tmpdir(), "beacon-codex-feature-"));
  tempDirs.push(dir);
  const filePath = join(dir, name);
  if (initial !== undefined) {
    writeFileSync(filePath, initial, "utf-8");
  }
  return filePath;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("codex hooks feature", () => {
  it("creates hooks=true when config.toml is missing", () => {
    const filePath = createTempFile("config.toml");

    ensureCodexHooksFeature(filePath);

    expect(readFileSync(filePath, "utf-8")).toBe("[features]\nhooks = true\n");
    expect(isCodexHooksFeatureEnabled(filePath)).toBe(true);
  });

  it("preserves an explicit hooks=false", () => {
    const filePath = createTempFile("config.toml", "[features]\nhooks = false\n");

    ensureCodexHooksFeature(filePath);

    expect(readFileSync(filePath, "utf-8")).toBe("[features]\nhooks = false\n");
    expect(isCodexHooksFeatureEnabled(filePath)).toBe(false);
  });

  it("migrates legacy codex_hooks=false without enabling it", () => {
    const filePath = createTempFile("config.toml", "[features]\ncodex_hooks = false\n");

    ensureCodexHooksFeature(filePath);

    expect(readFileSync(filePath, "utf-8")).toBe("[features]\nhooks = false\n");
    expect(isCodexHooksFeatureEnabled(filePath)).toBe(false);
  });

  it("inserts hooks=true into an existing features section", () => {
    const filePath = createTempFile("config.toml", "[features]\nfoo = true\n[model]\nname = \"x\"\n");

    ensureCodexHooksFeature(filePath);

    expect(readFileSync(filePath, "utf-8")).toBe("[features]\nhooks = true\nfoo = true\n[model]\nname = \"x\"\n");
    expect(isCodexHooksFeatureEnabled(filePath)).toBe(true);
  });
});
