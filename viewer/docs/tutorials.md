# Gaia Project tutorials

The regular viewer bundle also exposes `gaiaViewer.launchTutorial(selector, options)`.
BGS hosts the chapter list and passes the chapter ID, progress callback and next-chapter link.
No second viewer bundle is required. Tutorials use the primary viewer, regardless of the user’s
alternate-viewer preference. The legacy viewer does not need a tutorial entry point.

The initial course has four sections:

- **The basics:** mines, terraforming/range, upgrades/research, power, free conversions, Gaiaforming and scoring.
- **Federations:** building value and satellites, the routing trap, green tokens, and advanced technology tiles.
- **Faction differences:** Xenos, Ivits and Terrans. These are examples, not a catalogue of every faction.
- **The Lost Fleet:** exploration, spaceship actions, artifacts and new planets.

## Local preview

From the repository root:

```sh
pnpm --dir viewer package
pnpm --dir viewer tutorial:manifest
pnpm --dir viewer tutorial:preview
```

Open `http://127.0.0.1:5200/?chapter=first-mine`. The manifest at
`viewer/dist/tutorial-manifest.json` provides the BGS sections and chapter cards.
Upload the ordinary viewer JS/CSS and copy the manifest's tutorial metadata to the game version.

## Adding a lesson

`src/tutorial/lessons.ts` contains the text, expected actions and chapter metadata.
`position.ts` prepares deterministic engine states. Gameplay uses the real engine, including
satellite validation and scripted opponent turns. Both the guide buttons and board controls
submit the same actions. The ordinary viewer handles rendering.
Resource names in the guide and answers keep their text labels and use the board's resource icons.

The first `game` snapshot is also the base for a composed turn. The viewer may send several
successively longer partial commands before ending that turn; replay each against `turn`,
then commit the new base only when `engine.newTurn` is true.

Keep chapter IDs stable. Increase a chapter's `version` when changed setup or accepted moves
would invalidate saved actions. Section names and chapter cards are translated by BGS;
in-game lesson text is currently English, like the viewer.

## Validation

```sh
pnpm --dir viewer test:tutorial
pnpm --dir viewer test:tutorial:browser
```

The browser checks walk every chapter at desktop and phone widths and reload after its first step.
Set `CHROMIUM_EXECUTABLE` if Playwright's default browser is not installed. The tests also
check federation membership, satellite costs, Gaiaformer recovery/consumption, research tokens,
final scoring, rejected answers and saved-action replay.

The federation detour lesson uses standard rules (`flexibleFederations` is off). Its initial
planetary institute, academy and mine have value 7, but their detour uses 7 satellites. The first retry
passes through the trading station while retaining the mine: value 9 and 6 satellites. The engine rejects
that group too, because removing the mine’s branch saves 2 satellites. The final valid group is planetary institute, station
and academy, value 8, using 4 satellites and leaving the mine out. This exercises the same validation
as `engine/src/federation.spec.ts` ("should force to add a mine ... if it means fewer satellites").
The [official federation FAQ](https://boardgamegeek.com/thread/2120375/official-federation-faq)
is a useful rules reference. The optional flexible-federation variant is deliberately not taught as
the default rule.
