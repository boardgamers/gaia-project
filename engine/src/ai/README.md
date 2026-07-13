# Lost Fleet AI: Phase 0 foundation

This directory is an offline-only foundation for the fixed Lost Fleet AI challenge. It is deliberately
not exported from `engine/index.ts` and must not be imported by the viewer, hosted-game code, Supabase,
or another production entry point.

Phase 0 contains only:

- a versioned static challenge definition;
- a manifest generator that boots the real engine and projects the initialized challenge setup;
- a reproducible benchmark harness;
- golden and smoke tests for those offline tools.

It does not contain candidate expansion, search, evaluation, bots, feature encoding, models, hosted
routes, or production feature flags. Starting buildings and round boosters are intentionally not part
of the scripted challenge prefix: both remain strategic decisions.

## Safety invariants

1. Production code must never import from `src/ai/` during the live-game freeze.
2. The AI code may read public engine state and call existing engine APIs, but may not change engine
   rules, move processing, availability, serialization, hydration, or replay behavior.
3. The checked-in challenge manifest is generated from a real engine boot. Tile, map, ship, artifact,
   and effect values are not transcribed from strategy prose.
4. Benchmarks are descriptive baselines. Phase 0 has no machine-specific performance pass/fail gates.
5. The fuzz random player is used only for a labeled full-game benchmark workload. It is a sampler,
   not a complete legal-action enumerator.

## Offline commands

Run from `engine/`:

```text
npx ts-node scripts/ai/generate-challenge-manifest.ts
npx ts-node scripts/ai/benchmark.ts --warmup 5 --iterations 50 --random-games 1
```

Both commands write JSON to standard output by default. `--output <path>` is available for an explicit
offline artifact path. The benchmark also accepts `--random-warmup`, `--memory-clones`, and
`--skip-random-games`.

## Phase 1.1: canonical committed-state projection

`canonical-state.ts` adds an offline-only, versioned canonical projection and SHA-256 hash for
committed engine states. It is intentionally narrow:

- committed states only: `engine.newTurn === true`;
- initialized game states only: `phase !== setupInit`, `map` exists, players exist;
- non-replay instances only;
- standard faction-picking flow only: no auction variant, no random-factions flow, no ban phase;
- Lost Fleet states must carry their persisted setup-randomization fields (`lostFleetTerraformingRow`,
  `scoringExtensionSide`, `lostFleetEconomySide`);
- transient in-line prompt state is rejected (`turnMoves`, `pendingMove`, unresolved brainstone /
  reward-pick state, nonzero temporary range/step, nonzero `turns`).

Included state families:

- engine version plus supported game options that can still affect future behavior;
- phase, round, current/temp actors, turn orders, passed players, leech queue, last leech source;
- chosen faction order, board/spaceship action ownership, Lost Fleet setup choices, and remaining
  tile / token / artifact supplies;
- map placement plus every hex's future-relevant state;
- every player's faction / variant / resource / power / research / building / ship / exploration /
  federation / artifact / event state;
- `player.federationCache`, intentionally included despite the name because current engine behavior
  can diverge when that cache is stale.

Excluded or normalized fields:

- `availableCommands`, `availableCommand`: derived command caches, regenerated on demand;
- `moveHistory`, `advancedLog`, `silentAuctionLog`: replay / presentation / audit history only;
- `pendingMove`, `turnMoves`, `brainstoneDest`, `toPick`, `temporaryRange`, `temporaryStep`, `turns`:
  transient in-line state, rejected unless cleared;
- `oldPhase`, `processedPlayer`, `replayVersion`, `replay`, `subPhase`: unused or replay-only
  scaffolding under the supported-state contract;
- `map.rng`, `map.seed`, `map.distanceCache`: non-serializable RNG/cache state; future randomness is
  unsupported in Phase 1.1 outside the standard faction-picking flow, and distance is recomputed;
- `player.settings`, `player.name`, `player.declined`: UI / automation state, not future game rules
  under the committed-state contract;
- `player.data.occupied`: reconstructed from map hex occupancy;
- `engine.options.map`: duplicated by canonical map placement;
- `engine.options.auction`, `engine.options.randomFactions`, `engine.options.banPhase`,
  `engine.randomFactions`, `engine.bannedFactions`, `engine.silentAuctionBids`: unsupported
  faction-picking variants, rejected instead of canonicalized;
- semantically unordered collections are sorted in the projection (`tiles.artifacts`,
  `lostFleetCost3Planets`, `artifactPlanetTypes`, `usedTinkeringTiles`, hex membership lists).

Deferred:

- candidate-key parity remains out of scope until candidate expansion exists.

## Future shared-engine correction: maintenance-window checklist

No shared-engine correction may be folded into AI work. Before making one, all boxes below must be
checked in a separately approved maintenance window:

- [ ] The owner has explicitly opened a maintenance window and approved the proposed scope.
- [ ] A minimized regression fixture demonstrates the discrepancy without relying on AI code.
- [ ] Constructor replay and host-style serialize/parse/hydrate/action replay parity tests exist.
- [ ] Compatibility for existing serialized games has a written decision; behavior is version-gated
      when old records must retain old semantics.
- [ ] The change has an isolated rollback plan and does not require rewriting hosted game records.
- [ ] The complete engine suite and relevant viewer/host integration tests pass with quiet reporters.
- [ ] The diff has been audited for availability, move, serialization, replay, viewer, Supabase, and
      deployment impact.
- [ ] Production deployment timing and active-game risk have been reviewed with the owner.
- [ ] The owner has explicitly approved commit, push, and deployment after reviewing the evidence.
