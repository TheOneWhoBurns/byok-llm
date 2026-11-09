import type { ProviderDefinition } from "../types.js";

export const openrouter: ProviderDefinition = {
  id: "openrouter",
  name: "OpenRouter",
  envKeys: ["OPENROUTER_API_KEY"],
  keyPrefix: "sk-or-",
  baseUrl: "https://openrouter.ai/api",
  docsUrl: "https://openrouter.ai/keys",
  authStyle: "bearer",
  validateEndpoint: "/v1/key",
  openaiCompatible: true,
};
