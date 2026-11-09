// ============================================================
// byok-ai — Auth & URL Helpers
// ============================================================

import type {
  OpenAICompatibleConfig,
  ProviderConfig,
  ProviderDefinition,
  ProviderId,
} from "../types.js";
import { getProvider } from "../providers/registry.js";
import { resolveKey } from "./resolver.js";
import { getConfig } from "./resolver.js";

/**
 * Build authentication headers for a provider.
 */
export function buildAuthHeaders(
  provider: ProviderDefinition,
  key: string,
  providerConfig?: ProviderConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Auth header
  switch (provider.authStyle) {
    case "x-api-key":
      headers[provider.authHeader || "x-api-key"] = key;
      break;
    case "bearer":
      headers["Authorization"] = `Bearer ${key}`;
      break;
    case "query-param":
      // Handled at URL level, not headers
      break;
  }

  // Default provider headers (e.g. anthropic-version)
  if (provider.defaultHeaders) {
    Object.assign(headers, provider.defaultHeaders);
  }

  // Custom headers from config
  if (providerConfig?.headers) {
    Object.assign(headers, providerConfig.headers);
  }

  return headers;
}

/**
 * Get the effective base URL for a provider (config override or default).
 */
export function getEffectiveBaseUrl(
  providerId: ProviderId,
  providerConfig?: ProviderConfig,
): string {
  if (providerConfig?.baseUrl) return providerConfig.baseUrl;
  const provider = getProvider(providerId);
  return provider?.baseUrl || "";
}

/**
 * Get auth headers for a provider (resolves key automatically).
 */
export async function getProviderHeaders(providerId: ProviderId): Promise<Record<string, string>> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const resolved = await resolveKey(providerId);
  if (!resolved) {
    throw new Error(
      `No API key configured for ${provider.name}. ` +
        `Set ${provider.envKeys[0]} or run the setup wizard.`,
    );
  }

  const config = getConfig();
  const providerConfig = config.providers?.[providerId];
  return buildAuthHeaders(provider, resolved.key, providerConfig);
}

/**
 * Get the base URL for a provider.
 */
export function getProviderBaseUrl(providerId: ProviderId): string {
  const config = getConfig();
  const providerConfig = config.providers?.[providerId];
  return getEffectiveBaseUrl(providerId, providerConfig);
}

/**
 * Get a config object compatible with the OpenAI SDK.
 * Works for: openai, openrouter, groq, xai, mistral, deepseek, and any
 * other provider marked as openaiCompatible.
 */
export async function getOpenAICompatibleConfig(
  providerId: ProviderId,
): Promise<OpenAICompatibleConfig> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const resolved = await resolveKey(providerId);
  if (!resolved) {
    throw new Error(
      `No API key configured for ${provider.name}. ` +
        `Set ${provider.envKeys[0]} or run the setup wizard.`,
    );
  }

  const config = getConfig();
  const providerConfig = config.providers?.[providerId];

  const result: OpenAICompatibleConfig = {
    apiKey: resolved.key,
    baseURL: getEffectiveBaseUrl(providerId, providerConfig),
  };

  // Merge default + custom headers
  const extraHeaders = {
    ...provider.defaultHeaders,
    ...providerConfig?.headers,
  };

  if (Object.keys(extraHeaders).length > 0) {
    result.defaultHeaders = extraHeaders;
  }

  return result;
}

/**
 * Build a full URL for a provider endpoint, handling query-param auth.
 */
export function buildUrl(
  provider: ProviderDefinition,
  endpoint: string,
  key?: string,
  providerConfig?: ProviderConfig,
): string {
  const base = providerConfig?.baseUrl || provider.baseUrl;

  // Join the paths by hand: `new URL("/v1/models", base)` would discard any path
  // the base URL carries (e.g. "/openai" for Groq, "/api" for OpenRouter).
  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint)
    ? new URL(endpoint)
    : new URL(`${base.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`);

  if (provider.authStyle === "query-param" && key) {
    url.searchParams.set("key", key);
  }

  return url.toString();
}
