import { execFileSync } from "child_process";
import { cpus, freemem, homedir, hostname, platform, release, totalmem, type as osType } from "os";
import { version as enginePackageVersion } from "../../package.json";
import Engine from "../engine";
import { fuzzGame, FuzzGameResult } from "../fuzz/driver";
import { challengeEngineOptions, LOST_FLEET_CHALLENGE } from "./challenge";
import {
  bootChallengeEngine,
  challengeManifestSha256,
  generateChallengeManifest,
  stableManifestJson,
} from "./challenge-manifest";
import { BenchmarkConfig } from "./types";

export const BENCHMARK_SCHEMA_VERSION = "gaia-ai-benchmark/v1" as const;

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  warmupIterations: 5,
  iterations: 50,
  randomGameWarmupIterations: 0,
  randomGameIterations: 1,
  memoryCloneCount: 50,
};

interface TimingSummary {
  status: "measured";
  warmupIterations: number;
  iterations: number;
  unit: "milliseconds";
  min: number;
  median: number;
  mean: number;
  p95: number;
  max: number;
}

function durationMilliseconds(start: [number, number]): number {
  const elapsed = process.hrtime(start);
  return elapsed[0] * 1000 + elapsed[1] / 1e6;
}

function rounded(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function timing(warmupIterations: number, iterations: number, operation: () => unknown): TimingSummary {
  for (let i = 0; i < warmupIterations; i++) {
    operation();
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime();
    operation();
    samples.push(durationMilliseconds(start));
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const percentileIndex = (percentile: number) =>
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1);
  return {
    status: "measured",
    warmupIterations,
    iterations,
    unit: "milliseconds",
    min: rounded(sorted[0]),
    median: rounded(sorted[Math.floor(sorted.length / 2)]),
    mean: rounded(samples.reduce((sum, sample) => sum + sample, 0) / samples.length),
    p95: rounded(sorted[percentileIndex(0.95)]),
    max: rounded(sorted[sorted.length - 1]),
  };
}

function gitCommit(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: __dirname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function relevantEnvironment() {
  const cpuList = cpus();
  return {
    node: process.version,
    v8: process.versions.v8,
    enginePackageVersion,
    os: {
      type: osType(),
      platform: platform(),
      release: release(),
      architecture: process.arch,
    },
    cpu: {
      model: cpuList[0]?.model ?? "unknown",
      logicalCores: cpuList.length,
    },
    memory: {
      totalBytes: totalmem(),
      freeBytesAtStart: freemem(),
    },
    process: {
      pid: process.pid,
      gcExposed: typeof (global as any).gc === "function",
    },
    environment: {
      CI: process.env.CI ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    repository: {
      commit: gitCommit(),
    },
    // Explicitly avoid emitting the actual hostname/home path while recording that they were redacted.
    redactions: {
      hostname: hostname() ? "redacted" : null,
      homeDirectory: homedir() ? "redacted" : null,
    },
  };
}

function cloneOptions() {
  return challengeEngineOptions();
}

function memoryMeasurement(serializedState: string, cloneCount: number) {
  const gc = (global as any).gc as (() => void) | undefined;
  if (gc) {
    gc();
  }
  const before = process.memoryUsage();
  const retainedClones: Engine[] = [];
  for (let i = 0; i < cloneCount; i++) {
    retainedClones.push(Engine.fromData(JSON.parse(serializedState)));
  }
  const after = process.memoryUsage();
  const result = {
    status: "measured" as const,
    method: "retained Engine.fromData(JSON.parse(serializedState)) clones",
    cloneCount,
    gcExposed: !!gc,
    beforeBytes: before,
    afterBytes: after,
    deltaBytes: {
      rss: after.rss - before.rss,
      heapTotal: after.heapTotal - before.heapTotal,
      heapUsed: after.heapUsed - before.heapUsed,
      external: after.external - before.external,
    },
    approximateHeapUsedBytesPerClone: rounded((after.heapUsed - before.heapUsed) / cloneCount),
  };
  // Keep the array live through the second memoryUsage() call.
  if (retainedClones.length !== cloneCount) {
    throw new Error("memory clone workload did not retain the requested clone count");
  }
  return result;
}

function runRandomGame(): FuzzGameResult {
  return fuzzGame(
    {
      gameSeed: LOST_FLEET_CHALLENGE.seed,
      playSeed: `${LOST_FLEET_CHALLENGE.id}-benchmark-random-player-v1`,
      players: LOST_FLEET_CHALLENGE.playerCount,
      lostFleet: true,
    },
    { checkpointEvery: 0, maxLines: 1500 }
  );
}

function validateConfig(config: BenchmarkConfig): void {
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${key} must be a non-negative integer`);
    }
  }
  if (config.iterations < 1) {
    throw new Error("iterations must be at least 1");
  }
  if (config.memoryCloneCount < 1) {
    throw new Error("memoryCloneCount must be at least 1");
  }
}

export function runPhase0Benchmark(overrides: Partial<BenchmarkConfig> = {}) {
  const config = { ...DEFAULT_BENCHMARK_CONFIG, ...overrides };
  validateConfig(config);

  const engine = bootChallengeEngine();
  const serializedState = JSON.stringify(engine);
  const manifest = generateChallengeManifest();
  const manifestJson = stableManifestJson(manifest, 0);
  const prefix = [...LOST_FLEET_CHALLENGE.scriptedPrefix];

  let serializedSink = "";
  const serialize = timing(config.warmupIterations, config.iterations, () => {
    serializedSink = JSON.stringify(engine);
    return serializedSink.length;
  });

  let parsedSink: any;
  const parse = timing(config.warmupIterations, config.iterations, () => {
    parsedSink = JSON.parse(serializedState);
    return parsedSink.phase;
  });

  const hydrateInputs = Array.from({ length: config.warmupIterations + config.iterations }, () =>
    JSON.parse(serializedState)
  );
  let hydrateIndex = 0;
  let engineSink: Engine;
  const hydrate = timing(config.warmupIterations, config.iterations, () => {
    engineSink = Engine.fromData(hydrateInputs[hydrateIndex++]);
    return engineSink.phase;
  });

  const clone = timing(config.warmupIterations, config.iterations, () => {
    engineSink = Engine.fromData(JSON.parse(serializedState));
    return engineSink.phase;
  });

  const commandEngines = Array.from({ length: config.warmupIterations + config.iterations }, () =>
    Engine.fromData(JSON.parse(serializedState))
  );
  let commandIndex = 0;
  let commandCountSink = 0;
  const commandGeneration = timing(config.warmupIterations, config.iterations, () => {
    const commandEngine = commandEngines[commandIndex++];
    commandEngine.availableCommands = undefined;
    commandCountSink = commandEngine.generateAvailableCommands().length;
    return commandCountSink;
  });

  const actionApplication = timing(config.warmupIterations, config.iterations, () => {
    const actionEngine = new Engine([prefix[0]], cloneOptions());
    actionEngine.move(prefix[1]);
    actionEngine.move(prefix[2]);
    return actionEngine.phase;
  });

  const constructorReplay = timing(config.warmupIterations, config.iterations, () => {
    engineSink = new Engine(prefix, cloneOptions());
    return engineSink.phase;
  });

  const hostStyleReplay = timing(config.warmupIterations, config.iterations, () => {
    engineSink = Engine.slowMotion(prefix, cloneOptions(), engine.version);
    return engineSink.phase;
  });

  const randomGameOutcomes: Array<{
    finished: boolean;
    committedLines: number;
    rounds: number;
    failureCount: number;
    finalStateBytes: number;
  }> = [];
  let randomGameResult: FuzzGameResult | undefined;
  let randomGameCall = 0;
  const randomGame =
    config.randomGameIterations > 0
      ? timing(config.randomGameWarmupIterations, config.randomGameIterations, () => {
          randomGameResult = runRandomGame();
          if (randomGameCall++ >= config.randomGameWarmupIterations) {
            randomGameOutcomes.push({
              finished: randomGameResult.finished,
              committedLines: randomGameResult.moves.length,
              rounds: randomGameResult.rounds,
              failureCount: randomGameResult.failures.length,
              finalStateBytes: Buffer.byteLength(JSON.stringify(randomGameResult.engine), "utf8"),
            });
          }
          return randomGameResult.finished;
        })
      : {
          status: "skipped" as const,
          reason: "randomGameIterations was configured as 0",
          warmupIterations: config.randomGameWarmupIterations,
          iterations: 0,
        };

  const result = {
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    challenge: {
      id: LOST_FLEET_CHALLENGE.id,
      version: LOST_FLEET_CHALLENGE.version,
      manifestSchemaVersion: LOST_FLEET_CHALLENGE.schemas.manifest,
      manifestSha256: challengeManifestSha256(manifest),
    },
    configuration: config,
    environment: relevantEnvironment(),
    workloads: {
      serialize,
      parse,
      hydrate,
      clone,
      commandGeneration: {
        ...commandGeneration,
        phase: engine.phase,
        commandsInChallengePrefixState: commandCountSink,
      },
      candidateExpansion: {
        status: "unavailable" as const,
        reason: "Phase 1 candidate-expansion component does not exist in Phase 0",
      },
      actionApplication: {
        ...actionApplication,
        description: "Apply the two scripted faction-choice move lines after deterministic initialization",
      },
      constructorReplay: {
        ...constructorReplay,
        committedMoveLines: prefix.length,
      },
      hostStyleReplay: {
        ...hostStyleReplay,
        committedMoveLines: prefix.length,
        description: "Engine.slowMotion serialize/parse/hydrate between committed lines",
      },
      randomGame: {
        ...randomGame,
        generator: "fuzz/random-player deterministic sampler; not a legal-action enumerator",
        gameSeed: LOST_FLEET_CHALLENGE.seed,
        playSeed: `${LOST_FLEET_CHALLENGE.id}-benchmark-random-player-v1`,
        outcomes: randomGameOutcomes,
      },
      stateSize: {
        status: "measured" as const,
        unit: "UTF-8 JSON bytes",
        challengePrefixState: Buffer.byteLength(serializedState, "utf8"),
        challengeManifest: Buffer.byteLength(manifestJson, "utf8"),
        randomGameFinalState: randomGameResult
          ? Buffer.byteLength(JSON.stringify(randomGameResult.engine), "utf8")
          : null,
      },
      memory: memoryMeasurement(serializedState, config.memoryCloneCount),
    },
  };

  // Keep benchmark sinks observably live until all measurements have completed.
  if (!serializedSink || !parsedSink || !engineSink) {
    throw new Error("benchmark workload sinks were not populated");
  }
  return result;
}

export type Phase0BenchmarkResult = ReturnType<typeof runPhase0Benchmark>;
