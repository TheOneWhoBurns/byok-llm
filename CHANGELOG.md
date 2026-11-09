# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Everything below is on `main` and not yet published to npm. Nothing is removed and the supported Node.js range is unchanged, but several fixes change what callers observe, so the next release is planned as a minor (1.1.0), not a patch.

### Fixed

- `getOpenAICompatibleConfig()` now returns a `baseURL` the OpenAI SDK can use. For providers marked `openaiCompatible` it appends `/v1` to the provider's base URL (unless that URL already ends in a version segment). In 1.0.0 it returned the bare API root, so `new OpenAI(await getOpenAICompatibleConfig(id))` got a 404 from OpenAI, OpenRouter, Groq, xAI and Mistral. `getProviderBaseUrl()` and `ResolvedProvider.baseUrl` are unchanged, and a `baseUrl` set in config is still returned exactly as written. **If you worked around this by appending `/v1` to the returned value yourself, remove that.**
- `validateKey()` no longer rejects every Groq and OpenRouter key. The validation request dropped the `/openai` and `/api` path prefixes of those providers' base URLs and got a 404.
- `validateKey()` now treats DNS failures and refused or reset connections as "could not verify" (`valid: true` with `meta.warning`), the same as a timeout. In 1.0.0 only timeouts were recognised and other network failures were reported as an invalid key.
- `init({ providers: [...] })` now type-checks. The `providers` option was typed as an intersection of the provider id list and the per-provider config record, which no value satisfies. Runtime behaviour is unchanged.
- The `noUserConfig` option of `init()` and `initConfig()` now skips the user config file. In 1.0.0 it was accepted and ignored.
- CommonJS consumers using `node16`/`nodenext` module resolution now get the `.d.cts` type declarations. The `exports` map previously pointed both module formats at the ESM declarations.
- The setup wizard, the status report and `generateEnvTemplate()` print the package name `byok-llm` instead of the pre-release working name `byok-ai`.
- The "get a key at" links for Anthropic, Google and xAI point at the pages those providers' docs currently link to.

### Changed

- Google API keys are sent in the `x-goog-api-key` header instead of a `?key=` query parameter, as Google's current docs do. `headers` for the `google` provider now contains the key, and `validateKey()` no longer puts it in the request URL. Code that appends `?key=` itself keeps working. The `query-param` auth style is still available to custom providers.
- OpenRouter keys are validated against the documented `/api/v1/key` endpoint instead of `/api/v1/auth/key`.
- The README was rewritten against the code. Notable corrections: a key in a config file takes precedence over an environment variable (the 1.0.0 README said the opposite); Google keys are read from `GEMINI_API_KEY` first, then `GOOGLE_API_KEY`; "fallback" means the first provider with a key configured, without validation.
- The repository was renamed from `byok-ai` to `byok-llm` to match the npm package. `package.json` now has `repository`, `homepage`, `bugs` and `author`.
- Development dependencies were refreshed (TypeScript 6, Vitest 3, ESLint 10.14) and the test suite no longer reads the developer's real config directory or provider environment variables. This does not affect the published package, which still has no dependencies.

### Added

- `LICENSE` file. The package has declared MIT since 1.0.0, but the license text was missing.
- `./package.json` is exported from the package.
- CI on GitHub Actions: lint, typecheck and packaging checks, plus tests and build on Node.js 18, 20, 22, 24 and 26.
- A release workflow that can publish to npm with provenance. It is dormant until configured; see [RELEASING.md](./RELEASING.md).
- This changelog.

### Not changed

- Stored keys and the user config still live under `~/.config/byok-ai/` (the working name), so keys saved by 1.0.0 stay readable.
- Anthropic requests still default to `anthropic-version: 2023-06-01`. Override it with `headers` in config if you need a newer API version.
- `GEMINI_API_KEY` is still checked before `GOOGLE_API_KEY`, although Google's own SDKs do the reverse when both are set.

## [1.0.0] - 2026-03-25

First public release.

### Added

- Key resolution for eight built-in providers (Anthropic, OpenAI, OpenRouter, Google Gemini, Groq, xAI, Mistral, DeepSeek) from an explicit argument, config files, environment variables or a stored key file: `resolveKey()`, `resolveWithFallback()`, `getConfiguredProviders()`, `init()`.
- Layered JSON config (user, project, custom path, runtime options) with `{env:VAR}` and `{file:/path}` placeholders for `apiKey`.
- A key store under the user's config directory, written with `0600` permissions: `storeKey()`, `getKey()`, `removeKey()`, `listStoredKeys()`, `clearAllKeys()`.
- Key format checks and live validation: `validateKeyFormat()`, `validateKey()`, `validateAllKeys()`.
- An interactive setup wizard and a status report: `setupWizard()`, `getStatus()`, `printStatus()`.
- Request helpers: `getProviderHeaders()`, `getProviderBaseUrl()`, `getOpenAICompatibleConfig()`.
- A provider registry for custom providers: `registerProvider()`, `getProvider()`, `listProviders()`, `hasProvider()`.
- Environment helpers: `hasEnvKey()`, `getEnvKey()`, `getEnvVarName()`, `generateEnvTemplate()`.
- ESM and CommonJS builds with type declarations. No runtime dependencies. Node.js 18 or newer.

### Known issues

See the "Fixed" list under [Unreleased](#unreleased); each of those bugs is present in 1.0.0.

[Unreleased]: https://github.com/TheOneWhoBurns/byok-llm/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/TheOneWhoBurns/byok-llm/releases/tag/v1.0.0
