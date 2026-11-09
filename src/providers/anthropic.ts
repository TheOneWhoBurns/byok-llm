import type { ProviderDefinition } from "../types.js";

export const anthropic: ProviderDefinition = {
  id: "anthropic",
  name: "Anthropic",
  envKeys: ["ANTHROPIC_API_KEY"],
  keyPrefix: "sk-ant-",
  baseUrl: "https://api.anthropic.com",
  docsUrl: "https://platform.claude.com/settings/keys",
  authStyle: "x-api-key",
  authHeader: "x-api-key",
  defaultHeaders: {
    "anthropic-version": "2023-06-01",
  },
  validateEndpoint: "/v1/models",
  openaiCompatible: false,
};
