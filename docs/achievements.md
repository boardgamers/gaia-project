# Achievements

The engine implements optional Boardgamers.space (BGS) achievement hooks in
[`engine/src/achievements.ts`](../engine/src/achievements.ts), re-exported as named
exports by `engine/wrapper.ts`. This is engine-side support, not a BGS publication
or a claim that achievements have been enabled on the hosted service.

## Hook contract

- `achievementDefinitions()` returns `{ revision: 2, achievements }`. Each definition
  has string `id`, `name`, and `description` fields and an optional strict `icon`:
  `{ type: "asset", key: string }` or `{ type: "text", text: string }`. Asset keys
  match `^[a-z0-9][a-z0-9-]{0,63}$`; text matches `^[A-Za-z0-9]{1,4}$`. No URLs,
  style, crop, HTML, or SVG payloads are accepted. The complete 36-entry catalog is
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

## Revision 2 catalog (36 stable IDs)

IDs follow BGS's `^[a-z0-9][a-z0-9-]{0,63}$` validator: lowercase letters,
ASCII digits, and hyphens, at most 64 characters. All 36 IDs are unique. The
pre-publication dotted spellings were replaced with hyphens; they are not aliases
and were never published. Revision 2 adds icons without changing revision 1's IDs
or earned predicates: 18 faction asset references, four 150/200 text emblems,
and no icon on the remaining 14 definitions.

**Deployment order:** the platform icon contract (platform commit
`fca050c9509c1dec3afd8d4631cc57245f834f29`, platform PR
[578](https://codeberg.org/boardgamers/boardgamers/pulls/578)) must be deployed
before activating this revision-2 manifest. Older strict validators reject `icon`.
No production assets or achievement activation are implied by this source change.

### Faction victories (18)

Each requires a win as the named faction; either ruleset qualifies where that
faction is available.

| ID                          | Faction       |
| --------------------------- | ------------- |
| `win-faction-terrans`       | Terrans       |
| `win-faction-lantids`       | Lantids       |
| `win-faction-hadsch-hallas` | Hadsch Hallas |
| `win-faction-ivits`         | Ivits         |
| `win-faction-geodens`       | Geodens       |
| `win-faction-baltaks`       | Bal T'aks     |
| `win-faction-xenos`         | Xenos         |
| `win-faction-gleens`        | Gleens        |
| `win-faction-taklons`       | Taklons       |
| `win-faction-ambas`         | Ambas         |
| `win-faction-firaks`        | Firaks        |
| `win-faction-bescods`       | Bescods       |
| `win-faction-nevlas`        | Nevlas        |
| `win-faction-itars`         | Itars         |
| `win-faction-tinkeroids`    | Tinkeroids    |
| `win-faction-darkanians`    | Darkanians    |
| `win-faction-moweyds`       | Moweyds       |
| `win-faction-space-giants`  | Space Giants  |

### Ruleset victories and scores (6)

| ID                     | Requirement                                         |
| ---------------------- | --------------------------------------------------- |
| `win-mode-base`        | Win a base game                                     |
| `win-mode-lost-fleet`  | Win a Lost Fleet game                               |
| `score-base-150`       | Finish a base game with at least 150 final VP       |
| `score-base-200`       | Finish a base game with at least 200 final VP       |
| `score-lost-fleet-150` | Finish a Lost Fleet game with at least 150 final VP |
| `score-lost-fleet-200` | Finish a Lost Fleet game with at least 200 final VP |

`options.lostFleet` selects the ruleset; a Lost Fleet game does not also award base
mode IDs. Score achievements require **no win**, and 200 VP earns both thresholds
for the selected mode.

### Automa victories (5)

| ID                        | Exact difficulty |
| ------------------------- | ---------------- |
| `win-automa-automalein`   | `automalein`     |
| `win-automa-automa`       | `automa`         |
| `win-automa-automaechtig` | `automaechtig`   |
| `win-automa-ultoma`       | `ultoma`         |
| `win-automa-alptrauma`    | `alptrauma`      |

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
| `build-all-standard`                  | All 18 standard building pieces simultaneously deployed at game end          |
| `federation-form-3`                   | At least three federation formations in one game                             |
| `explore-all-types-base`              | Main-owned colonies on all 9 required physical types in a base game          |
| `explore-all-types-lost-fleet`        | Main-owned colonies on all 11 required physical types in a Lost Fleet game   |
| `faction-ivits-growing-federation`    | As Ivits, at least three federation formation milestones                     |
| `faction-lantids-shared-civilization` | As Lantids, at least six additional mines on opponents' colonies at game end |
| `faction-bescods-balanced-research`   | As Bescods, finish at level 3 or higher on all six research tracks           |

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

## Portrait assets and release procedure

Faction win icons reference **named game assets**, not viewer-bundle URLs:
`achievement-faction-<faction-id>`. Score badges use platform-rendered text `150`
or `200`, shared across the two rulesets, and require no uploaded image.

Source artwork is in `viewer/src/assets/factions/*.jpg`, with provenance in
[`viewer/src/assets/factions/README.md`](../viewer/src/assets/factions/README.md).
Artwork is by Dennis Lohausen, published by Feuerland Spiele, used with publisher
permission as confirmed by BGS; it is **not** covered by the source-code license.
The faction `moweyds` intentionally maps to source file `mowyeds.jpg`.

Generate local release inputs (no network requests or uploads):

```sh
pnpm install --frozen-lockfile
pnpm run generate:achievement-portraits
pnpm run test:achievement-portraits
```

The generator crops a 167×167 square at x=13, y=0 from each 392×167 header,
matching the existing viewer's left-side portrait framing. Outputs are square
raster PNGs without a baked-in circular mask; the platform controls presentation.
Outputs are written to `artifacts/achievement-portraits/`: 18
`achievement-faction-<id>.png` files, `contact-sheet.png` (all 18 labeled crops),
and `manifest.json` recording source/output hashes, crop coordinates and toolchain.
Review all 18 crops on the generated contact sheet before uploading. Generated
assets are ignored build outputs, not committed artwork copies. The source map,
crop coordinates and dependency lockfile are the reproducible inputs.

**Release only after separate publication authorization:**

1. Deploy the platform's revision-2 icon support first; do not activate this
   engine's icon manifest against an older strict schema.
2. Generate and visually inspect the portraits locally. Keep the generated
   input/output hash manifest with the release verification record.
3. For each generated `achievement-faction-<id>.png`, upload its raw bytes to
   `PUT /api/admin/gameinfo/gaia-project/assets/achievement-faction-<id>` with
   `Content-Type: image/png` and the authorized admin bearer token. This is the
   **version-independent named game asset** endpoint, not `/gaia-project/3/viewer`.
   Do not upload the contact sheet or hash manifest as achievement images.
4. BGS re-encodes images to WebP and records the content-hashed URL under the
   metadata asset key. Verify all 18 keys resolve to the expected portraits and
   verify the platform fallback for a missing asset. Do not invent public URLs
   or embed them in engine definitions; viewer-bundle retention is irrelevant.
5. Only then publish/activate the engine/catalog through the normal authorized
   release workflow and verify portraits and 150/200 emblems in the platform UI.

This PR generates inputs only: no named asset is claimed to exist in production,
and no upload, engine publication, npm publication or BGS activation is performed.

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
