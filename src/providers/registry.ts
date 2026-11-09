// ============================================================
// byok-llm — Provider Registry
// ============================================================

import type { ProviderDefinition, ProviderId } from "../types.js";
import { anthropic } from "./anthropic.js";
import { openai } from "./openai.js";
import { openrouter } from "./openrouter.js";
import { google } from "./google.js";
import { groq } from "./groq.js";
import { xai } from "./xai.js";
import { mistral } from "./mistral.js";
import { deepseek } from "./deepseek.js";

/** Internal registry map */
const registry = new Map<string, ProviderDefinition>();

/** Register all built-in providers */
function registerBuiltins(): void {
  for (const provider of [anthropic, openai, openrouter, google, groq, xai, mistral, deepseek]) {
    registry.set(provider.id, provider);
  }
}

// Auto-register on import
registerBuiltins();

/**
 * Register a custom provider (or override a built-in one).
 */
export function registerProvider(definition: ProviderDefinition): void {
  registry.set(definition.id, definition);
}

/**
 * Get a provider definition by ID.
 */
export function getProvider(id: ProviderId): ProviderDefinition | undefined {
  return registry.get(id);
}

/**
 * List all registered providers.
 */
export function listProviders(): ProviderDefinition[] {
  return Array.from(registry.values());
}

/**
 * Check if a provider is registered.
 */
export function hasProvider(id: ProviderId): boolean {
  return registry.has(id);
}

/**
 * Default fallback order (most common providers first).
 */
export const DEFAULT_FALLBACK_ORDER: ProviderId[] = [
  "anthropic",
  "openai",
  "openrouter",
  "google",
  "groq",
  "xai",
  "mistral",
  "deepseek",
];
