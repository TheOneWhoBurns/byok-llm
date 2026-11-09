// ============================================================
// byok-llm — Config File Loader
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ByokConfig } from "../types.js";

/**
 * Resolve the XDG config home directory.
 */
function getConfigHome(): string {
  return process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
}

/**
 * Get the user-level config path.
 */
export function getUserConfigPath(): string {
  return join(getConfigHome(), "byok-ai", "config.json");
}

/**
 * Get the user-level keys storage path.
 */
export function getKeysStorePath(): string {
  return join(getConfigHome(), "byok-ai", "keys.json");
}

/**
 * Resolve `{env:VAR_NAME}` and `{file:/path}` placeholders in a string.
 */
export function resolveValue(value: string): string {
  // {env:VAR_NAME}
  const envMatch = value.match(/^\{env:([^}]+)\}$/);
  if (envMatch) {
    return process.env[envMatch[1]] || "";
  }

  // {file:/path/to/file}
  const fileMatch = value.match(/^\{file:([^}]+)\}$/);
  if (fileMatch) {
    const filePath = fileMatch[1].replace(/^~/, homedir());
    try {
      return readFileSync(filePath, "utf-8").trim();
    } catch {
      return "";
    }
  }

  return value;
}

/**
 * Try to read and parse a JSON config file. Returns null if not found.
 */
function readJsonConfig(filePath: string): ByokConfig | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    // Resolve {env:...} and {file:...} in apiKey values
    if (parsed.providers) {
      for (const [, config] of Object.entries(parsed.providers)) {
        const providerConf = config as Record<string, unknown>;
        if (typeof providerConf.apiKey === "string") {
          providerConf.apiKey = resolveValue(providerConf.apiKey);
        }
      }
    }

    return parsed as ByokConfig;
  } catch {
    return null;
  }
}

/**
 * Try to read the `byok` field from package.json in the current directory.
 */
function readPackageJsonConfig(): ByokConfig | null {
  try {
    const pkgPath = join(process.cwd(), "package.json");
    if (!existsSync(pkgPath)) return null;
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    if (pkg.byok && typeof pkg.byok === "object") {
      return pkg.byok as ByokConfig;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search for project-level config files.
 */
const PROJECT_CONFIG_NAMES = [".byokrc.json", ".byokrc", "byok.config.json"];

function findProjectConfig(): ByokConfig | null {
  for (const name of PROJECT_CONFIG_NAMES) {
    const filePath = join(process.cwd(), name);
    const config = readJsonConfig(filePath);
    if (config) return config;
  }
  return readPackageJsonConfig();
}

/**
 * Merge two configs. `override` takes priority over `base`.
 */
function mergeConfigs(base: ByokConfig, override: ByokConfig): ByokConfig {
  const merged: ByokConfig = { ...base, ...override };

  // Deep merge providers
  if (base.providers || override.providers) {
    merged.providers = { ...base.providers };
    if (override.providers) {
      for (const [id, config] of Object.entries(override.providers)) {
        merged.providers[id] = { ...merged.providers[id], ...config };
      }
    }
  }

  return merged;
}

export interface LoadedConfig {
  config: ByokConfig;
  sources: string[];
}

/**
 * Load and merge all config layers.
 * Priority: custom path > project config > user config
 */
export function loadConfig(customPath?: string): LoadedConfig {
  let config: ByokConfig = {};
  const sources: string[] = [];

  // Layer 1: User config (lowest priority)
  const userConfig = readJsonConfig(getUserConfigPath());
  if (userConfig) {
    config = mergeConfigs(config, userConfig);
    sources.push("user-config");
  }

  // Layer 2: Project config
  const projectConfig = findProjectConfig();
  if (projectConfig) {
    config = mergeConfigs(config, projectConfig);
    sources.push("project-config");
  }

  // Layer 3: Custom path (highest priority for file-based)
  if (customPath) {
    const customConfig = readJsonConfig(customPath);
    if (customConfig) {
      config = mergeConfigs(config, customConfig);
      sources.push("custom-config");
    }
  }

  return { config, sources };
}
