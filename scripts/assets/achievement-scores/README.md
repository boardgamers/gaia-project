# Achievement score source artwork

These are version-controlled **source inputs**, not generated badge outputs. Do not replace them with the unrelated icons under `viewer/public`.

## Gaia Project pictogram

`gaia-pictogram.webp` is the approved Boardgamers.space (BGS) Gaia Project pictogram, copied byte-for-byte from:

https://s3.fr-par.scw.cloud/bgs-assets/assets/gaia-project/pictogram/09bdce75fb8e0020/pictogram.webp

SHA-256: `09bdce75fb8e0020a1b52e9e4352d62bced93b117e94704549e0662e04093a62`

The generator verifies that digest. This provenance identifies the supplied artwork; it does not assert a new license for game artwork. The entire 256×256 transparent image is used, without cropping.

## Pinned raster numerals

`digit-{0,1,2,5}.png` are transparent, tightly bounded raster glyphs from DejaVu Sans Bold (Bitstream copyright; DejaVu changes public domain). See `FONT-LICENSE.txt` and https://dejavu-fonts.github.io/ . They are intentionally pinned so generation needs neither installed fonts nor text/SVG rendering.

Source font SHA-256: `0d977336a6d5fba34eab8e3199eb218327161b5143749f802982c2bc34df0c96` (`DejaVuSans-Bold.ttf`). One-time rasterization used Sharp's text input with `{ text: digit, font: "DejaVu Sans Bold 800", fontfile: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", rgba: true, dpi: 72 }`, followed by `.png().toFile(...)`. The badge generator uses only the resulting alpha masks, recolored with a gentle metallic gradient. No font is loaded at runtime.

Pinned PNG SHA-256 values:

- 0: `cbdbb951c1de0da3d280249c8197e9b66146ad3f3ca6920717049057117ca3ce`
- 1: `a1c07e26fe5cfa1b58552a7fd18723434d6d46c58fe1ffadbd831f94daac7d1c`
- 2: `f38ce297ccdd1b470e1e4a48210617d90a7a6e410570d303cfdf358be002e525`
- 5: `65975965deb89c3b546218ade0f2af28fecb4921278e1fa961a51568242e9b19`

## Rendering and review

Run `node scripts/generate-achievement-portraits.mjs`. The ignored `artifacts/achievement-portraits/` directory contains 512×512 score PNGs and `score-contact-sheet.png`: full-size 150 and 200 badges, followed by 64, 48 and 32 pixel previews from left to right below each. The original faction contact sheet and crops remain unchanged.

Background, sparse stars and beveled rings are analytic raster graphics, supersampled at 4× and downsampled with Lanczos3. Silver distinguishes 150; gold distinguishes 200. All image input/output hashes, rendering geometry, generator hash and library versions are recorded in the manifest. Reproducibility is byte-for-byte for a fixed input/toolchain; no timestamp, random state, network fetch or system font participates.
