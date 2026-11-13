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

export const SCORES = Object.freeze([150, 200]);
export const SCORE_SOURCE_DIR = path.join(ROOT, "scripts/assets/achievement-scores");
export const SCORE_RENDER = Object.freeze({
  width: 512,
  height: 512,
  supersampling: 4,
  pictogram: { left: 151, top: 57, width: 210, height: 210 },
  digitHeight: 132,
  digitTop: 282,
  digitGap: 12,
});

// Analytic raster shading, sampled at 4x. No SVG, fonts, clock, or random state.
async function renderScore(score, sources) {
  const scale = SCORE_RENDER.supersampling;
  const size = 512 * scale;
  const data = Buffer.alloc(size * size * 3);
  const gold = score === 200;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / scale - 256;
      const py = (y + 0.5) / scale - 256;
      const r = Math.hypot(px, py);
      const angle = Math.atan2(py, px);
      const glow = Math.exp(-((px + 65) ** 2 + (py + 100) ** 2) / 28000);
      let color = [7 + 9 * glow, 13 + 21 * glow, 24 + 28 * glow];
      if (r < 228) {
        const mist = (Math.sin(px / 39 + py / 61) + Math.cos(py / 31 - px / 70) + 2) / 4;
        color = [9 + 8 * glow + 3 * mist, 19 + 26 * glow + 5 * mist, 32 + 32 * glow + 8 * mist];
        // Sparse, fixed star field; gentle points rather than visual noise.
        for (const [sx, sy, radius] of [
          [-154, -116, 1.2],
          [128, -126, 1.3],
          [-176, 2, 1],
          [159, 38, 1.4],
          [-128, 169, 1],
          [104, 174, 1.2],
          [-69, -193, 0.8],
          [173, -60, 0.8],
        ]) {
          const light = Math.max(0, 1 - Math.hypot(px - sx, py - sy) / (radius * 2));
          color = color.map((c) => c + 110 * light);
        }
      }
      if (r >= 228 && r < 249) {
        const bevel = Math.sin(((r - 228) / 21) * Math.PI);
        const light = 0.52 + 0.32 * Math.cos(angle + 2.2) + 0.16 * Math.cos(angle * 3 - 1);
        const metal = 48 + 170 * light * bevel;
        color = gold ? [metal * 1.13, metal * 0.94, metal * 0.59] : [metal * 0.87, metal, metal * 1.08];
        if (r < 230 || r > 247) color = gold ? [150, 126, 74] : [119, 154, 170];
        if (r > 233 && r < 235) color = [24, 38, 46];
      }
      if (r >= 249 && r < 252) color = [3, 7, 13];
      const offset = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) data[offset + c] = Math.min(255, Math.round(color[c]));
    }
  const layers = [];
  const icon = SCORE_RENDER.pictogram;
  layers.push({
    input: await sharp(sources.get("gaia-pictogram.webp"))
      .resize(icon.width * scale, icon.height * scale)
      .png(PNG)
      .toBuffer(),
    left: icon.left * scale,
    top: icon.top * scale,
  });
  const digits = [];
  for (const digit of String(score)) {
    const mask = await sharp(sources.get(`digit-${digit}.png`))
      .resize({ height: SCORE_RENDER.digitHeight * scale })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = mask.info;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        const t = y / height;
        const color = gold ? [255 - 22 * t, 247 - 43 * t, 209 - 65 * t] : [249 - 35 * t, 254 - 26 * t, 255 - 18 * t];
        for (let c = 0; c < 3; c++) mask.data[offset + c] = Math.round(color[c]);
      }
    digits.push({ input: mask.data, raw: { width, height, channels }, width });
  }
  let left = Math.round((size - digits.reduce((sum, d) => sum + d.width, 0) - SCORE_RENDER.digitGap * scale * 2) / 2);
  for (const { width, ...digit } of digits) {
    layers.push({ ...digit, left, top: SCORE_RENDER.digitTop * scale });
    left += width + SCORE_RENDER.digitGap * scale;
  }
  const high = await sharp(data, { raw: { width: size, height: size, channels: 3 } })
    .composite(layers)
    .png(PNG)
    .toBuffer();
  return sharp(high).resize(512, 512, { kernel: "lanczos3" }).png(PNG).toBuffer();
}

async function generateScores() {
  const sources = new Map();
  const inputs = [];
  for (const name of ["gaia-pictogram.webp", "digit-0.png", "digit-1.png", "digit-2.png", "digit-5.png"]) {
    const bytes = await readFile(path.join(SCORE_SOURCE_DIR, name));
    sources.set(name, bytes);
    const { width, height } = await sharp(bytes).metadata();
    inputs.push({ path: `scripts/assets/achievement-scores/${name}`, sha256: sha256(bytes), width, height });
  }
  if (inputs[0].sha256 !== "09bdce75fb8e0020a1b52e9e4352d62bced93b117e94704549e0662e04093a62")
    throw new Error("Unapproved Gaia pictogram");
  const outputs = [],
    scores = [],
    layers = [];
  for (const [index, score] of SCORES.entries()) {
    const png = await renderScore(score, sources);
    const filename = `achievement-score-${score}.png`;
    outputs.push([filename, png]);
    scores.push({ score, output: { path: filename, sha256: sha256(png), width: 512, height: 512 } });
    layers.push({ input: png, left: 16 + index * 544, top: 16 });
    for (const [i, size] of [64, 48, 32].entries())
      layers.push({
        input: await sharp(png).resize(size, size).png(PNG).toBuffer(),
        left: 152 + index * 544 + i * 88,
        top: 552,
      });
  }
  const sheet = await sharp({ create: { width: 1088, height: 640, channels: 3, background: "#181818" } })
    .composite(layers)
    .png(PNG)
    .toBuffer();
  outputs.push(["score-contact-sheet.png", sheet]);
  return {
    outputs,
    inputs,
    scores,
    contactSheet: {
      path: "score-contact-sheet.png",
      sha256: sha256(sheet),
      width: 1088,
      height: 640,
      previews: [64, 48, 32],
    },
  };
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
  const scoreAssets = await generateScores();
  outputs.push(...scoreAssets.outputs);
  const manifest = {
    schemaVersion: 2,
    scoreInputs: scoreAssets.inputs,
    scoreRender: SCORE_RENDER,
    scores: scoreAssets.scores,
    scoreContactSheet: scoreAssets.contactSheet,
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
    console.log(`Generated 18 portraits, 2 score badges, both contact sheets and manifest.json in ${OUTPUT_DIR}`);
  }
}
