// ============================================================
// byok-llm — Key Resolution Engine
// ============================================================

import type {
  ByokConfig,
  ByokOptions,
  ProviderId,
  ResolvedKey,
  ResolvedProvider,
  ProviderConfig,
} from "../types.js";
import { getProvider, listProviders, DEFAULT_FALLBACK_ORDER } from "../providers/registry.js";
import { loadConfig } from "./loader.js";
import { getKey } from "../storage/file.js";
import { buildAuthHeaders, getEffectiveBaseUrl } from "./helpers.js";

/** Cached merged config */
let cachedConfig: ByokConfig | null = null;
let cachedOptions: ByokOptions | null = null;

/**
 * Initialize / reset the config cache. Call this if you change options at runtime.
 */
export function initConfig(options?: ByokOptions): ByokConfig {
  const { config } = loadConfig(options?.configPath, { noUserConfig: options?.noUserConfig });

  // Merge runtime provider overrides
  if (options?.providers) {
    if (!config.providers) config.providers = {};
    for (const [id, providerOpts] of Object.entries(options.providers)) {
      config.providers[id] = { ...config.providers[id], ...providerOpts };
    }
  }

  cachedConfig = config;
  cachedOptions = options || null;
  return config;
}

/**
 * Get the current config (loads if needed).
 */
export function getConfig(): ByokConfig {
  if (!cachedConfig) {
    return initConfig(cachedOptions || undefined);
  }
  return cachedConfig;
}

/**
 * Resolve an API key for a provider, checking all layers.
 *
 * Resolution order (first match wins):
 * 1. The `runtimeKey` argument
 * 2. `apiKey` from the merged config: options passed to init()/initConfig(),
 *    then a custom config path, then project config, then user config.
 *    Reported with source "runtime" whichever layer it came from.
 * 3. Environment variables
 * 4. Stored keys (~/.config/byok-ai/keys.json), reported as "user-config"
 *
 * Returns null for unknown or disabled providers.
 */
export async function resolveKey(
  providerId: ProviderId,
  runtimeKey?: string,
): Promise<ResolvedKey | null> {
  const provider = getProvider(providerId);
  if (!provider) return null;

  const config = getConfig();
  const providerConfig: ProviderConfig | undefined = config.providers?.[providerId];

  // Check if provider is explicitly disabled
  if (providerConfig?.disabled) return null;

  // 1. Runtime key (highest priority)
  if (runtimeKey) {
    return { key: runtimeKey, source: "runtime", providerId };
  }

  // 2. Runtime config
  if (providerConfig?.apiKey) {
    return {
      key: providerConfig.apiKey,
      source: "runtime",
      providerId,
    };
  }

  // 3. Environment variables
  for (const envKey of provider.envKeys) {
    const value = process.env[envKey];
    if (value) {
      return { key: value, source: "env", providerId, envVar: envKey };
    }
  }

  // 4. Stored keys file
  const storedKey = await getKey(providerId);
  if (storedKey) {
    return { key: storedKey, source: "user-config", providerId };
  }

  return null;
}

/**
 * Try to resolve a working provider from a list, in order.
 * Returns the first provider that has a configured key.
 */
export async function resolveWithFallback(
  providerIds?: ProviderId[],
): Promise<ResolvedProvider | null> {
  const order = providerIds || getConfig().fallbackOrder || DEFAULT_FALLBACK_ORDER;

  for (const id of order) {
    const provider = getProvider(id);
    if (!provider) continue;

    const resolved = await resolveKey(id);
    if (!resolved) continue;

    const config = getConfig();
    const providerConfig = config.providers?.[id];

    return {
      providerId: id,
      key: resolved.key,
      source: resolved.source,
      baseUrl: getEffectiveBaseUrl(id, providerConfig),
      headers: buildAuthHeaders(provider, resolved.key, providerConfig),
    };
  }

  return null;
}

/**
 * Get all providers that currently have keys configured.
 */
export async function getConfiguredProviders(): Promise<ResolvedKey[]> {
  const results: ResolvedKey[] = [];

  for (const provider of listProviders()) {
    const resolved = await resolveKey(provider.id);
    if (resolved) {
      results.push(resolved);
    }
  }

  return results;
}
