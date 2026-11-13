import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const SOURCE_DIR = path.join(ROOT, "viewer/src/assets/factions");
export const OUTPUT_DIR = path.join(ROOT, "artifacts/achievement-portraits");
export const CROP = Object.freeze({ left: 13, top: 0, width: 167, height: 167 });
export const FACTIONS = Object.freeze([
  "ambas",
  "baltaks",
  "bescods",
  "darkanians",
  "firaks",
  "geodens",
  "gleens",
  "hadsch-hallas",
  "itars",
  "ivits",
  "lantids",
  "moweyds",
  "nevlas",
  "space-giants",
  "taklons",
  "terrans",
  "tinkeroids",
  "xenos",
]);
export const sourceName = (id) => `${id === "moweyds" ? "mowyeds" : id}.jpg`;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const PNG = Object.freeze({ compressionLevel: 9, adaptiveFiltering: false, palette: false });
const CELL = { width: 191, height: 205, columns: 6, rows: 3 };

// Fixed 5x7 column bitmaps: no system fonts, Pango, markup or SVG rendering.
// Labels use uppercase glyphs for the static faction IDs; bit 0 is the top row.
const GLYPHS = Object.fromEntries(
  "A:7e1111117e B:7f49494936 C:3e41414122 D:7f4141221c E:7f49494941 F:7f09090901 G:3e41495132 H:7f0808087f I:00417f4100 J:2040413f01 K:7f08142241 L:7f40404040 M:7f020c027f N:7f0408107f O:3e4141413e P:7f09090906 Q:3e4151215e R:7f09192946 S:4649494931 T:01017f0101 U:3f4040403f V:1f2040201f W:3f4038403f X:6314081463 Y:0708700807 Z:6151494543 -:0808080808"
    .split(" ")
    .map((entry) => {
      const [letter, hex] = entry.split(":");
      return [letter, Buffer.from(hex, "hex")];
    })
);

function label(text) {
  const width = CELL.width;
  const height = 20;
  const data = Buffer.alloc(width * height * 3, 24);
  const scale = 2;
  const start = Math.floor((width - (text.length * 6 - 1) * scale) / 2);
  for (const [index, character] of [...text.toUpperCase()].entries()) {
    const glyph = GLYPHS[character];
    if (!glyph) throw new Error(`Unsupported label character: ${character}`);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 7; y++) {
        if (!(glyph[x] & (1 << y))) continue;
        for (let dx = 0; dx < scale; dx++)
          for (let dy = 0; dy < scale; dy++) {
            const offset = ((y * scale + dy + 3) * width + start + index * 12 + x * scale + dx) * 3;
            data.fill(240, offset, offset + 3);
          }
      }
  }
  return { input: data, raw: { width, height, channels: 3 } };
}

export function validateCrop(width, height, crop = CROP) {
  if (
    ![width, height, crop.left, crop.top, crop.width, crop.height].every(Number.isInteger) ||
    crop.left < 0 ||
    crop.top < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.left + crop.width > width ||
    crop.top + crop.height > height
  ) {
    throw new Error("Crop is outside source bounds");
  }
}

export async function generatePortraits(outputDir = OUTPUT_DIR) {
  // Only the destination changes in tests. Source files and crop policy are fixed.
  const files = (await readdir(SOURCE_DIR)).filter((name) => /\.jpe?g$/i.test(name)).sort();
  const expected = FACTIONS.map(sourceName).sort();
  if (JSON.stringify(files) !== JSON.stringify(expected))
    throw new Error("Expected exactly the 18 mapped faction JPGs");
  const portraits = [];
  const composites = [];
  const outputs = [];
  for (const [index, faction] of FACTIONS.entries()) {
    const input = await readFile(path.join(SOURCE_DIR, sourceName(faction)));
    const metadata = await sharp(input).metadata();
    if (metadata.width !== 392 || metadata.height !== 167) throw new Error(`Unexpected dimensions: ${faction}`);
    validateCrop(metadata.width, metadata.height);
    const png = await sharp(input).extract(CROP).png(PNG).toBuffer();
    const filename = `achievement-faction-${faction}.png`;
    outputs.push([filename, png]);
    portraits.push({
      faction,
      input: {
        path: `viewer/src/assets/factions/${sourceName(faction)}`,
        sha256: sha256(input),
        width: 392,
        height: 167,
      },
      crop: CROP,
      output: { path: filename, sha256: sha256(png), width: 167, height: 167 },
    });
    const left = (index % CELL.columns) * CELL.width;
    const top = Math.floor(index / CELL.columns) * CELL.height;
    composites.push({ input: png, left: left + 12, top: top + 8 });
    composites.push({ ...label(faction), left, top: top + 179 });
  }
  const contact = await sharp({
    create: {
      width: CELL.width * CELL.columns,
      height: CELL.height * CELL.rows,
      channels: 3,
      background: "#181818",
    },
  })
    .composite(composites)
    .png(PNG)
    .toBuffer();
  const manifest = {
    schemaVersion: 1,
    generator: {
      path: "scripts/generate-achievement-portraits.mjs",
      sha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    },
    // No timestamp or absolute path: identical inputs/toolchain give identical artifacts.
    toolchain: {
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      libraries: sharp.versions,
    },
    png: PNG,
    portraits,
    contactSheet: {
      path: "contact-sheet.png",
      sha256: sha256(contact),
      width: CELL.width * CELL.columns,
      height: CELL.height * CELL.rows,
      layout: CELL,
    },
  };
  // All inputs are checked and all images rendered before any output is written.
  await mkdir(outputDir, { recursive: true });
  for (const [name, bytes] of [
    ...outputs,
    ["contact-sheet.png", contact],
    ["manifest.json", JSON.stringify(manifest, null, 2) + "\n"],
  ]) {
    await writeFile(path.join(outputDir, name), bytes);
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) {
    console.error("Usage: pnpm generate:achievement-portraits (writes artifacts/achievement-portraits)");
    process.exitCode = 1;
  } else {
    await generatePortraits();
    console.log(`Generated 18 portraits, contact-sheet.png and manifest.json in ${OUTPUT_DIR}`);
  }
}
