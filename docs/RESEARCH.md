# BYOK Module - Research Notes

> **Historical note.** Prior-art survey from March 2026, written before
> implementation and not updated since. Project details below (stars, licenses,
> package lists) were not re-verified.

## The Gap

**No standalone npm package exists** that provides unified BYOK key management for multiple AI providers.
What exists falls into two categories:
- **Unified LLM client libraries** that accept API keys as params (but don't *manage* keys)
- **Gateway/proxy services** that handle BYOK server-side (Vercel AI Gateway, OpenRouter, LiteLLM)

Searched: `ai-keys`, `llm-auth`, `api-key-manager`, `byok` — none exist on npm for this purpose.

---

## Projects Researched

### 1. OpenCode (opencode-ai/opencode)
- **License: MIT**
- **Lang:** Go (archived Sep 2025, continued as "Crush")
- **Stars:** 11,500+
- **Providers:** Anthropic, OpenAI, Google Gemini, GitHub Copilot, AWS Bedrock, Azure OpenAI, Groq, OpenRouter, Vertex AI, xAI, Ollama
- **Key patterns:**
  - 3-layer credential resolution: env vars > config files > auth store
  - Config files: `~/.opencode.json`, `~/.config/opencode/opencode.json`, `./opencode.json` (project-local)
  - Variable substitution: `{env:VAR}` and `{file:path}` in config
  - Provider factory with functional options
  - OpenAI-compatible base URL reuse (Groq, OpenRouter share one client)
  - Auth store at `~/.local/share/opencode/auth.json`
  - Provider popularity ranking for auto-selection

### 2. T3 Chat (t3.chat)
- **License: Proprietary (closed source)**
- **Best open-source clone: thom-chat (TGlide/thom-chat) — MIT License**
- **Providers:** Anthropic, OpenAI, Google, OpenRouter
- **Key patterns:**
  - Server-side key proxy (user keys never leave server)
  - Keys stored in Convex DB, scoped by user_id + provider
  - Fallback hierarchy: user key > platform shared key (with rate limits)
  - OpenRouter as unified gateway (single API surface, 400+ models)
  - Key validation via provider-specific endpoints (e.g., `/api/v1/key` for OpenRouter)
  - BYOK modes: "Priority" (your key first) vs "Fallback" (balance first)

### 3. OpenAI Codex CLI
- **License: Apache 2.0**
- **Key patterns:**
  - Config: `~/.codex/config.toml`
  - Credential storage: `auth.json`, OS keyring, or auto-detect
  - Multi-provider via `[model_providers.<id>]` sections in TOML
  - Each provider references an env var name (not the key itself)
  - Profile switching: `profiles.<name>.model_provider`
  - Device code auth for headless environments

### 4. Claude Code
- **Key patterns:**
  - Primary: `ANTHROPIC_API_KEY` env var
  - Gateway/proxy: `ANTHROPIC_AUTH_TOKEN` (Bearer header)
  - Custom base URL: `ANTHROPIC_BASE_URL`
  - Custom headers: `ANTHROPIC_CUSTOM_HEADERS`
  - Browser login fallback
  - Simplest approach — single provider, env var based

### 5. Vercel AI SDK
- **License: Apache 2.0**
- **Key patterns:**
  - Provider registry with typed credential shapes per provider
  - Per-request BYOK via `providerOptions.gateway.byok`
  - Multiple credentials per provider (tried in order)
  - Automatic fallback to system credentials
  - Different credential shapes: `{ apiKey }` vs `{ project, location, googleCredentials }` vs AWS creds

### 6. LiteLLM (Python)
- **License: MIT**
- **Key patterns:**
  - `config.yaml` with `model_list` entries
  - `os.environ/VAR_NAME` syntax in config
  - Virtual key management with spend tracking
  - Key rotation (manual + scheduled)
  - Budget limits per key
  - Fallback chains and load balancing

---

## Licenses Summary

| Project | License | Safe to Reference? |
|---------|---------|-------------------|
| OpenCode | MIT | Yes - freely reusable |
| thom-chat (T3 clone) | MIT | Yes - freely reusable |
| Codex CLI | Apache 2.0 | Yes - freely reusable |
| Vercel AI SDK | Apache 2.0 | Yes - freely reusable |
| LiteLLM | MIT | Yes - freely reusable |
| T3 Chat (official) | Proprietary | No - patterns only |

---

## Key Reusable Patterns to Adopt

1. **Layered config resolution** (OpenCode): env vars > user config > project config
2. **Provider registry with typed credentials** (Vercel AI SDK)
3. **OpenAI-compatible base URL reuse** (OpenCode): one client serves OpenRouter, Groq, etc.
4. **Key validation per provider** (thom-chat): test key before storing
5. **Env var reference in config** (Codex): store `env:VAR_NAME`, not the key itself
6. **Fallback chains** (LiteLLM): if provider A fails, try B
7. **Secure storage options** (Codex): file, keyring, or auto-detect

---

## npm Packages Found (Related but Not What We Want)

| Package | What it does | Why it's not enough |
|---------|-------------|-------------------|
| `@unified-llm/core` | Unified LLM client | No key management, just pass-through |
| `multi-llm-ts` | Multi-provider LLM | Same - no key lifecycle |
| `llmpool` | Load balancing LLM | Closest, but no key storage/validation |
| `@node-llm/core` | 540+ models | Auto-reads env vars, no management |
| Vercel AI SDK (`ai`) | Full AI toolkit | Too heavy, focused on streaming/UI |
