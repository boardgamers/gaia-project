import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  DEFAULT_BENCHMARK_CONFIG,
  runPhase0Benchmark,
} from "../../src/ai/benchmark";

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
const result = runPhase0Benchmark({
  warmupIterations: numericArgument(args, "--warmup", DEFAULT_BENCHMARK_CONFIG.warmupIterations),
  iterations: numericArgument(args, "--iterations", DEFAULT_BENCHMARK_CONFIG.iterations),
  randomGameWarmupIterations: numericArgument(
    args,
    "--random-warmup",
    DEFAULT_BENCHMARK_CONFIG.randomGameWarmupIterations
  ),
  randomGameIterations: args.includes("--skip-random-games")
    ? 0
    : numericArgument(args, "--random-games", DEFAULT_BENCHMARK_CONFIG.randomGameIterations),
  memoryCloneCount: numericArgument(args, "--memory-clones", DEFAULT_BENCHMARK_CONFIG.memoryCloneCount),
});
const json = JSON.stringify(result, null, 2) + "\n";
const target = stringArgument(args, "--output");

if (target) {
  writeFileSync(resolve(target), json, "utf8");
} else {
  process.stdout.write(json);
}

