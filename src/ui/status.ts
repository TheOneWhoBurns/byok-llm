// ============================================================
// byok-llm — Status Reporter
// ============================================================

import type { ProviderId, ProviderStatus, StatusReport } from "../types.js";
import { getProvider, listProviders } from "../providers/registry.js";
import { resolveKey, getConfig } from "../config/resolver.js";

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

/**
 * Get the status of all registered providers.
 */
export async function getStatus(providerIds?: ProviderId[]): Promise<StatusReport> {
  const providers = providerIds
    ? providerIds.map((id) => getProvider(id)).filter((p): p is NonNullable<typeof p> => !!p)
    : listProviders();

  const statuses: ProviderStatus[] = [];

  for (const provider of providers) {
    const resolved = await resolveKey(provider.id);
    statuses.push({
      id: provider.id,
      name: provider.name,
      configured: !!resolved,
      source: resolved?.source,
      keyPreview: resolved ? maskKey(resolved.key) : undefined,
    });
  }

  const config = getConfig();

  return {
    providers: statuses,
    defaultProvider: config.defaultProvider,
  };
}

/** ANSI color helpers */
const col = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

/**
 * Print a formatted status report to stdout.
 */
export async function printStatus(providerIds?: ProviderId[]): Promise<void> {
  const status = await getStatus(providerIds);

  console.log();
  console.log(`${col.bold}${col.cyan}  byok-llm${col.reset} — Provider Status`);
  console.log(`${col.dim}  ${"─".repeat(50)}${col.reset}`);

  for (const p of status.providers) {
    const icon = p.configured ? `${col.green}✓` : `${col.red}✗`;
    const source = p.source ? `${col.dim}(${p.source})${col.reset}` : "";
    const preview = p.keyPreview ? `${col.dim}${p.keyPreview}${col.reset}` : "";

    console.log(
      `  ${icon}${col.reset} ${col.bold}${p.name.padEnd(16)}${col.reset} ${preview} ${source}`,
    );
  }

  const total = status.providers.length;
  const active = status.providers.filter((p) => p.configured).length;
  console.log();
  console.log(`  ${col.dim}${active}/${total} providers configured${col.reset}`);

  if (status.defaultProvider) {
    console.log(`  ${col.dim}Default: ${status.defaultProvider}${col.reset}`);
  }

  console.log();
}
