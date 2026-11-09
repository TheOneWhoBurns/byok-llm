// ============================================================
// byok-llm — Basic Usage Examples
// ============================================================
// Run: npx tsx examples/basic-usage.ts

import {
  init,
  resolveKey,
  resolveWithFallback,
  getOpenAICompatibleConfig,
  getProviderHeaders,
  getProviderBaseUrl,
  printStatus,
  setupWizard,
  validateKey,
  registerProvider,
} from "../src/index.js";

// ─────────────────────────────────────────────
// Example 1: Simplest possible usage
// ─────────────────────────────────────────────
async function example1_simple() {
  // One-liner: find a provider, run wizard if needed
  const provider = await init({
    providers: ["anthropic", "openai", "openrouter"],
    appName: "my-cool-cli",
  });

  if (!provider) {
    console.log("No AI provider configured. Exiting.");
    return;
  }

  console.log(`Using ${provider.providerId} (key from: ${provider.source})`);

  // Use with fetch directly
  const response = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      ...provider.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{ role: "user", content: "Hello!" }],
    }),
  });
}

// ─────────────────────────────────────────────
// Example 2: Use with OpenAI SDK (works for OpenRouter, Groq, xAI, etc.)
// ─────────────────────────────────────────────
async function example2_openai_sdk() {
  // import OpenAI from 'openai';
  const config = await getOpenAICompatibleConfig("openrouter");
  // const client = new OpenAI(config);  // That's it!
  console.log("OpenAI-compatible config:", {
    baseURL: config.baseURL,
    apiKey: config.apiKey.slice(0, 8) + "...",
  });
}

// ─────────────────────────────────────────────
// Example 3: Fallback across providers
// ─────────────────────────────────────────────
async function example3_fallback() {
  // Try Anthropic first, then OpenAI, then OpenRouter
  const provider = await resolveWithFallback(["anthropic", "openai", "openrouter"]);

  if (provider) {
    console.log(`Best available provider: ${provider.providerId}`);
  } else {
    console.log("No provider available! Run the setup wizard.");
    await setupWizard({
      providers: ["anthropic", "openai", "openrouter"],
      appName: "my-app",
    });
  }
}

// ─────────────────────────────────────────────
// Example 4: Register a custom provider
// ─────────────────────────────────────────────
async function example4_custom_provider() {
  // Register a self-hosted or custom provider
  registerProvider({
    id: "my-ollama",
    name: "Local Ollama",
    envKeys: ["OLLAMA_API_KEY"],
    baseUrl: "http://localhost:11434",
    docsUrl: "https://ollama.ai",
    authStyle: "bearer",
    openaiCompatible: true,
  });

  // Now it works like any built-in provider
  const key = await resolveKey("my-ollama");
  console.log("Ollama key:", key);
}

// ─────────────────────────────────────────────
// Example 5: Show status of all providers
// ─────────────────────────────────────────────
async function example5_status() {
  await printStatus();
}

// ─────────────────────────────────────────────
// Example 6: Validate a key before using it
// ─────────────────────────────────────────────
async function example6_validate() {
  const result = await validateKey("openai", "sk-test-key-here");
  if (result.valid) {
    console.log("Key is valid!", result.meta);
  } else {
    console.log("Key is invalid:", result.error);
  }
}

// Run the status example by default
example5_status();
