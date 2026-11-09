// ============================================================
// byok-llm — Basic Usage Examples
// ============================================================
// Run from the repository root: npx tsx examples/basic-usage.ts
//
// Only the status example runs by default (see the bottom of the file).
// The others are here to read; examples 1 and 6 make network requests.

import {
  init,
  resolveKey,
  resolveWithFallback,
  getOpenAICompatibleConfig,
  printStatus,
  setupWizard,
  validateKey,
  registerProvider,
} from "../src/index.js";

// ─────────────────────────────────────────────
// Example 1: Find a key (or ask for one) and call the provider with fetch
// ─────────────────────────────────────────────
export async function example1_simple() {
  // Returns the provider if it has a key; otherwise runs the wizard when attached to a terminal.
  const provider = await init({
    providers: ["anthropic"],
    appName: "my-cool-cli",
  });

  if (!provider) {
    console.log("No Anthropic API key configured. Exiting.");
    return;
  }

  console.log(`Using ${provider.providerId} (key from: ${provider.source})`);

  // provider.baseUrl is the API root; the path and body are Anthropic's Messages API.
  const response = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      ...provider.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-5-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: "Hello!" }],
    }),
  });

  console.log("Status:", response.status);
}

// ─────────────────────────────────────────────
// Example 2: Use with the OpenAI SDK (OpenAI, OpenRouter, Groq, xAI, Mistral, DeepSeek)
// ─────────────────────────────────────────────
export async function example2_openai_sdk() {
  // import OpenAI from "openai";
  const config = await getOpenAICompatibleConfig("openrouter");
  // const client = new OpenAI(config);
  console.log("OpenAI-compatible config:", {
    baseURL: config.baseURL, // https://openrouter.ai/api/v1
    apiKey: config.apiKey.slice(0, 6) + "...",
  });
}

// ─────────────────────────────────────────────
// Example 3: First provider in a list that has a key
// ─────────────────────────────────────────────
export async function example3_fallback() {
  const order = ["anthropic", "openai", "openrouter"];
  const provider = await resolveWithFallback(order);

  if (provider) {
    console.log(`First configured provider: ${provider.providerId}`);
  } else {
    console.log("No provider configured. Starting the setup wizard.");
    await setupWizard({ providers: order, appName: "my-app" });
  }
}

// ─────────────────────────────────────────────
// Example 4: Register a custom provider
// ─────────────────────────────────────────────
export async function example4_custom_provider() {
  registerProvider({
    id: "local-llm",
    name: "Local server",
    envKeys: ["LOCAL_LLM_API_KEY"],
    baseUrl: "http://localhost:8080",
    docsUrl: "https://example.com/how-to-get-a-key",
    authStyle: "bearer",
    openaiCompatible: true,
  });

  // It now resolves like any built-in provider.
  const resolved = await resolveKey("local-llm");
  console.log("Local key configured:", resolved !== null);
}

// ─────────────────────────────────────────────
// Example 5: Show which providers are configured
// ─────────────────────────────────────────────
export async function example5_status() {
  await printStatus();
}

// ─────────────────────────────────────────────
// Example 6: Validate a key before storing or using it
// ─────────────────────────────────────────────
export async function example6_validate() {
  const result = await validateKey("openai", "sk-your-key-here");
  if (!result.valid) {
    console.log("Key rejected:", result.error);
  } else if (result.meta?.warning) {
    console.log("Key not verified:", result.meta.warning);
  } else {
    console.log("Key is valid.");
  }
}

// Run the status example by default
example5_status();
