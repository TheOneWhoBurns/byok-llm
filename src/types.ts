// ============================================================
// byok-llm — Types
// ============================================================

/** Supported built-in provider IDs */
export type BuiltinProviderId =
  "anthropic" | "openai" | "openrouter" | "google" | "groq" | "xai" | "mistral" | "deepseek";

/** Any provider ID (builtins + custom) */
export type ProviderId = BuiltinProviderId | (string & {});

/** How a provider authenticates requests */
export type AuthStyle = "x-api-key" | "bearer" | "query-param";

/** Definition of a provider */
export interface ProviderDefinition {
  /** Unique identifier, e.g. 'anthropic' */
  id: ProviderId;
  /** Human-readable name, e.g. 'Anthropic' */
  name: string;
  /** Environment variable names to check, in order */
  envKeys: string[];
  /** Expected key prefix for format validation (e.g. 'sk-ant-') */
  keyPrefix?: string | string[];
  /** Base URL for API requests */
  baseUrl: string;
  /** URL where users can get an API key */
  docsUrl: string;
  /** How this provider authenticates */
  authStyle: AuthStyle;
  /** Custom auth header name (default depends on authStyle) */
  authHeader?: string;
  /** Extra default headers to include */
  defaultHeaders?: Record<string, string>;
  /** Lightweight endpoint to validate a key (GET request) */
  validateEndpoint?: string;
  /** Whether this provider is OpenAI-SDK-compatible */
  openaiCompatible?: boolean;
}

/** Where a resolved key came from */
export type KeySource = "runtime" | "env" | "project-config" | "user-config";

/** A resolved API key with metadata */
export interface ResolvedKey {
  key: string;
  source: KeySource;
  providerId: ProviderId;
  envVar?: string;
}

/** Result of key validation */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Extra metadata from the provider (e.g. org name, remaining credits) */
  meta?: Record<string, unknown>;
}

/** Result of fallback resolution */
export interface ResolvedProvider {
  providerId: ProviderId;
  key: string;
  source: KeySource;
  baseUrl: string;
  headers: Record<string, string>;
}

/** Per-provider config in config files */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  disabled?: boolean;
  headers?: Record<string, string>;
}

/** Full byok-llm config file shape */
export interface ByokConfig {
  providers?: Record<string, ProviderConfig>;
  defaultProvider?: ProviderId;
  fallbackOrder?: ProviderId[];
}

/** Status of a single provider */
export interface ProviderStatus {
  id: ProviderId;
  name: string;
  configured: boolean;
  source?: KeySource;
  keyPreview?: string;
  valid?: boolean;
  error?: string;
}

/** Overall status report */
export interface StatusReport {
  providers: ProviderStatus[];
  defaultProvider?: ProviderId;
}

/** Options for the setup wizard */
export interface WizardOptions {
  /** Which providers to offer for configuration */
  providers?: ProviderId[];
  /** At least one of these must be configured */
  required?: ProviderId[];
  /** App name shown in prompts */
  appName?: string;
  /** Skip providers that already have keys configured */
  skipConfigured?: boolean;
}

/** OpenAI-SDK-compatible configuration */
export interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}

/** Options passed to the top-level init */
export interface ByokOptions {
  /** Provider overrides (runtime keys) */
  providers?: Record<string, ProviderConfig>;
  /** Path to project config file */
  configPath?: string;
  /** Do not read the user config file (stored keys are still used) */
  noUserConfig?: boolean;
}
