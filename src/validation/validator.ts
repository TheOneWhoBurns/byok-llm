// ============================================================
// byok-llm — Key Validation
// ============================================================

import type { ProviderId, ValidationResult } from "../types.js";
import { getProvider } from "../providers/registry.js";
import { buildAuthHeaders, buildUrl } from "../config/helpers.js";
import { resolveKey } from "../config/resolver.js";

/**
 * Validate a key's format (prefix check).
 */
export function validateKeyFormat(providerId: ProviderId, key: string): ValidationResult {
  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, error: `Unknown provider: ${providerId}` };
  }

  if (!key || key.trim().length === 0) {
    return { valid: false, error: "Key is empty" };
  }

  // Check prefix if defined
  if (provider.keyPrefix) {
    const prefixes = Array.isArray(provider.keyPrefix) ? provider.keyPrefix : [provider.keyPrefix];

    const hasValidPrefix = prefixes.some((p) => key.startsWith(p));
    if (!hasValidPrefix) {
      return {
        valid: false,
        error: `Key should start with ${prefixes.join(" or ")} for ${provider.name}`,
      };
    }
  }

  // Basic length check
  if (key.length < 10) {
    return { valid: false, error: "Key seems too short" };
  }

  return { valid: true };
}

const networkErrorCodes = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function hasNetworkErrorCode(error: unknown, depth = 2): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && typeof error.code === "string" && networkErrorCodes.has(error.code)) {
    return true;
  }
  if (depth === 0) return false;
  if ("cause" in error && hasNetworkErrorCode(error.cause, depth - 1)) return true;
  return (
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors.some((nested: unknown) => hasNetworkErrorCode(nested, depth - 1))
  );
}

/**
 * Validate a key by making a lightweight API call.
 * This hits a read-only endpoint (like listing models) to verify the key works.
 */
export async function validateKey(providerId: ProviderId, key: string): Promise<ValidationResult> {
  // First, format check
  const formatResult = validateKeyFormat(providerId, key);
  if (!formatResult.valid) return formatResult;

  const provider = getProvider(providerId);
  if (!provider) {
    return { valid: false, error: `Unknown provider: ${providerId}` };
  }

  // If no validation endpoint, just trust the format check
  if (!provider.validateEndpoint) {
    return { valid: true };
  }

  try {
    const url = buildUrl(provider, provider.validateEndpoint, key);
    const headers = buildAuthHeaders(provider, key);
    headers["Content-Type"] = "application/json";

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (response.ok) {
      // Try to extract useful metadata
      const meta: Record<string, unknown> = {};

      try {
        const data = (await response.json()) as Record<string, unknown>;

        // OpenRouter returns key info with usage data
        if (providerId === "openrouter" && data?.data) {
          const d = data.data as Record<string, unknown>;
          meta.usage = d.usage;
          meta.limit = d.limit;
          meta.label = d.label;
        }
      } catch {
        // JSON parsing failed, but status was OK so key is valid
      }

      return { valid: true, meta: Object.keys(meta).length > 0 ? meta : undefined };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid API key (authentication failed)" };
    }

    if (response.status === 429) {
      // Rate limited but key is valid
      return {
        valid: true,
        meta: { warning: "Rate limited — key is valid but currently throttled" },
      };
    }

    return {
      valid: false,
      error: `Validation failed with status ${response.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Timeout or network error — don't assume key is invalid
    if (
      (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) ||
      hasNetworkErrorCode(err) ||
      message.includes("timeout") ||
      message.includes("ENOTFOUND")
    ) {
      return {
        valid: true,
        meta: { warning: "Could not reach provider API to validate (network issue)" },
      };
    }

    return { valid: false, error: `Validation error: ${message}` };
  }
}

/**
 * Validate all currently configured keys.
 */
export async function validateAllKeys(): Promise<Record<string, ValidationResult>> {
  const { listProviders } = await import("../providers/registry.js");
  const results: Record<string, ValidationResult> = {};

  const providers = listProviders();

  // Run validations in parallel
  const promises = providers.map(async (provider) => {
    const resolved = await resolveKey(provider.id);
    if (!resolved) {
      results[provider.id] = { valid: false, error: "No key configured" };
      return;
    }
    results[provider.id] = await validateKey(provider.id, resolved.key);
  });

  await Promise.all(promises);
  return results;
}
