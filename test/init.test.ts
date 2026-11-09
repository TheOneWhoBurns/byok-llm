import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { init, initConfig } from "../src/index.js";

describe("init", () => {
  const originalEnv = { ...process.env };
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "byok-llm-init-"));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(dir, { recursive: true, force: true });
    initConfig({});
  });

  // Regression: `providers` was typed as `Record<string, ProviderConfig> & ProviderId[]`,
  // so this call, the README's quick start, was rejected by the type checker.
  it("should accept a list of provider ids", async () => {
    process.env.OPENAI_API_KEY = "sk-init-test-key-1234567";

    const provider = await init({ providers: ["anthropic", "openai"], interactive: false });

    expect(provider).toEqual({
      providerId: "openai",
      key: "sk-init-test-key-1234567",
      source: "env",
      baseUrl: "https://api.openai.com",
      headers: { Authorization: "Bearer sk-init-test-key-1234567" },
    });
  });

  it("should return null without prompting when nothing is configured and interactive is off", async () => {
    const provider = await init({ providers: ["anthropic", "openai"], interactive: false });

    expect(provider).toBeNull();
  });

  it("should return null without prompting when stdin is not a terminal", async () => {
    expect(process.stdin.isTTY).toBeFalsy();

    const provider = await init({ providers: ["anthropic"], appName: "test-app" });

    expect(provider).toBeNull();
  });

  it("should pass configPath through to the config loader", async () => {
    const configPath = join(dir, "custom.json");
    writeFileSync(
      configPath,
      JSON.stringify({ providers: { groq: { apiKey: "gsk_from-custom-config-123" } } }),
    );

    const provider = await init({ providers: ["groq"], configPath, interactive: false });

    expect(provider?.key).toBe("gsk_from-custom-config-123");
  });

  it("should use the configured fallback order when no list is given", async () => {
    const configPath = join(dir, "order.json");
    writeFileSync(configPath, JSON.stringify({ fallbackOrder: ["mistral", "openai"] }));
    process.env.OPENAI_API_KEY = "sk-init-order-key-1234567";
    process.env.MISTRAL_API_KEY = "mistral-init-order-key-123";

    const provider = await init({ configPath, interactive: false });

    expect(provider?.providerId).toBe("mistral");
  });
});
