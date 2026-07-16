import { writeFileSync } from "fs";
import { resolve } from "path";
import { runMacroCorpusCampaign } from "../../src/ai/testing/corpus";

function numericArgument(args: string[], flag: string, fallback: number): number {
  const index = args.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} requires a non-negative integer`);
  }
  return value;
}

function stringArgument(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

const args = process.argv.slice(2);
const games = numericArgument(args, "--games", 20);
const seedPrefix = stringArgument(args, "--seed-prefix") ?? "phase-1-4-corpus";
const startedAt = Date.now();
const result = runMacroCorpusCampaign({
  playSeeds: Array.from({ length: games }, (_, index) => `${seedPrefix}-${String(index + 1).padStart(2, "0")}`),
  minStates: numericArgument(args, "--min-states", 1000),
  conversionIntegrationEvery: numericArgument(args, "--integration-every", 0),
  afterConversionIntegration: args.includes("--after-conversions"),
  deepCheckEvery: numericArgument(args, "--deep-check-every", 7),
});
const json = JSON.stringify({ ...result, elapsedSeconds: (Date.now() - startedAt) / 1000 }, null, 2) + "\n";
const target = stringArgument(args, "--output");

if (target) {
  writeFileSync(resolve(target), json, "utf8");
} else {
  process.stdout.write(json);
}
