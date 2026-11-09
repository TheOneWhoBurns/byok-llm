import { describe, it, expect } from "vitest";
import {
  getProvider,
  listProviders,
  hasProvider,
  registerProvider,
  DEFAULT_FALLBACK_ORDER,
} from "../src/providers/registry.js";

describe("Provider Registry", () => {
  describe("Built-in providers", () => {
    const expectedProviders = [
      {
        id: "anthropic",
        name: "Anthropic",
        envKeys: ["ANTHROPIC_API_KEY"],
        authStyle: "x-api-key",
        openaiCompatible: false,
      },
      {
        id: "openai",
        name: "OpenAI",
        envKeys: ["OPENAI_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
      {
        id: "openrouter",
        name: "OpenRouter",
        envKeys: ["OPENROUTER_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
      {
        id: "google",
        name: "Google Gemini",
        envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
        authStyle: "x-api-key",
        openaiCompatible: false,
      },
      {
        id: "groq",
        name: "Groq",
        envKeys: ["GROQ_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
      {
        id: "xai",
        name: "xAI (Grok)",
        envKeys: ["XAI_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
      {
        id: "mistral",
        name: "Mistral AI",
        envKeys: ["MISTRAL_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
      {
        id: "deepseek",
        name: "DeepSeek",
        envKeys: ["DEEPSEEK_API_KEY"],
        authStyle: "bearer",
        openaiCompatible: true,
      },
    ];

    for (const expected of expectedProviders) {
      describe(expected.name, () => {
        it("should be registered", () => {
          expect(hasProvider(expected.id)).toBe(true);
        });

        it("should have correct configuration", () => {
          const provider = getProvider(expected.id)!;
          expect(provider.name).toBe(expected.name);
          expect(provider.envKeys).toEqual(expected.envKeys);
          expect(provider.authStyle).toBe(expected.authStyle);
          expect(provider.openaiCompatible).toBe(expected.openaiCompatible);
        });

        it("should have a base URL", () => {
          const provider = getProvider(expected.id)!;
          expect(provider.baseUrl).toBeTruthy();
          expect(provider.baseUrl.startsWith("http")).toBe(true);
        });

        it("should have a docs URL", () => {
          const provider = getProvider(expected.id)!;
          expect(provider.docsUrl).toBeTruthy();
          expect(provider.docsUrl.startsWith("http")).toBe(true);
        });
      });
    }
  });

  describe("listProviders", () => {
    it("should return at least 8 built-in providers", () => {
      const all = listProviders();
      expect(all.length).toBeGreaterThanOrEqual(8);
    });

    it("should return provider objects with all required fields", () => {
      const all = listProviders();
      for (const provider of all) {
        expect(provider.id).toBeTruthy();
        expect(provider.name).toBeTruthy();
        expect(provider.envKeys.length).toBeGreaterThan(0);
        expect(provider.baseUrl).toBeTruthy();
        expect(provider.docsUrl).toBeTruthy();
        expect(["x-api-key", "bearer", "query-param"]).toContain(provider.authStyle);
      }
    });

    it("should have unique provider IDs", () => {
      const all = listProviders();
      const ids = all.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("Custom provider registration", () => {
    it("should register a new custom provider", () => {
      registerProvider({
        id: "test-custom-llm",
        name: "Test Custom LLM",
        envKeys: ["TEST_CUSTOM_LLM_KEY"],
        baseUrl: "http://localhost:9999",
        docsUrl: "https://example.com/docs",
        authStyle: "bearer",
        openaiCompatible: true,
      });

      expect(hasProvider("test-custom-llm")).toBe(true);
      const provider = getProvider("test-custom-llm")!;
      expect(provider.name).toBe("Test Custom LLM");
      expect(provider.openaiCompatible).toBe(true);
    });

    it("should allow overriding a built-in provider", () => {
      const originalOpenai = getProvider("openai")!;
      const originalBaseUrl = originalOpenai.baseUrl;

      registerProvider({
        ...originalOpenai,
        baseUrl: "https://my-openai-proxy.com",
      });

      const overridden = getProvider("openai")!;
      expect(overridden.baseUrl).toBe("https://my-openai-proxy.com");
      expect(overridden.name).toBe("OpenAI");

      // Restore original
      registerProvider({
        ...overridden,
        baseUrl: originalBaseUrl,
      });
    });

    it("should include custom providers in listProviders", () => {
      registerProvider({
        id: "test-listed-provider",
        name: "Test Listed Provider",
        envKeys: ["TEST_LISTED_KEY"],
        baseUrl: "http://localhost:7777",
        docsUrl: "https://example.com",
        authStyle: "bearer",
      });

      const all = listProviders();
      const ids = all.map((p) => p.id);
      expect(ids).toContain("test-listed-provider");
    });
  });

  describe("DEFAULT_FALLBACK_ORDER", () => {
    it("should include all built-in providers", () => {
      expect(DEFAULT_FALLBACK_ORDER).toContain("anthropic");
      expect(DEFAULT_FALLBACK_ORDER).toContain("openai");
      expect(DEFAULT_FALLBACK_ORDER).toContain("openrouter");
      expect(DEFAULT_FALLBACK_ORDER).toContain("google");
      expect(DEFAULT_FALLBACK_ORDER).toContain("groq");
    });

    it("should have anthropic first (most common for agentic CLIs)", () => {
      expect(DEFAULT_FALLBACK_ORDER[0]).toBe("anthropic");
    });

    it("should have no duplicates", () => {
      const unique = new Set(DEFAULT_FALLBACK_ORDER);
      expect(unique.size).toBe(DEFAULT_FALLBACK_ORDER.length);
    });
  });
});
