// ============================================================
// byok-llm — Bring Your Own Key for AI-Powered Apps
// ============================================================
//
// A lightweight, zero-dependency module for managing API keys
// across multiple AI providers. Built for CLI tools and agentic apps.
//
// Usage:
//   import { resolveKey, setupWizard } from 'byok-llm';
//
//   // First run: walk the user through key setup
//   await setupWizard({ providers: ['anthropic', 'openrouter'], appName: 'my-app' });
//
//   // Every run: resolve keys automatically
//   const key = await resolveKey('anthropic');
//
// ============================================================

// --- Types ---
export type {
  BuiltinProviderId,
  ProviderId,
  AuthStyle,
  ProviderDefinition,
  KeySource,
  ResolvedKey,
  ValidationResult,
  ResolvedProvider,
  ProviderConfig,
  ByokConfig,
  ProviderStatus,
  StatusReport,
  WizardOptions,
  OpenAICompatibleConfig,
  ByokOptions,
} from "./types.js";

// --- Provider Registry ---
export {
  registerProvider,
  getProvider,
  listProviders,
  hasProvider,
  DEFAULT_FALLBACK_ORDER,
} from "./providers/registry.js";

// --- Config Resolution ---
export {
  initConfig,
  resolveKey,
  resolveWithFallback,
  getConfiguredProviders,
  getConfig,
} from "./config/resolver.js";

// --- Config Helpers ---
export {
  getProviderHeaders,
  getProviderBaseUrl,
  getOpenAICompatibleConfig,
} from "./config/helpers.js";

// --- Config Loader ---
export { getUserConfigPath, getKeysStorePath } from "./config/loader.js";

// --- Key Validation ---
export { validateKey, validateKeyFormat, validateAllKeys } from "./validation/validator.js";

// --- Key Storage ---
export { storeKey, getKey, removeKey, listStoredKeys, clearAllKeys } from "./storage/file.js";

// --- Environment Helpers ---
export { hasEnvKey, getEnvKey, getEnvVarName, generateEnvTemplate } from "./storage/env.js";

// --- UI ---
export { setupWizard } from "./ui/setup-wizard.js";
export { getStatus, printStatus } from "./ui/status.js";

// --- Convenience: Quick setup for common patterns ---

import type { ByokOptions, ProviderId, ResolvedProvider } from "./types.js";
import { initConfig, resolveWithFallback } from "./config/resolver.js";
import { setupWizard } from "./ui/setup-wizard.js";

/**
 * All-in-one initialization: loads config, checks for keys,
 * and optionally runs the setup wizard if no keys are found.
 *
 * @example
 * ```typescript
 * import { init } from 'byok-llm';
 *
 * const provider = await init({
 *   providers: ['anthropic', 'openai', 'openrouter'],
 *   appName: 'my-cli-tool',
 * });
 *
 * // provider.key, provider.baseUrl, provider.headers are ready to use
 * ```
 */
export async function init(
  options: ByokOptions & {
    /** Providers to check (in fallback order) */
    providers?: ProviderId[];
    /** App name for wizard prompts */
    appName?: string;
    /** Run wizard if no keys found (default: true) */
    interactive?: boolean;
  } = {},
): Promise<ResolvedProvider | null> {
  const { providers, appName, interactive = true, ...byokOptions } = options;

  // Load config
  initConfig(byokOptions);

  // Try to resolve a provider
  let resolved = await resolveWithFallback(providers);

  // If no provider found and interactive mode, run wizard
  if (!resolved && interactive && process.stdin.isTTY) {
    await setupWizard({
      providers,
      appName,
    });

    // Try again after wizard
    resolved = await resolveWithFallback(providers);
  }

  return resolved;
}
