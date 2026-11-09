// ============================================================
// byok-llm — Secure File Storage
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { getKeysStorePath } from "../config/loader.js";
import type { ProviderId } from "../types.js";

type KeyStore = Record<string, string>;

/**
 * Read the keys store file.
 */
function readStore(): KeyStore {
  const storePath = getKeysStorePath();
  try {
    if (!existsSync(storePath)) return {};
    const raw = readFileSync(storePath, "utf-8");
    return JSON.parse(raw) as KeyStore;
  } catch {
    return {};
  }
}

/**
 * Write the keys store file with secure permissions (0600).
 */
function writeStore(store: KeyStore): void {
  const storePath = getKeysStorePath();
  const dir = dirname(storePath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  writeFileSync(storePath, JSON.stringify(store, null, 2), { mode: 0o600 });

  // Ensure permissions (in case file already existed)
  try {
    chmodSync(storePath, 0o600);
  } catch {
    // May fail on some systems, that's ok
  }
}

/**
 * Store an API key for a provider.
 */
export async function storeKey(providerId: ProviderId, key: string): Promise<void> {
  const store = readStore();
  store[providerId] = key;
  writeStore(store);
}

/**
 * Get a stored API key for a provider.
 */
export async function getKey(providerId: ProviderId): Promise<string | null> {
  const store = readStore();
  return store[providerId] || null;
}

/**
 * Remove a stored API key for a provider.
 */
export async function removeKey(providerId: ProviderId): Promise<void> {
  const store = readStore();
  delete store[providerId];
  writeStore(store);
}

/**
 * List all stored provider IDs.
 */
export async function listStoredKeys(): Promise<ProviderId[]> {
  const store = readStore();
  return Object.keys(store);
}

/**
 * Clear all stored keys.
 */
export async function clearAllKeys(): Promise<void> {
  writeStore({});
}
