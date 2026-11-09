# byok-llm

[![npm](https://img.shields.io/npm/v/byok-llm)](https://www.npmjs.com/package/byok-llm)
[![CI](https://github.com/TheOneWhoBurns/byok-llm/actions/workflows/ci.yml/badge.svg)](https://github.com/TheOneWhoBurns/byok-llm/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/byok-llm)](./LICENSE)

API-key management for Node.js apps that call LLM providers with the user's own key ("bring your own key"). Zero runtime dependencies.

It answers one question, "which key do I use for this provider, and how do I send it?", for eight built-in providers and any you register yourself:

- **Resolve** a key from an explicit argument, config files, environment variables or a local key file.
- **Store** keys in a `0600` JSON file under the user's config directory.
- **Validate** a key's format, and optionally check it against the provider.
- **Prompt** for missing keys with an interactive terminal wizard.
- **Hand back** the key, auth headers and base URL, or a ready-made config object for the OpenAI SDK.

It does not call any model for you, and it is not a secret manager: stored keys are plain text protected only by file permissions.

```bash
npm install byok-llm
```

Requires Node.js 18 or newer. Ships ESM and CommonJS builds with type declarations for both.

> **Status.** The latest npm release is **1.0.0**. `main` contains fixes that are not published yet; they are listed under "Unreleased" in the [changelog](./CHANGELOG.md). Where 1.0.0 behaves differently from what is described here, this README says so.

## Quick start

```typescript
import { init } from "byok-llm";

// Returns the first listed provider that has a key. If none has one and the
// process is attached to a terminal, runs the setup wizard first.
const provider = await init({
  providers: ["anthropic"],
  appName: "my-cli-tool",
});

if (!provider) {
  console.error("No Anthropic API key configured.");
  process.exit(1);
}

// provider.key, provider.headers and provider.baseUrl are ready to use.
const response = await fetch(`${provider.baseUrl}/v1/messages`, {
  method: "POST",
  headers: { ...provider.headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Hello!" }],
  }),
});
```

`provider.baseUrl` is the provider's API root. Request paths and bodies differ between providers, so if you pass several providers to `init()`, branch on `provider.providerId` before building the request.

> In 1.0.0 the `providers` option of `init()` is mistyped and this call does not type-check in TypeScript (it runs fine as JavaScript). Fixed on `main`.

## Using the OpenAI SDK

For providers that expose an OpenAI-compatible API, `getOpenAICompatibleConfig()` returns `{ apiKey, baseURL, defaultHeaders? }` in the shape the SDK's constructor takes:

```typescript
import OpenAI from "openai";
import { getOpenAICompatibleConfig } from "byok-llm";

const client = new OpenAI(await getOpenAICompatibleConfig("groq"));
// baseURL is "https://api.groq.com/openai/v1"
```

This works for `openai`, `openrouter`, `groq`, `xai`, `mistral`, `deepseek` and any custom provider registered with `openaiCompatible: true`. The returned `baseURL` is the provider's base URL with `/v1` appended (unless it already ends in a version segment). A `baseUrl` you set in config is passed through exactly as written.

> In 1.0.0 the returned `baseURL` has no `/v1`, so the SDK gets a 404 from every built-in provider except DeepSeek. On that version, append it yourself: `new OpenAI({ ...config, baseURL: config.baseURL + "/v1" })`.

## How a key is resolved

`resolveKey(providerId, runtimeKey?)` returns `{ key, source, providerId, envVar? }` or `null`. The first match wins:

| Order | Where the key comes from                                                                | `source`        |
| ----- | --------------------------------------------------------------------------------------- | --------------- |
| 1     | The `runtimeKey` argument                                                               | `"runtime"`     |
| 2     | `providers.<id>.apiKey` in the merged config (see [Configuration](#configuration))      | `"runtime"`     |
| 3     | Environment variables, in the order listed in the [provider table](#built-in-providers) | `"env"`         |
| 4     | The stored keys file                                                                    | `"user-config"` |

Things worth knowing:

- **A key in a config file beats an environment variable.** This is deliberate in the code and covered by tests, but it is the opposite of what the 1.0.0 README said.
- Every key that comes from config is reported as `"runtime"`, whether it was passed in code or read from a file. The `"project-config"` member of the `KeySource` type is never returned.
- A provider with `disabled: true` in config resolves to `null`, even if you pass `runtimeKey`.
- Unknown provider ids resolve to `null`; they do not throw.

```typescript
import { resolveKey, resolveWithFallback, getConfiguredProviders } from "byok-llm";

const key = await resolveKey("anthropic");

// First provider in the list that has a key, with headers and base URL.
// Without an argument it uses `fallbackOrder` from config, then DEFAULT_FALLBACK_ORDER.
const provider = await resolveWithFallback(["anthropic", "openai", "openrouter"]);

// Every registered provider that currently has a key.
const configured = await getConfiguredProviders();
```

"Fallback" here means "the first provider with a key configured". Keys are not validated during resolution, and nothing retries a request against the next provider for you.

## Built-in providers

| Provider      | ID           | Environment variables                   | Auth                    | Base URL                                    | OpenAI SDK |
| ------------- | ------------ | --------------------------------------- | ----------------------- | ------------------------------------------- | ---------- |
| Anthropic     | `anthropic`  | `ANTHROPIC_API_KEY`                     | `x-api-key` header      | `https://api.anthropic.com`                 | no         |
| OpenAI        | `openai`     | `OPENAI_API_KEY`                        | bearer                  | `https://api.openai.com`                    | yes        |
| OpenRouter    | `openrouter` | `OPENROUTER_API_KEY`                    | bearer                  | `https://openrouter.ai/api`                 | yes        |
| Google Gemini | `google`     | `GEMINI_API_KEY`, then `GOOGLE_API_KEY` | `x-goog-api-key` header | `https://generativelanguage.googleapis.com` | no         |
| Groq          | `groq`       | `GROQ_API_KEY`                          | bearer                  | `https://api.groq.com/openai`               | yes        |
| xAI           | `xai`        | `XAI_API_KEY`                           | bearer                  | `https://api.x.ai`                          | yes        |
| Mistral       | `mistral`    | `MISTRAL_API_KEY`                       | bearer                  | `https://api.mistral.ai`                    | yes        |
| DeepSeek      | `deepseek`   | `DEEPSEEK_API_KEY`                      | bearer                  | `https://api.deepseek.com`                  | yes        |

Notes:

- Anthropic requests also get `anthropic-version: 2023-06-01`. To send a different version, set `headers` for the provider in config; config headers override the defaults.
- Google's own SDKs give `GOOGLE_API_KEY` precedence when both variables are set. byok-llm checks `GEMINI_API_KEY` first.
- In 1.0.0 the Google key is not in `headers`: that version expects it in the URL as `?key=...`, so you have to append it yourself. On `main` it is sent in the `x-goog-api-key` header, as Google's docs do.

## Configuration

Config is optional. It is read once, on first use, and cached; call `initConfig()` again to reload it.

Layers, lowest priority first:

1. **User config**: `$XDG_CONFIG_HOME/byok-ai/config.json`, or `~/.config/byok-ai/config.json`.
2. **Project config**, from the current working directory: the first of `.byokrc.json`, `.byokrc`, `byok.config.json` that exists and parses as JSON; if none does, the `byok` field of `package.json`.
3. **A custom file**: `initConfig({ configPath })`.
4. **Options passed in code**: `initConfig({ providers: { ... } })`.

A file that is missing or is not valid JSON is skipped silently.

```json
{
  "fallbackOrder": ["anthropic", "openai", "groq"],
  "defaultProvider": "anthropic",
  "providers": {
    "anthropic": {
      "apiKey": "{env:MY_ANTHROPIC_KEY}"
    },
    "openai": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "headers": { "OpenAI-Organization": "org-123" }
    },
    "mistral": {
      "disabled": true
    }
  }
}
```

| Field                     | Effect                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `providers.<id>.apiKey`   | The key. In the JSON config files (not the `package.json` field) the whole value may be `{env:VAR_NAME}` or `{file:/path/to/key}` (`~` is expanded, the file content is trimmed). A placeholder that resolves to nothing is treated as "no key here". |
| `providers.<id>.baseUrl`  | Replaces the provider's base URL in `getProviderBaseUrl()`, `resolveWithFallback()` and `getOpenAICompatibleConfig()`. Used exactly as written. Not used by `validateKey()`.                                                                          |
| `providers.<id>.headers`  | Extra headers, merged over the provider's defaults.                                                                                                                                                                                                   |
| `providers.<id>.disabled` | The provider never resolves.                                                                                                                                                                                                                          |
| `fallbackOrder`           | Order used by `resolveWithFallback()` when called without a list.                                                                                                                                                                                     |
| `defaultProvider`         | Reported by `getStatus()` and `printStatus()`. It does not affect resolution.                                                                                                                                                                         |

`noUserConfig: true` in `initConfig()` / `init()` skips the user config file.

> In 1.0.0 `noUserConfig` is accepted but ignored. Fixed on `main`.

## Storing keys

```typescript
import { storeKey, getKey, removeKey, listStoredKeys, clearAllKeys } from "byok-llm";

await storeKey("anthropic", "sk-ant-...");
const key = await getKey("anthropic"); // string | null
await removeKey("anthropic");
```

Keys are written as plain JSON to `$XDG_CONFIG_HOME/byok-ai/keys.json` (default `~/.config/byok-ai/keys.json`). The file is created with mode `0600` and its directory with `0700`. There is no encryption and no OS keychain integration. On Windows, Node cannot apply these permission bits, so the file has whatever access the user's profile directory gives it.

The directory is called `byok-ai` because that was the project's working name. It is kept so that keys stored by 1.0.0 stay readable.

## Validating keys

```typescript
import { validateKeyFormat, validateKey, validateAllKeys } from "byok-llm";

validateKeyFormat("openai", "sk-..."); // synchronous, no network
const result = await validateKey("openai", "sk-...");
// { valid: boolean, error?: string, meta?: Record<string, unknown> }
```

`validateKeyFormat()` checks that the key is non-empty, at least 10 characters long, and starts with the provider's known prefix where one is defined (`sk-ant-`, `sk-`, `sk-or-`, `gsk_`, `xai-`; none for Google and Mistral).

`validateKey()` runs the format check and then sends one `GET` to a read-only endpoint of the provider (its model list; for OpenRouter, the key-info endpoint) with a 10-second timeout:

| Response                                 | Result                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2xx                                      | `valid: true`. For OpenRouter, `meta` carries `usage`, `limit` and `label`.                                                                 |
| 401 or 403                               | `valid: false`, "Invalid API key (authentication failed)"                                                                                   |
| 429                                      | `valid: true` with `meta.warning`: the key is accepted but rate limited                                                                     |
| Any other status                         | `valid: false`, "Validation failed with status N". xAI and Google answer an invalid key with 400, so that is the message you get from them. |
| Timeout, DNS failure, connection refused | `valid: true` with `meta.warning`: the provider could not be reached, so the key is **unverified**, not confirmed                           |

Check `meta.warning` if you need to tell "verified" from "could not verify".

> In 1.0.0, live validation always fails for Groq and OpenRouter keys (the request goes to the wrong path), DNS or connection failures are reported as `valid: false`, and Google keys are sent in the URL. All three are fixed on `main`.

`validateAllKeys()` validates the resolved key of every registered provider in parallel and returns a record keyed by provider id; providers without a key get `{ valid: false, error: "No key configured" }`.

## Setup wizard

```typescript
import { setupWizard } from "byok-llm";

await setupWizard({
  providers: ["anthropic", "openai", "openrouter"], // default: every registered provider
  required: ["anthropic"],
  appName: "my-app",
  skipConfigured: true, // default
});
```

For each provider the wizard shows whether a key is already configured, otherwise prints where to get one and asks for it. It runs the format check and the live check, stores the key if it passes, and asks "Save anyway?" if it does not.

- It uses plain `readline`: **the key is echoed to the terminal as it is typed or pasted.**
- `required` only produces a warning at the end if one of those providers is still unconfigured. It does not block or throw.
- `init()` starts the wizard only when no listed provider has a key, `interactive` is not `false`, and `process.stdin.isTTY` is true. In CI or a pipe it just returns `null`.

## Status

```typescript
import { getStatus, printStatus } from "byok-llm";

const status = await getStatus(); // { providers: [{ id, name, configured, source?, keyPreview? }], defaultProvider? }
await printStatus(); // the same, as a coloured table on stdout
```

The library never prints a full key. `keyPreview`, the status table and the wizard show a masked form: the first six and last four characters.

## Custom providers

```typescript
import { registerProvider, resolveKey, getOpenAICompatibleConfig } from "byok-llm";

registerProvider({
  id: "local-llm",
  name: "Local server",
  envKeys: ["LOCAL_LLM_API_KEY"],
  baseUrl: "http://localhost:8080",
  docsUrl: "https://example.com/how-to-get-a-key",
  authStyle: "bearer", // or "x-api-key" (header name set by authHeader) or "query-param" (?key=...)
  validateEndpoint: "/v1/models", // omit to make validateKey() format-only
  // keyPrefix: "llm-", // optional; string or string[], enables the prefix check
  openaiCompatible: true,
});

const key = await resolveKey("local-llm");
const config = await getOpenAICompatibleConfig("local-llm"); // baseURL: "http://localhost:8080/v1"
```

Registering an id that already exists replaces that provider, built-in ones included. The registry is module-level state, shared by everything in the process that imports the package.

## API reference

**Initialisation**

- `init(options?)`: load config, resolve a provider, run the wizard if none is configured. Options: `providers` (ids, in order), `appName`, `interactive`, `configPath`, `noUserConfig`.
- `initConfig(options?)`: load (or reload) and cache config. Options: `providers` (per-provider config), `configPath`, `noUserConfig`.
- `getConfig()`: the cached merged config.
- `getUserConfigPath()`, `getKeysStorePath()`: where the user config and the key store live.

**Resolution**

- `resolveKey(providerId, runtimeKey?)`
- `resolveWithFallback(providerIds?)`
- `getConfiguredProviders()`
- `DEFAULT_FALLBACK_ORDER`

**Request helpers**

- `getProviderHeaders(providerId)`: auth headers for the resolved key. Throws if the provider is unknown or has no key.
- `getProviderBaseUrl(providerId)`
- `getOpenAICompatibleConfig(providerId)`: throws if the provider is unknown or has no key.

**Validation**: `validateKeyFormat(providerId, key)`, `validateKey(providerId, key)`, `validateAllKeys()`

**Storage**: `storeKey`, `getKey`, `removeKey`, `listStoredKeys`, `clearAllKeys`

**Environment**: `hasEnvKey(providerId)`, `getEnvKey(providerId)`, `getEnvVarName(providerId)`, `generateEnvTemplate(providerIds?)` (returns the text of a commented-out `.env` template)

**Registry**: `registerProvider(definition)`, `getProvider(id)`, `listProviders()`, `hasProvider(id)`

**UI**: `setupWizard(options?)`, `getStatus(providerIds?)`, `printStatus(providerIds?)`

**Types**: `ProviderId`, `BuiltinProviderId`, `ProviderDefinition`, `AuthStyle`, `KeySource`, `ResolvedKey`, `ResolvedProvider`, `ValidationResult`, `ProviderConfig`, `ByokConfig`, `ByokOptions`, `ProviderStatus`, `StatusReport`, `WizardOptions`, `OpenAICompatibleConfig`

## Limitations

- Keys at rest are plain text. File permissions are the only protection, and they do not apply on Windows.
- The wizard does not mask key input.
- Config and the provider registry are process-wide module state. There is no per-instance client, so two parts of one process cannot use different configurations.
- File access is synchronous (`fs.*Sync`), although the storage functions return promises.
- Config files are looked up in `process.cwd()` only; parent directories are not searched.
- There is no key rotation, expiry tracking or usage accounting.

## Development

```bash
npm ci
npm run lint
npm run typecheck
npm run format:check
npm test          # offline; network calls are stubbed
npm run build     # ESM + CJS + .d.ts into dist/
```

CI runs the tests and the build on Node 18, 20, 22, 24 and 26. The test job installs with `npm ci`, so the lockfile is what gets tested. See [RELEASING.md](./RELEASING.md) for how a release is cut, and [docs/](./docs) for the original design notes.

## License

[MIT](./LICENSE)
