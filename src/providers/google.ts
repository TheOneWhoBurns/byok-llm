import type { ProviderDefinition } from "../types.js";

export const google: ProviderDefinition = {
  id: "google",
  name: "Google Gemini",
  envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  baseUrl: "https://generativelanguage.googleapis.com",
  docsUrl: "https://aistudio.google.com/app/apikey",
  // Google's docs send the key in this header; a key in the URL leaks into logs.
  authStyle: "x-api-key",
  authHeader: "x-goog-api-key",
  validateEndpoint: "/v1beta/models",
  openaiCompatible: false,
};
