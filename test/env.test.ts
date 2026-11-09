import { describe, it, expect, afterEach } from "vitest";
import { hasEnvKey, getEnvKey, getEnvVarName, generateEnvTemplate } from "../src/storage/env.js";

describe("Environment Variable Helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("hasEnvKey", () => {
    it("should return true when env var is set", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-123456";
      expect(hasEnvKey("anthropic")).toBe(true);
    });

    it("should return false when env var is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(hasEnvKey("anthropic")).toBe(false);
    });

    it("should return false for unknown providers", () => {
      expect(hasEnvKey("nonexistent-provider")).toBe(false);
    });

    it("should check secondary env var names (Google)", () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = "google-secondary-key";
      expect(hasEnvKey("google")).toBe(true);
    });

    it("should return true for primary env var (Google)", () => {
      process.env.GEMINI_API_KEY = "gemini-primary-key";
      delete process.env.GOOGLE_API_KEY;
      expect(hasEnvKey("google")).toBe(true);
    });
  });

  describe("getEnvKey", () => {
    it("should return the env var value", () => {
      process.env.OPENAI_API_KEY = "sk-get-env-test-12345";
      expect(getEnvKey("openai")).toBe("sk-get-env-test-12345");
    });

    it("should return null when not set", () => {
      delete process.env.OPENAI_API_KEY;
      expect(getEnvKey("openai")).toBeNull();
    });

    it("should prefer first env var name", () => {
      process.env.GEMINI_API_KEY = "gemini-first-key";
      process.env.GOOGLE_API_KEY = "google-second-key";
      // Should return the first one (GEMINI_API_KEY)
      expect(getEnvKey("google")).toBe("gemini-first-key");
    });

    it("should fall back to second env var name", () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = "google-fallback-key";
      expect(getEnvKey("google")).toBe("google-fallback-key");
    });

    it("should return null for unknown providers", () => {
      expect(getEnvKey("nonexistent")).toBeNull();
    });
  });

  describe("getEnvVarName", () => {
    it("should return primary env var name for each provider", () => {
      expect(getEnvVarName("anthropic")).toBe("ANTHROPIC_API_KEY");
      expect(getEnvVarName("openai")).toBe("OPENAI_API_KEY");
      expect(getEnvVarName("openrouter")).toBe("OPENROUTER_API_KEY");
      expect(getEnvVarName("google")).toBe("GEMINI_API_KEY");
      expect(getEnvVarName("groq")).toBe("GROQ_API_KEY");
      expect(getEnvVarName("xai")).toBe("XAI_API_KEY");
      expect(getEnvVarName("mistral")).toBe("MISTRAL_API_KEY");
      expect(getEnvVarName("deepseek")).toBe("DEEPSEEK_API_KEY");
    });

    it("should return null for unknown providers", () => {
      expect(getEnvVarName("fake")).toBeNull();
    });
  });

  describe("generateEnvTemplate", () => {
    it("should generate a template with all providers", () => {
      const template = generateEnvTemplate();
      expect(template).toContain("ANTHROPIC_API_KEY");
      expect(template).toContain("OPENAI_API_KEY");
      expect(template).toContain("OPENROUTER_API_KEY");
      expect(template).toContain("GEMINI_API_KEY");
      expect(template).toContain("GROQ_API_KEY");
    });

    it("should generate a template for specific providers", () => {
      const template = generateEnvTemplate(["anthropic", "openrouter"]);
      expect(template).toContain("ANTHROPIC_API_KEY");
      expect(template).toContain("OPENROUTER_API_KEY");
      expect(template).not.toContain("OPENAI_API_KEY");
    });

    it("should include docs URLs as comments", () => {
      const template = generateEnvTemplate(["anthropic"]);
      expect(template).toContain("console.anthropic.com");
    });

    it("should include header comment", () => {
      const template = generateEnvTemplate();
      expect(template).toContain("byok-llm");
      expect(template).toContain("API Keys");
    });
  });
});
