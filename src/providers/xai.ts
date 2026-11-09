import type { ProviderDefinition } from "../types.js";

export const xai: ProviderDefinition = {
  id: "xai",
  name: "xAI (Grok)",
  envKeys: ["XAI_API_KEY"],
  keyPrefix: "xai-",
  baseUrl: "https://api.x.ai",
  docsUrl: "https://console.x.ai/team/default/api-keys",
  authStyle: "bearer",
  validateEndpoint: "/v1/models",
  openaiCompatible: true,
};
