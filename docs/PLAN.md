# BYOK Module — Implementation Plan

> **Historical note.** This is the plan written before the first line of code, kept
> for context. It uses the working name `byok-ai` (the package was published as
> `byok-llm`) and describes things that were never built: `custom.ts`,
> `schema.ts`/zod validation and OS keychain storage do not exist. The
> [README](../README.md) describes what the library actually does.

## Package Name: `byok-ai`

> A lightweight, zero-dependency BYOK (Bring Your Own Key) module for AI-powered apps.
> Install once, use in all your projects. Users bring their own API keys — you ship free tools.

---

## Architecture Overview

```
byok-ai/
├── src/
│   ├── index.ts              # Public API exports
│   ├── providers/
│   │   ├── registry.ts       # Provider registry & definitions
│   │   ├── anthropic.ts      # Anthropic provider config
│   │   ├── openai.ts         # OpenAI provider config
│   │   ├── openrouter.ts     # OpenRouter provider config
│   │   ├── google.ts         # Google Gemini provider config
│   │   ├── groq.ts           # Groq provider config
│   │   ├── xai.ts            # xAI (Grok) provider config
│   │   └── custom.ts         # Custom OpenAI-compatible provider
│   ├── config/
│   │   ├── resolver.ts       # Layered config resolution (env > user > project)
│   │   ├── loader.ts         # Config file loader (JSON + TOML-like)
│   │   └── schema.ts         # Config schema + validation (with zod)
│   ├── storage/
│   │   ├── env.ts            # Environment variable storage
│   │   ├── file.ts           # File-based storage (~/.config/byok-ai/keys.json)
│   │   └── keychain.ts       # OS keychain integration (optional)
│   ├── validation/
│   │   └── validator.ts      # Per-provider key validation (lightweight API calls)
│   ├── ui/
│   │   ├── setup-wizard.ts   # Interactive CLI setup (inquirer-like prompts)
│   │   └── status.ts         # Show configured providers + key health
│   └── types.ts              # All TypeScript types/interfaces
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build config (ESM + CJS)
└── README.md
```

---

## Phase 1: Core — Provider Registry + Config Resolution

### Step 1: Project scaffolding
- Init npm package with TypeScript, tsup for builds
- ESM + CJS dual output
- Zero required dependencies (zod as optional peer dep)

### Step 2: Provider definitions
Each provider defines:
```typescript
interface ProviderDefinition {
  id: string;                    // 'anthropic', 'openai', 'openrouter', etc.
  name: string;                  // 'Anthropic'
  envKeys: string[];             // ['ANTHROPIC_API_KEY'] — checked in order
  keyPrefix?: string;            // 'sk-ant-' — for quick format validation
  baseUrl: string;               // 'https://api.anthropic.com'
  docsUrl: string;               // Where to get a key
  headers: (key: string) => Record<string, string>;  // Auth header builder
  validateEndpoint?: string;     // Lightweight endpoint to test key
  openaiCompatible?: boolean;    // Can reuse OpenAI client with baseURL swap
}
```

### Step 3: Layered config resolution
Resolution order (highest priority first):
1. **Runtime options** — passed directly in code: `byok({ providers: { anthropic: { apiKey: '...' } } })`
2. **Environment variables** — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.
3. **Project config** — `./.byokrc.json` or `byok` field in `package.json`
4. **User config** — `~/.config/byok-ai/config.json`

```typescript
// Usage
import { resolveKey } from 'byok-ai';

const key = await resolveKey('anthropic');
// Checks: runtime > env > project > user config
// Returns: { key: string, source: 'env' | 'config' | 'runtime' } | null
```

---

## Phase 2: Key Validation + Storage

### Step 4: Key validation
Lightweight validation per provider (no heavy SDK deps):
```typescript
import { validateKey } from 'byok-ai';

const result = await validateKey('anthropic', 'sk-ant-...');
// Returns: { valid: boolean, error?: string, meta?: { org?: string, usage?: number } }
```

Validation strategies:
- **Format check** — prefix matching (`sk-ant-`, `sk-`, `sk-or-`)
- **API ping** — hit a lightweight endpoint (models list, key info, etc.)
  - Anthropic: `GET /v1/models` with key
  - OpenAI: `GET /v1/models` with key
  - OpenRouter: `GET /api/v1/auth/key` with key
  - Google: `GET /v1beta/models` with key

### Step 5: Secure file storage
```typescript
import { storeKey, getKey } from 'byok-ai';

await storeKey('anthropic', 'sk-ant-...');  // Saves to ~/.config/byok-ai/keys.json
const key = await getKey('anthropic');       // Retrieves it
```

Storage location: `~/.config/byok-ai/keys.json` (respects `XDG_CONFIG_HOME`)
File permissions: `0600` (owner read/write only)

---

## Phase 3: Interactive Setup + DX

### Step 6: CLI setup wizard
```typescript
import { setupWizard } from 'byok-ai';

// Interactive terminal UI
await setupWizard({
  providers: ['anthropic', 'openai', 'openrouter'],  // Which providers to ask for
  required: ['anthropic'],                             // At least one of these needed
  appName: 'my-cool-app',                             // Shown in prompts
});
```

The wizard:
1. Shows which providers are already configured (and from where)
2. Asks for missing keys with helpful links to docs
3. Validates keys on entry
4. Stores them in user config
5. Prints a summary

### Step 7: Status command helper
```typescript
import { getStatus } from 'byok-ai';

const status = await getStatus();
// Returns: { providers: [{ id: 'anthropic', configured: true, source: 'env', valid: true }, ...] }
```

---

## Phase 4: Integration Helpers

### Step 8: Provider client factory
```typescript
import { getProviderHeaders, getProviderBaseUrl } from 'byok-ai';

// For use with fetch, axios, or any HTTP client
const headers = await getProviderHeaders('anthropic');
// Returns: { 'x-api-key': 'sk-ant-...', 'anthropic-version': '2023-06-01' }

const baseUrl = getProviderBaseUrl('openrouter');
// Returns: 'https://openrouter.ai/api/v1'

// OpenAI-compatible shortcut (works with openai npm package)
import { getOpenAICompatibleConfig } from 'byok-ai';

const config = await getOpenAICompatibleConfig('openrouter');
// Returns: { apiKey: '...', baseURL: 'https://openrouter.ai/api/v1' }

// Direct use with OpenAI SDK:
import OpenAI from 'openai';
const client = new OpenAI(await getOpenAICompatibleConfig('groq'));
```

### Step 9: Fallback chains
```typescript
import { resolveWithFallback } from 'byok-ai';

const provider = await resolveWithFallback(['anthropic', 'openai', 'openrouter']);
// Tries each in order, returns first one with a valid key
// Returns: { provider: 'openai', key: '...', baseUrl: '...' } | null
```

---

## Public API Summary

```typescript
// Core
resolveKey(provider: string): Promise<ResolvedKey | null>
resolveWithFallback(providers: string[]): Promise<ResolvedProvider | null>

// Validation
validateKey(provider: string, key: string): Promise<ValidationResult>
validateAllKeys(): Promise<Record<string, ValidationResult>>

// Storage
storeKey(provider: string, key: string): Promise<void>
getKey(provider: string): Promise<string | null>
removeKey(provider: string): Promise<void>

// Config
loadConfig(): Promise<ByokConfig>
getStatus(): Promise<StatusReport>

// Integration helpers
getProviderHeaders(provider: string): Promise<Record<string, string>>
getProviderBaseUrl(provider: string): string
getOpenAICompatibleConfig(provider: string): Promise<{ apiKey: string; baseURL: string }>

// UI
setupWizard(options: WizardOptions): Promise<void>

// Registry
registerProvider(definition: ProviderDefinition): void
getProvider(id: string): ProviderDefinition | undefined
listProviders(): ProviderDefinition[]
```

---

## Design Decisions

1. **Zero required deps** — Only native Node.js APIs. Zod is optional peer dep for config validation.
2. **No SDK lock-in** — Returns raw keys/headers/URLs, works with any HTTP client or SDK.
3. **CLI-first DX** — Built for terminal apps (agentic CLIs), not web apps.
4. **Secure defaults** — File permissions 0600, never logs keys, warns about .gitignore.
5. **Extensible** — `registerProvider()` for custom/self-hosted providers.
6. **Dual format** — ESM + CJS for max compatibility.

---

## Tech Stack

- **TypeScript** — Full type safety
- **tsup** — Fast builds, ESM + CJS
- **vitest** — Testing
- **No runtime deps** — Uses native `fs`, `path`, `os`, `crypto`, `https`

---

## Implementation Order

1. Types + Provider registry (anthropic, openai, openrouter, google, groq, xai)
2. Config resolver (env vars + file loading)
3. Key storage (file-based with secure permissions)
4. Key validation (format + API ping)
5. Integration helpers (headers, baseUrl, openai-compatible config)
6. Fallback chains
7. Setup wizard (interactive prompts)
8. Status reporter
9. Tests + docs
10. Publish to npm
