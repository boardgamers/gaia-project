import { expect } from "chai";
import { BENCHMARK_SCHEMA_VERSION, runPhase0Benchmark } from "./benchmark";

describe("Phase 0 AI benchmark", () => {
  it("runs a very small smoke configuration and reports every workload", () => {
    const result = runPhase0Benchmark({
      warmupIterations: 1,
      iterations: 1,
      randomGameWarmupIterations: 0,
      randomGameIterations: 0,
      memoryCloneCount: 1,
    });

    expect(result.schemaVersion).to.equal(BENCHMARK_SCHEMA_VERSION);
    expect(result.configuration.warmupIterations).to.equal(1);
    expect(result.workloads.serialize.status).to.equal("measured");
    expect(result.workloads.parse.status).to.equal("measured");
    expect(result.workloads.hydrate.status).to.equal("measured");
    expect(result.workloads.clone.status).to.equal("measured");
    expect(result.workloads.commandGeneration.status).to.equal("measured");
    expect(result.workloads.actionApplication.status).to.equal("measured");
    expect(result.workloads.constructorReplay.status).to.equal("measured");
    expect(result.workloads.hostStyleReplay.status).to.equal("measured");
    expect(result.workloads.randomGame.status).to.equal("skipped");
    expect(result.workloads.stateSize.status).to.equal("measured");
    expect(result.workloads.memory.status).to.equal("measured");
    expect(result.workloads.candidateExpansion.status).to.equal("unavailable");
  });
});
