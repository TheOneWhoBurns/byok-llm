// ============================================================
// byok-llm — Interactive Setup Wizard
// ============================================================
// Uses raw Node.js readline — zero dependencies.

import { createInterface } from "node:readline";
import type { WizardOptions } from "../types.js";
import { getProvider, listProviders } from "../providers/registry.js";
import { resolveKey } from "../config/resolver.js";
import { storeKey } from "../storage/file.js";
import { validateKey, validateKeyFormat } from "../validation/validator.js";

/** ANSI color helpers */
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

/**
 * Run the interactive setup wizard.
 *
 * Walks the user through configuring API keys for the specified providers.
 * Keys are stored in ~/.config/byok-ai/keys.json with 0600 permissions.
 */
export async function setupWizard(options: WizardOptions = {}): Promise<void> {
  const { appName = "this app", skipConfigured = true, required = [] } = options;

  const providerIds = options.providers || listProviders().map((p) => p.id);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log();
    console.log(`${c.bold}${c.cyan}  byok-ai${c.reset} — API Key Setup`);
    console.log(`${c.dim}  ${appName} needs an AI provider to work.${c.reset}`);
    console.log(`${c.dim}  You only need to configure one provider.${c.reset}`);
    console.log();

    const configured: string[] = [];
    const skipped: string[] = [];

    for (const id of providerIds) {
      const provider = getProvider(id);
      if (!provider) continue;

      // Check if already configured
      const existing = await resolveKey(id);

      if (existing && skipConfigured) {
        console.log(
          `  ${c.green}✓${c.reset} ${c.bold}${provider.name}${c.reset}` +
            `  ${c.dim}(configured via ${existing.source})${c.reset}`,
        );
        configured.push(id);
        continue;
      }

      if (existing) {
        console.log(
          `  ${c.green}✓${c.reset} ${c.bold}${provider.name}${c.reset}` +
            `  ${c.dim}(${maskKey(existing.key)} via ${existing.source})${c.reset}`,
        );
      }

      // Ask for key
      console.log();
      console.log(
        `  ${c.bold}${provider.name}${c.reset}` +
          `  ${c.dim}— Get a key at: ${provider.docsUrl}${c.reset}`,
      );

      const input = await ask(rl, `  ${c.cyan}API Key${c.reset} (or Enter to skip): `);

      if (!input) {
        skipped.push(id);
        console.log(`  ${c.dim}Skipped${c.reset}`);
        continue;
      }

      // Format validation (instant)
      const formatCheck = validateKeyFormat(id, input);
      if (!formatCheck.valid) {
        console.log(`  ${c.yellow}⚠ Warning:${c.reset} ${formatCheck.error}`);
        const proceed = await ask(rl, `  ${c.dim}Save anyway? (y/N):${c.reset} `);
        if (proceed.toLowerCase() !== "y") {
          skipped.push(id);
          continue;
        }
      }

      // Live validation
      console.log(`  ${c.dim}Validating...${c.reset}`);
      const result = await validateKey(id, input);

      if (result.valid) {
        await storeKey(id, input);
        configured.push(id);
        console.log(`  ${c.green}✓ Valid!${c.reset} Key saved.`);

        if (result.meta?.warning) {
          console.log(`  ${c.yellow}⚠ ${result.meta.warning}${c.reset}`);
        }
      } else {
        console.log(`  ${c.red}✗ ${result.error}${c.reset}`);
        const saveAnyway = await ask(rl, `  ${c.dim}Save anyway? (y/N):${c.reset} `);
        if (saveAnyway.toLowerCase() === "y") {
          await storeKey(id, input);
          configured.push(id);
          console.log(`  ${c.dim}Key saved.${c.reset}`);
        } else {
          skipped.push(id);
        }
      }
    }

    // Summary
    console.log();
    console.log(`${c.bold}  Summary${c.reset}`);
    console.log(`${c.dim}  ${"─".repeat(40)}${c.reset}`);

    if (configured.length > 0) {
      console.log(
        `  ${c.green}✓${c.reset} ${configured.length} provider(s) configured: ` +
          `${c.bold}${configured.join(", ")}${c.reset}`,
      );
    }

    if (skipped.length > 0) {
      console.log(`  ${c.dim}○ ${skipped.length} skipped: ${skipped.join(", ")}${c.reset}`);
    }

    // Check required providers
    const missingRequired = required.filter((r) => !configured.includes(r));
    if (missingRequired.length > 0) {
      console.log();
      console.log(
        `  ${c.yellow}⚠ Required providers not configured: ` +
          `${c.bold}${missingRequired.join(", ")}${c.reset}`,
      );
      console.log(`  ${c.dim}${appName} may not work without these.${c.reset}`);
    }

    console.log();
  } finally {
    rl.close();
  }
}
