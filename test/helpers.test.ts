import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getProviderHeaders,
  getProviderBaseUrl,
  getOpenAICompatibleConfig,
} from "../src/config/helpers.js";
import { buildAuthHeaders, buildUrl } from "../src/config/helpers.js";
import { getProvider, registerProvider } from "../src/providers/registry.js";
import { initConfig } from "../src/config/resolver.js";
import type { ProviderDefinition } from "../src/types.js";

const queryParamProvider: ProviderDefinition = {
  id: "query-param-provider",
  name: "Query-param provider",
  envKeys: ["QUERY_PARAM_PROVIDER_KEY"],
  baseUrl: "https://query.example.com",
  docsUrl: "https://example.com/docs",
  authStyle: "query-param",
};

describe("Auth & URL Helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    initConfig({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("buildAuthHeaders", () => {
    it("should build x-api-key headers for Anthropic", () => {
      const provider = getProvider("anthropic")!;
      const headers = buildAuthHeaders(provider, "sk-ant-test-key-123456");

      expect(headers["x-api-key"]).toBe("sk-ant-test-key-123456");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("should build Bearer headers for OpenAI", () => {
      const provider = getProvider("openai")!;
      const headers = buildAuthHeaders(provider, "sk-test-key-123456789");

      expect(headers["Authorization"]).toBe("Bearer sk-test-key-123456789");
      expect(headers["x-api-key"]).toBeUndefined();
    });

    it("should build Bearer headers for OpenRouter", () => {
      const provider = getProvider("openrouter")!;
      const headers = buildAuthHeaders(provider, "sk-or-test-key-123456");

      expect(headers["Authorization"]).toBe("Bearer sk-or-test-key-123456");
    });

    it("should build Bearer headers for Groq", () => {
      const provider = getProvider("groq")!;
      const headers = buildAuthHeaders(provider, "gsk_test-key-1234567890");

      expect(headers["Authorization"]).toBe("Bearer gsk_test-key-1234567890");
    });

    it("should send Google keys in the x-goog-api-key header", () => {
      const provider = getProvider("google")!;
      const headers = buildAuthHeaders(provider, "AIzaSyC-test-key-123");

      expect(headers).toEqual({ "x-goog-api-key": "AIzaSyC-test-key-123" });
    });

    it("should not set auth headers for query-param style", () => {
      const headers = buildAuthHeaders(queryParamProvider, "query-key-1234567890");

      expect(headers).toEqual({});
    });

    it("should merge custom headers from config", () => {
      const provider = getProvider("openai")!;
      const headers = buildAuthHeaders(provider, "sk-test-key-123456789", {
        headers: {
          "X-Custom-Header": "custom-value",
          "OpenAI-Organization": "org-12345",
        },
      });

      expect(headers["Authorization"]).toBe("Bearer sk-test-key-123456789");
      expect(headers["X-Custom-Header"]).toBe("custom-value");
      expect(headers["OpenAI-Organization"]).toBe("org-12345");
    });
  });

  describe("buildUrl", () => {
    it("should build a full URL for bearer-auth providers", () => {
      const provider = getProvider("openai")!;
      const url = buildUrl(provider, "/v1/models", "sk-test");

      expect(url).toBe("https://api.openai.com/v1/models");
    });

    it("should append the key as a query parameter for query-param providers", () => {
      const url = buildUrl(queryParamProvider, "/v1/models", "query key/1+2");

      expect(url).toBe("https://query.example.com/v1/models?key=query+key%2F1%2B2");
    });

    // Regression: a key in the URL ends up in proxy and server logs.
    it("should keep Google keys out of the URL", () => {
      const provider = getProvider("google")!;
      const url = buildUrl(provider, "/v1beta/models", "AIzaSyC-test-key");

      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models");
    });

    it("should use custom baseUrl from config", () => {
      const provider = getProvider("openai")!;
      const url = buildUrl(provider, "/v1/models", "sk-test", {
        baseUrl: "https://my-proxy.com",
      });

      expect(url).toBe("https://my-proxy.com/v1/models");
    });

    // Regression: `new URL("/v1/models", "https://api.groq.com/openai")` drops "/openai".
    it("should keep the path prefix of the base URL", () => {
      expect(buildUrl(getProvider("groq")!, "/v1/models")).toBe(
        "https://api.groq.com/openai/v1/models",
      );
      expect(buildUrl(getProvider("openrouter")!, "/v1/key")).toBe(
        "https://openrouter.ai/api/v1/key",
      );
    });

    it("should keep the path prefix of a custom baseUrl from config", () => {
      const provider = getProvider("openai")!;
      const url = buildUrl(provider, "/v1/models", "sk-test", {
        baseUrl: "https://my-proxy.com/openai/",
      });

      expect(url).toBe("https://my-proxy.com/openai/v1/models");
    });

    it("should build the documented validation URL for every built-in provider", () => {
      const expected: Record<string, string> = {
        anthropic: "https://api.anthropic.com/v1/models",
        openai: "https://api.openai.com/v1/models",
        openrouter: "https://openrouter.ai/api/v1/key",
        google: "https://generativelanguage.googleapis.com/v1beta/models",
        groq: "https://api.groq.com/openai/v1/models",
        xai: "https://api.x.ai/v1/models",
        mistral: "https://api.mistral.ai/v1/models",
        deepseek: "https://api.deepseek.com/models",
      };

      for (const [id, url] of Object.entries(expected)) {
        const provider = getProvider(id)!;
        expect(buildUrl(provider, provider.validateEndpoint!)).toBe(url);
      }
    });

    it("should use an absolute endpoint URL as-is", () => {
      const provider = getProvider("openai")!;
      const url = buildUrl(provider, "https://status.example.com/v2/check");

      expect(url).toBe("https://status.example.com/v2/check");
    });
  });

  describe("getProviderBaseUrl", () => {
    it("should return default base URLs", () => {
      expect(getProviderBaseUrl("anthropic")).toBe("https://api.anthropic.com");
      expect(getProviderBaseUrl("openai")).toBe("https://api.openai.com");
      expect(getProviderBaseUrl("openrouter")).toBe("https://openrouter.ai/api");
      expect(getProviderBaseUrl("groq")).toBe("https://api.groq.com/openai");
      expect(getProviderBaseUrl("google")).toBe("https://generativelanguage.googleapis.com");
      expect(getProviderBaseUrl("xai")).toBe("https://api.x.ai");
      expect(getProviderBaseUrl("mistral")).toBe("https://api.mistral.ai");
      expect(getProviderBaseUrl("deepseek")).toBe("https://api.deepseek.com");
    });

    it("should return config override when set", () => {
      initConfig({
        providers: {
          openai: { baseUrl: "https://my-openai-proxy.com" },
        },
      });

      expect(getProviderBaseUrl("openai")).toBe("https://my-openai-proxy.com");
      // Others should be unaffected
      expect(getProviderBaseUrl("anthropic")).toBe("https://api.anthropic.com");
    });
  });

  describe("getProviderHeaders", () => {
    it("should resolve key and return headers", async () => {
      process.env.OPENAI_API_KEY = "sk-headers-test-key-123";

      const headers = await getProviderHeaders("openai");
      expect(headers["Authorization"]).toBe("Bearer sk-headers-test-key-123");
    });

    it("should throw when no key is configured", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      initConfig({});

      await expect(getProviderHeaders("anthropic")).rejects.toThrow(/No API key configured/);
    });

    it("should throw for unknown providers", async () => {
      await expect(getProviderHeaders("fake-provider")).rejects.toThrow(/Unknown provider/);
    });
  });

  describe("getOpenAICompatibleConfig", () => {
    it("should return OpenAI-compatible config for OpenRouter", async () => {
      process.env.OPENROUTER_API_KEY = "sk-or-compat-test-123456";

      const config = await getOpenAICompatibleConfig("openrouter");
      expect(config.apiKey).toBe("sk-or-compat-test-123456");
      expect(config.baseURL).toBe("https://openrouter.ai/api/v1");
    });

    it("should return OpenAI-compatible config for Groq", async () => {
      process.env.GROQ_API_KEY = "gsk_compat-test-key-1234567";

      const config = await getOpenAICompatibleConfig("groq");
      expect(config.apiKey).toBe("gsk_compat-test-key-1234567");
      expect(config.baseURL).toBe("https://api.groq.com/openai/v1");
    });

    // Regression: the OpenAI SDK requests `${baseURL}/chat/completions`, so the
    // baseURL must already include the version path. 1.0.0 returned the bare API
    // root, which 404s for every provider below except DeepSeek.
    it("should return a baseURL the OpenAI SDK can append paths to", async () => {
      const chatCompletionsUrls: Record<string, string> = {
        openai: "https://api.openai.com/v1/chat/completions",
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        groq: "https://api.groq.com/openai/v1/chat/completions",
        xai: "https://api.x.ai/v1/chat/completions",
        mistral: "https://api.mistral.ai/v1/chat/completions",
        deepseek: "https://api.deepseek.com/v1/chat/completions",
      };

      for (const [id, url] of Object.entries(chatCompletionsUrls)) {
        const provider = getProvider(id)!;
        process.env[provider.envKeys[0]] = "compat-test-key-1234567890";

        const config = await getOpenAICompatibleConfig(id);
        expect(`${config.baseURL}/chat/completions`).toBe(url);
      }
    });

    it("should leave getProviderBaseUrl as the API root for raw requests", async () => {
      process.env.GROQ_API_KEY = "gsk_compat-test-key-1234567";

      await getOpenAICompatibleConfig("groq");
      expect(getProviderBaseUrl("groq")).toBe("https://api.groq.com/openai");
      expect(getProviderBaseUrl("openai")).toBe("https://api.openai.com");
    });

    it("should append /v1 for a custom OpenAI-compatible provider", async () => {
      registerProvider({
        id: "compat-local",
        name: "Local server",
        envKeys: ["COMPAT_LOCAL_KEY"],
        baseUrl: "http://localhost:11434/",
        docsUrl: "https://example.com",
        authStyle: "bearer",
        openaiCompatible: true,
      });
      process.env.COMPAT_LOCAL_KEY = "local-key-1234567890";

      const config = await getOpenAICompatibleConfig("compat-local");
      expect(config.baseURL).toBe("http://localhost:11434/v1");
    });

    it("should not append /v1 when the provider baseUrl is already versioned", async () => {
      registerProvider({
        id: "compat-versioned",
        name: "Versioned gateway",
        envKeys: ["COMPAT_VERSIONED_KEY"],
        baseUrl: "https://gateway.example.com/openai/v2",
        docsUrl: "https://example.com",
        authStyle: "bearer",
        openaiCompatible: true,
      });
      process.env.COMPAT_VERSIONED_KEY = "versioned-key-1234567890";

      const config = await getOpenAICompatibleConfig("compat-versioned");
      expect(config.baseURL).toBe("https://gateway.example.com/openai/v2");
    });

    it("should not rewrite the baseURL of providers not marked openaiCompatible", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-compat-test-12345";

      const config = await getOpenAICompatibleConfig("anthropic");
      expect(config.baseURL).toBe("https://api.anthropic.com");
    });

    it("should pass a baseUrl override without a version through unchanged", async () => {
      process.env.OPENAI_API_KEY = "sk-baseurl-override-12345";

      initConfig({
        providers: {
          openai: { baseUrl: "https://gateway.example.com/account/openai" },
        },
      });

      const config = await getOpenAICompatibleConfig("openai");
      expect(config.baseURL).toBe("https://gateway.example.com/account/openai");
    });

    it("should include default headers for Anthropic", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-compat-test-12345";

      const config = await getOpenAICompatibleConfig("anthropic");
      expect(config.defaultHeaders).toBeDefined();
      expect(config.defaultHeaders!["anthropic-version"]).toBe("2023-06-01");
    });

    it("should use baseUrl override from config", async () => {
      process.env.OPENAI_API_KEY = "sk-baseurl-override-12345";

      initConfig({
        providers: {
          openai: { baseUrl: "https://custom-openai-proxy.com/v1" },
        },
      });

      const config = await getOpenAICompatibleConfig("openai");
      expect(config.baseURL).toBe("https://custom-openai-proxy.com/v1");
    });

    it("should throw when no key is configured", async () => {
      delete process.env.OPENAI_API_KEY;
      initConfig({});

      await expect(getOpenAICompatibleConfig("openai")).rejects.toThrow(/No API key configured/);
    });
  });
});
