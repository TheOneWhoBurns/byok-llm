import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const configHome = mkdtempSync(join(tmpdir(), "byok-llm-test-"));
process.env.XDG_CONFIG_HOME = configHome;

for (const name of [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "XAI_API_KEY",
  "MISTRAL_API_KEY",
  "DEEPSEEK_API_KEY",
]) {
  delete process.env[name];
}

afterAll(() => {
  rmSync(configHome, { recursive: true, force: true });
});
