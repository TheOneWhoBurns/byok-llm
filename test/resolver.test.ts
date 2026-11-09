import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  initConfig,
  resolveKey,
  resolveWithFallback,
  getConfiguredProviders,
  getConfig,
} from "../src/config/resolver.js";
import { getUserConfigPath } from "../src/config/loader.js";
import { storeKey, removeKey } from "../src/storage/file.js";

describe("Key Resolver", () => {
  const originalEnv = { ...process.env };
  const testDir = join(tmpdir(), "byok-ai-test-resolver-" + Date.now());
  const originalCwd = process.cwd;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    process.cwd = () => testDir;
    // Reset config cache
    initConfig({});
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.env = { ...originalEnv };
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("resolveKey priority", () => {
    it("should prioritize runtime key over everything", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-from-env-123456";

      const result = await resolveKey("anthropic", "sk-ant-runtime-key-123456");
      expect(result).toBeDefined();
      expect(result!.key).toBe("sk-ant-runtime-key-123456");
      expect(result!.source).toBe("runtime");
    });

    it("should prioritize config apiKey over env var", async () => {
      process.env.OPENAI_API_KEY = "sk-from-env-123456789";

      initConfig({
        providers: {
          openai: { apiKey: "sk-from-config-123456789" },
        },
      });

      const result = await resolveKey("openai");
      expect(result).toBeDefined();
      expect(result!.key).toBe("sk-from-config-123456789");
      expect(result!.source).toBe("runtime");
    });

    it("should fall back to env var when no config key", async () => {
      process.env.GROQ_API_KEY = "gsk_env-key-123456789";

      const result = await resolveKey("groq");
      expect(result).toBeDefined();
      expect(result!.key).toBe("gsk_env-key-123456789");
      expect(result!.source).toBe("env");
      expect(result!.envVar).toBe("GROQ_API_KEY");
    });

    it("should check all env var names for a provider", async () => {
      // Google has two: GEMINI_API_KEY and GOOGLE_API_KEY
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = "google-key-from-secondary-env";

      const result = await resolveKey("google");
      expect(result).toBeDefined();
      expect(result!.key).toBe("google-key-from-secondary-env");
      expect(result!.envVar).toBe("GOOGLE_API_KEY");
    });

    it("should return null when provider is disabled", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-disabled-key-12345";

      initConfig({
        providers: {
          anthropic: { disabled: true },
        },
      });

      const result = await resolveKey("anthropic");
      expect(result).toBeNull();
    });

    it("should return null for unknown providers", async () => {
      const result = await resolveKey("totally-fake-provider");
      expect(result).toBeNull();
    });
  });

  describe("resolveWithFallback", () => {
    it("should return first provider with a key", async () => {
      // Only OpenRouter has a key
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      process.env.OPENROUTER_API_KEY = "sk-or-fallback-key-123456";

      const result = await resolveWithFallback(["anthropic", "openai", "openrouter"]);
      expect(result).toBeDefined();
      expect(result!.providerId).toBe("openrouter");
      expect(result!.key).toBe("sk-or-fallback-key-123456");
      expect(result!.baseUrl).toBe("https://openrouter.ai/api");
      expect(result!.headers["Authorization"]).toBe("Bearer sk-or-fallback-key-123456");
    });

    it("should respect the specified order", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-key-123456789ab";
      process.env.OPENAI_API_KEY = "sk-openai-key-12345678";

      // OpenAI first in the list
      const result = await resolveWithFallback(["openai", "anthropic"]);
      expect(result!.providerId).toBe("openai");
    });

    it("should return null when no provider has a key", async () => {
      // Clear all relevant env vars
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const result = await resolveWithFallback(["anthropic", "openai", "openrouter"]);
      expect(result).toBeNull();
    });

    it("should skip disabled providers even with keys", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-disabled-key-12345";
      process.env.OPENAI_API_KEY = "sk-openai-enabled-key-123";

      initConfig({
        providers: {
          anthropic: { disabled: true },
        },
      });

      const result = await resolveWithFallback(["anthropic", "openai"]);
      expect(result!.providerId).toBe("openai");
    });

    it("should include correct auth headers for different auth styles", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-header-test-12345";

      const result = await resolveWithFallback(["anthropic"]);
      expect(result).toBeDefined();
      // Anthropic uses x-api-key style
      expect(result!.headers["x-api-key"]).toBe("sk-ant-header-test-12345");
      // Should also include anthropic-version header
      expect(result!.headers["anthropic-version"]).toBeDefined();
    });

    it("should use bearer auth for OpenAI-compatible providers", async () => {
      process.env.GROQ_API_KEY = "gsk_bearer-test-123456789";

      const result = await resolveWithFallback(["groq"]);
      expect(result!.headers["Authorization"]).toBe("Bearer gsk_bearer-test-123456789");
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return all providers with keys", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-configured-12345";
      process.env.OPENROUTER_API_KEY = "sk-or-configured-123456";
      delete process.env.OPENAI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.XAI_API_KEY;
      delete process.env.MISTRAL_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;

      initConfig({});
      const configured = await getConfiguredProviders();

      const ids = configured.map((c) => c.providerId);
      expect(ids).toContain("anthropic");
      expect(ids).toContain("openrouter");
      expect(ids).not.toContain("openai");
    });

    it("should return empty array when nothing configured", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.XAI_API_KEY;
      delete process.env.MISTRAL_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;

      initConfig({});
      const configured = await getConfiguredProviders();
      expect(configured.length).toBe(0);
    });
  });

  describe("noUserConfig", () => {
    function writeUserConfig() {
      const userConfigPath = getUserConfigPath();
      mkdirSync(dirname(userConfigPath), { recursive: true });
      writeFileSync(
        userConfigPath,
        JSON.stringify({
          defaultProvider: "mistral",
          providers: { mistral: { apiKey: "mistral-key-from-user-config" } },
        }),
      );
      return userConfigPath;
    }

    afterEach(() => {
      rmSync(getUserConfigPath(), { force: true });
    });

    it("should read the user config by default", async () => {
      writeUserConfig();

      const config = initConfig({});

      expect(config.defaultProvider).toBe("mistral");
      expect((await resolveKey("mistral"))?.key).toBe("mistral-key-from-user-config");
    });

    // Regression: the option was declared in ByokOptions but never read.
    it("should skip the user config when noUserConfig is set", async () => {
      writeUserConfig();

      const config = initConfig({ noUserConfig: true });

      expect(config).toEqual({});
      expect(await resolveKey("mistral")).toBeNull();
    });

    it("should still read project config and stored keys", async () => {
      writeUserConfig();
      writeFileSync(
        join(testDir, ".byokrc.json"),
        JSON.stringify({ providers: { groq: { apiKey: "gsk_from-project-config-12" } } }),
      );
      await storeKey("xai", "xai-stored-key-1234567890");

      initConfig({ noUserConfig: true });

      expect((await resolveKey("groq"))?.key).toBe("gsk_from-project-config-12");
      expect((await resolveKey("xai"))?.key).toBe("xai-stored-key-1234567890");
      await removeKey("xai");
    });
  });

  describe("initConfig with runtime overrides", () => {
    it("should merge runtime provider config", () => {
      initConfig({
        providers: {
          anthropic: { apiKey: "sk-ant-init-override-12345" },
          openai: { baseUrl: "https://custom-proxy.com" },
        },
      });

      const config = getConfig();
      expect(config.providers?.anthropic?.apiKey).toBe("sk-ant-init-override-12345");
      expect(config.providers?.openai?.baseUrl).toBe("https://custom-proxy.com");
    });

    it("should accept custom config path", () => {
      const customPath = join(testDir, "my-custom-config.json");
      writeFileSync(
        customPath,
        JSON.stringify({
          defaultProvider: "groq",
        }),
      );

      initConfig({ configPath: customPath });
      const config = getConfig();
      expect(config.defaultProvider).toBe("groq");
    });
  });
});
