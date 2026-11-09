// ============================================================
// byok-llm — Environment Variable Helpers
// ============================================================

import type { ProviderId } from "../types.js";
import { getProvider, listProviders } from "../providers/registry.js";

/**
 * Check if a provider has its API key set via environment variable.
 */
export function hasEnvKey(providerId: ProviderId): boolean {
  const provider = getProvider(providerId);
  if (!provider) return false;
  return provider.envKeys.some((key) => !!process.env[key]);
}

/**
 * Get the env var value for a provider (checks all registered env var names).
 */
export function getEnvKey(providerId: ProviderId): string | null {
  const provider = getProvider(providerId);
  if (!provider) return null;

  for (const key of provider.envKeys) {
    const value = process.env[key];
    if (value) return value;
  }

  return null;
}

/**
 * Get the primary env var name for a provider (for display/docs).
 */
export function getEnvVarName(providerId: ProviderId): string | null {
  const provider = getProvider(providerId);
  if (!provider) return null;
  return provider.envKeys[0] || null;
}

/**
 * Generate a .env template string with all providers.
 */
export function generateEnvTemplate(providerIds?: ProviderId[]): string {
  const providers = providerIds
    ? providerIds.map((id) => getProvider(id)).filter(Boolean)
    : listProviders();

  const lines: string[] = [
    "# byok-ai — API Keys",
    "# Add your API keys below. You only need keys for providers you want to use.",
    "",
  ];

  for (const provider of providers) {
    if (!provider) continue;
    lines.push(`# ${provider.name} — Get a key at: ${provider.docsUrl}`);
    for (const envKey of provider.envKeys) {
      lines.push(`# ${envKey}=`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
