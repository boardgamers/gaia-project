# Gaia achievement scenes

Original editable geometry: `scripts/generate-achievement-scenes.mjs` (MIT, repository licence).
Related coordination: https://codeberg.org/boardgamers/boardgamers/issues/595.
The generator exports **only the 14 formerly missing assets**. It never calls the portrait
or score generator and never writes existing artwork. Generated SVGs, PNGs, source/output
SHA-256 manifest and light/dark 160/64/48/32 px contact sheet are under the ignored
`artifacts/achievement-scenes/` directory.

## Provenance and visual vocabulary

No downloaded images, embedded publisher art, fonts-as-outlines, SVGRepo art or existing
portrait/score pixels are included in the new badges. The geometric SVG paths are original,
not copied from the game's SVG files. Text is confined to contact-sheet labels and the
four supplementary Ivits milestone numbers; it is not the primary scene.

Conceptual references (not licensed inputs or claims of official publisher artwork):

- Standard Gaia building silhouettes: pitched mine, tall trading station, domed laboratory,
  pyramidal institute and divided academy. Full Deployment depicts 8/4/3/1/2, respectively.
- Base mode: a colony and ordinary planet spectrum. Lost Fleet mode: the colony surrounded
  by the four ship insignia, independently simplified as spiral/orbit/leaves/claw, following
  the vocabulary documented in `viewer/src/components/SpaceshipEmblem.reference.md`.
- Automa: decision-card tactics with five separately arranged networks. The network layouts
  are illustrations of increasing opposition, **not actual card faces or cumulative awards**.
- Federation Builder: four separate building-and-satellite groups. Ivits: one continuous
  connected route with four ordered milestones, not four separate federation rewards.
- World sets: nine/eleven owned colonies, including Gaia and Lost; Fleet adds asteroid
  and protoplanet. World marks are schematic surface patterns, not official planet art.
- Original faction head glyphs identify the red/ear-cased Ivits, crested aquatic Lantids,
  and mechanical Bescods. These are new simplified interpretations, not recropped portraits.
  Lantids depicts six host/guest pairs; Bescods six markers at level three. No victory
  crown or laurel is used for any of these non-winning feats.

The already-published 18 portraits and two score images remain untouched; their existing
provenance is not relicensed here. `preserved-assets.json` pins the verified public URLs and
full hashes; it is **not an upload list**. `preserved-sources.json` pins all faction/score
inputs and the old generator. `baseline-manifest.json` and `baseline-evaluator.sha256` pin
canonical `origin/master` commit `8861fe0121c9ea697c0b34b265f74a34fd782fc0`
(engine 4.17.9 / revision 4) for no-ID/predicate-change tests.

## Reproduction and checks

```sh
pnpm install --frozen-lockfile
pnpm --dir engine build
pnpm generate:achievement-scenes
pnpm test:achievement-scenes
pnpm test:achievement-portraits
pnpm --dir engine test -- --timeout 10000
pnpm --dir engine lint
```

New engine is 4.17.10 / revision 5, protocol remains 0.11.0. No dependency change is
needed, so the frozen workspace lockfile remains unchanged. `GAIA_ART_PACK_ROOT` may point
the scene tests at an extracted tarball to test the exact packed hooks and packaged source.
These are author checks, **not independent review or permission to publish**. Engine POST
activates immediately: only upload after independent visual/code approval and anonymous
verification of all new named assets. Existing asset keys must not be PUT.
