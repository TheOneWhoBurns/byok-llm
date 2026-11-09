import { describe, it, expect, afterEach, vi } from "vitest";
import { validateKey } from "../src/validation/validator.js";

/** Replace global fetch with a stub that records the requested URL. No network is used. */
function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("validateKey (live check, fetch stubbed)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: these two were requested without the "/openai" and "/api" path
  // prefixes, so every key failed validation with a 404.
  it("should call the Groq models endpoint under /openai", async () => {
    const fetchMock = stubFetch(jsonResponse(200, { data: [] }));

    const result = await validateKey("groq", "gsk_valid-looking-key-123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.groq.com/openai/v1/models");
    expect(result.valid).toBe(true);
  });

  it("should call the OpenRouter key endpoint under /api and return its metadata", async () => {
    const fetchMock = stubFetch(
      jsonResponse(200, { data: { label: "my-key", usage: 1.5, limit: 10 } }),
    );

    const result = await validateKey("openrouter", "sk-or-valid-looking-key-1234");

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://openrouter.ai/api/v1/auth/key");
    expect(result).toEqual({ valid: true, meta: { label: "my-key", usage: 1.5, limit: 10 } });
  });

  it("should send the key as a bearer token", async () => {
    const fetchMock = stubFetch(jsonResponse(200));

    await validateKey("groq", "gsk_valid-looking-key-123456");

    const headers = fetchMock.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gsk_valid-looking-key-123456");
  });

  it("should send Google keys as a query parameter", async () => {
    const fetchMock = stubFetch(jsonResponse(200));

    await validateKey("google", "AIzaSyC-valid-looking-key");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyC-valid-looking-key",
    );
  });

  it("should report 401 as an invalid key", async () => {
    stubFetch(jsonResponse(401));

    const result = await validateKey("openai", "sk-rejected-key-123456789");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("authentication failed");
  });

  it("should treat 429 as a valid but throttled key", async () => {
    stubFetch(jsonResponse(429));

    const result = await validateKey("openai", "sk-throttled-key-12345678");

    expect(result.valid).toBe(true);
    expect(result.meta?.warning).toContain("Rate limited");
  });

  it("should not call the network when the format check fails", async () => {
    const fetchMock = stubFetch(jsonResponse(200));

    const result = await validateKey("groq", "sk-wrong-prefix-key-123456");

    expect(result.valid).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should treat a timeout as unverified rather than invalid", async () => {
    stubFetch(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    const result = await validateKey("openai", "sk-slow-network-key-12345");

    expect(result.valid).toBe(true);
    expect(result.meta?.warning).toContain("Could not reach provider");
  });
});
