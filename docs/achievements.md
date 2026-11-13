# Achievements

The engine implements optional Boardgamers.space (BGS) achievement hooks in
[`engine/src/achievements.ts`](../engine/src/achievements.ts), re-exported as named
exports by `engine/wrapper.ts`. This is engine-side support, not a BGS publication
or a claim that achievements have been enabled on the hosted service.

## Hook contract

- `achievementDefinitions()` returns `{ revision: 1, achievements }`. Each definition
  has string `id`, `name`, and `description` fields. The complete 36-entry catalog is
  returned regardless of the current game's ruleset or selected factions.
- `achievements(data)` accepts an `Engine` or serialized engine state and returns
  `{ seat, earned, outcome? }[]`. `earned` contains catalog IDs. The structural
  outcome type allows `"win" | "loss" | "draw"`; this implementation emits only
  `"win"` and `"loss"` for eligible humans, because shared first place is a win.
- These optional exports use local structural TypeScript interfaces. They add no
  runtime protocol dependency and require no protocol-package upgrade to expose
  the hooks. Consuming and publishing awards remains a host integration concern.

### Authoritative completion only

The caller must supply authoritative completed game state, not a client view or
an arbitrary analysis position. Evaluation requires all three of:

1. `phase === Phase.EndGame`;
2. `round === Round.LastRound`;
3. an `advancedLog` entry whose phase is `Phase.EndGame`, emitted by final scoring.

Otherwise the hook returns `[]`. Merely ending or terminating a game is not enough.
The hook does not advance play, replay moves, or recompute final scoring. It reads
stored final victory points, including auction deductions already applied. The
completion marker is a state predicate, not proof that untrusted input is genuine;
a host must not accept fabricated client state as authoritative.

Seats are zero-based indices in the engine's **human-player list**, in original
player order after removing Automa players; they are not raw engine player numbers.
Automa never receives a result. Dropped humans retain their human seat index and
return `{ seat, earned: [] }`, with no outcome, rather than shifting later seats.

## Revision 1 catalog (36 IDs)

### Faction victories (18)

Each requires a win as the named faction; either ruleset qualifies where that
faction is available.

| ID                          | Faction       |
| --------------------------- | ------------- |
| `win.faction.terrans`       | Terrans       |
| `win.faction.lantids`       | Lantids       |
| `win.faction.hadsch-hallas` | Hadsch Hallas |
| `win.faction.ivits`         | Ivits         |
| `win.faction.geodens`       | Geodens       |
| `win.faction.baltaks`       | Bal T'aks     |
| `win.faction.xenos`         | Xenos         |
| `win.faction.gleens`        | Gleens        |
| `win.faction.taklons`       | Taklons       |
| `win.faction.ambas`         | Ambas         |
| `win.faction.firaks`        | Firaks        |
| `win.faction.bescods`       | Bescods       |
| `win.faction.nevlas`        | Nevlas        |
| `win.faction.itars`         | Itars         |
| `win.faction.tinkeroids`    | Tinkeroids    |
| `win.faction.darkanians`    | Darkanians    |
| `win.faction.moweyds`       | Moweyds       |
| `win.faction.space-giants`  | Space Giants  |

### Ruleset victories and scores (6)

| ID                     | Requirement                                         |
| ---------------------- | --------------------------------------------------- |
| `win.mode.base`        | Win a base game                                     |
| `win.mode.lost-fleet`  | Win a Lost Fleet game                               |
| `score.base.150`       | Finish a base game with at least 150 final VP       |
| `score.base.200`       | Finish a base game with at least 200 final VP       |
| `score.lost-fleet.150` | Finish a Lost Fleet game with at least 150 final VP |
| `score.lost-fleet.200` | Finish a Lost Fleet game with at least 200 final VP |

`options.lostFleet` selects the ruleset; a Lost Fleet game does not also award base
mode IDs. Score achievements require **no win**, and 200 VP earns both thresholds
for the selected mode.

### Automa victories (5)

| ID                        | Exact difficulty |
| ------------------------- | ---------------- |
| `win.automa.automalein`   | `automalein`     |
| `win.automa.automa`       | `automa`         |
| `win.automa.automaechtig` | `automaechtig`   |
| `win.automa.ultoma`       | `ultoma`         |
| `win.automa.alptrauma`    | `alptrauma`      |

Only the configured difficulty's ID is earned, not all lower difficulties.
In both multiplayer and solo Automa games, a human at the highest final score
wins: ties for first count as wins, including a human tied with Automa. Winners
also earn their faction and mode victory IDs. The comparison uses the maximum
stored VP across engine players, including Automa.

### General and faction feats (7)

None of these feats requires a win. They still require an eligible, non-dropped
human in an authoritatively completed game.

| ID                                    | Requirement                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `build.all-standard`                  | All 18 standard building pieces simultaneously deployed at game end          |
| `federation.form.3`                   | At least three federation formations in one game                             |
| `explore.all-types.base`              | Main-owned colonies on all 9 required physical types in a base game          |
| `explore.all-types.lost-fleet`        | Main-owned colonies on all 11 required physical types in a Lost Fleet game   |
| `faction.ivits.growing-federation`    | As Ivits, at least three federation formation milestones                     |
| `faction.lantids.shared-civilization` | As Lantids, at least six additional mines on opponents' colonies at game end |
| `faction.bescods.balanced-research`   | As Bescods, finish at level 3 or higher on all six research tracks           |

**Full deployment:** the standard supply is 8 mines, 4 trading stations, 3 research
labs, 1 planetary institute, and both academies (18 pieces). The predicate checks
each standard building counter against its faction-board maximum. Lost Planet,
artifacts, Gaiaformers, and space stations do not count. Upgrading returns lower-tier
pieces to supply, so building new colonies and refilling those tiers makes all 18
simultaneously deployed structurally possible; upgrades do not impose a permanent
shortfall. Difficulty and practical attainability within a legal game's economy
remain uncalibrated. That is not an implementation blocker, nor is structural
possibility a claim of a demonstrated legal all-18 game.

**Federations:** use `federationCount`, not federation-token inventory. Rewards and
rescores do not count as formations. Ivits' growing-federation extensions count as
formation milestones; qualifying Ivits earn both the general and faction feat.

**Physical colony types:** the base set is Terra, Desert, Swamp, Oxide, Volcanic,
Titanium, Ice, Gaia, and Lost Planet (9). Lost Fleet adds Asteroid and Protoplanet
(11). Transdimensional (`m`) and empty space (`e`) are not required colony types.
The evaluator reads physical planets from `ownedPlanets`, not the broader scoring
condition that includes virtual artifact planet types. Artifact bonuses cannot
substitute for a physical colony. Gaiaformers and Lantids' shared/additional mines
do not satisfy this main-ownership requirement. Lantids' additional mines instead
count toward their separate shared-civilization feat.

## Verification and scope

Predicate tests may construct or modify final-state counters, scores, ownership,
and completion markers to isolate thresholds, exclusions, and seat mapping. Such
synthetic states test the evaluator contract; they do **not** prove that every feat
can be reached through legal play. A legal completed-game fixture exercises the
real completion/scoring path and serialization, but proves attainability only for
feats actually demonstrated by that fixture. In particular, do not interpret a
synthetic all-18 assertion as a legal all-18 playthrough or difficulty calibration.

These hooks do not publish a BGS catalog, persist account awards, or deploy the
engine to BGS. Those host-side operations are outside this implementation.
