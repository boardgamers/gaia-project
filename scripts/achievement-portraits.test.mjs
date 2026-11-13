import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  CROP,
  FACTIONS,
  ROOT,
  SCORES,
  SCORE_RENDER,
  SCORE_SOURCE_DIR,
  SOURCE_DIR,
  generatePortraits,
  sha256,
  sourceName,
  validateCrop,
} from "./generate-achievement-portraits.mjs";

test("18 unique faction mappings, including the legacy Moweyds filename", async () => {
  assert.equal(FACTIONS.length, 18);
  assert.equal(new Set(FACTIONS).size, 18);
  assert.equal(sourceName("moweyds"), "mowyeds.jpg");
  for (const id of FACTIONS.filter((id) => id !== "moweyds")) assert.equal(sourceName(id), `${id}.jpg`);
  assert.deepEqual(
    (await readdir(SOURCE_DIR)).filter((name) => name.endsWith(".jpg")).sort(),
    FACTIONS.map(sourceName).sort()
  );
  assert.deepEqual(CROP, { left: 13, top: 0, width: 167, height: 167 });
  assert.doesNotThrow(() => validateCrop(392, 167));
  for (const crop of [
    { ...CROP, left: -1 },
    { ...CROP, top: 1 },
    { ...CROP, left: 226 },
    { ...CROP, width: 0 },
    { ...CROP, height: 168 },
    { ...CROP, left: 1.5 },
  ])
    assert.throws(() => validateCrop(392, 167, crop), /bounds/);
});

test("generation is byte-deterministic, exact pixel crops, labeled contact sheet, and read-only sources", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "achievement-portraits-"));
  const sourceFiles = await readdir(SOURCE_DIR);
  const before = new Map(
    await Promise.all(sourceFiles.map(async (name) => [name, sha256(await readFile(path.join(SOURCE_DIR, name)))]))
  );
  const scoreSourceFiles = await readdir(SCORE_SOURCE_DIR);
  const scoreBefore = new Map(
    await Promise.all(
      scoreSourceFiles.map(async (name) => [name, sha256(await readFile(path.join(SCORE_SOURCE_DIR, name)))])
    )
  );
  try {
    const first = path.join(temporary, "first");
    const second = path.join(temporary, "second");
    const manifest = await generatePortraits(first);
    assert.deepEqual(await generatePortraits(second), manifest);
    const expectedFiles = [
      ...FACTIONS.map((id) => `achievement-faction-${id}.png`),
      ...SCORES.map((score) => `achievement-score-${score}.png`),
      "score-contact-sheet.png",
      "contact-sheet.png",
      "manifest.json",
    ].sort();
    assert.deepEqual((await readdir(first)).sort(), expectedFiles);
    assert.deepEqual((await readdir(second)).sort(), expectedFiles);
    for (const name of expectedFiles)
      assert.deepEqual(await readFile(path.join(first, name)), await readFile(path.join(second, name)));
    assert.deepEqual(JSON.parse(await readFile(path.join(first, "manifest.json"), "utf8")), manifest);
    assert.deepEqual(SCORES, [150, 200]);
    assert.equal(manifest.schemaVersion, 2);
    assert.deepEqual(manifest.scoreRender, SCORE_RENDER);
    assert.deepEqual(
      manifest.scores.map((item) => item.score),
      [150, 200]
    );
    assert.equal(manifest.generator.sha256, sha256(await readFile(path.join(ROOT, manifest.generator.path))));
    assert.deepEqual(manifest.toolchain.libraries, sharp.versions);
    assert.deepEqual(
      manifest.scoreInputs.map((item) => path.basename(item.path)),
      ["gaia-pictogram.webp", "digit-0.png", "digit-1.png", "digit-2.png", "digit-5.png"]
    );
    for (const input of manifest.scoreInputs) {
      const bytes = await readFile(path.join(ROOT, input.path));
      assert.equal(input.sha256, sha256(bytes));
      const metadata = await sharp(bytes).metadata();
      assert.equal(input.width, metadata.width);
      assert.equal(input.height, metadata.height);
    }
    assert.equal(manifest.scoreInputs[0].sha256, "09bdce75fb8e0020a1b52e9e4352d62bced93b117e94704549e0662e04093a62");
    assert.notEqual(manifest.scores[0].output.sha256, manifest.scores[1].output.sha256);
    for (const item of [...manifest.scores.map((s) => s.output), manifest.scoreContactSheet]) {
      const png = await readFile(path.join(first, item.path));
      assert.equal(sha256(png), item.sha256);
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, item.width);
      assert.equal(metadata.height, item.height);
      const stats = await sharp(png).removeAlpha().stats();
      assert.ok(stats.entropy > 4, "Nontrivial raster detail");
      for (const channel of stats.channels.slice(0, 3)) assert.ok(channel.stdev > 30);
    }
    const scoreSheet = path.join(first, "score-contact-sheet.png");
    for (const [index, item] of manifest.scores.entries()) {
      assert.equal(item.output.width, 512);
      assert.equal(item.output.height, 512);
      const badge = path.join(first, item.output.path);
      const full = await sharp(scoreSheet)
        .extract({ left: 16 + index * 544, top: 16, width: 512, height: 512 })
        .raw()
        .toBuffer();
      assert.deepEqual(full, await sharp(badge).raw().toBuffer());
      for (const [i, size] of [64, 48, 32].entries()) {
        const preview = await sharp(scoreSheet)
          .extract({ left: 152 + index * 544 + i * 88, top: 552, width: size, height: size })
          .raw()
          .toBuffer();
        assert.deepEqual(preview, await sharp(badge).resize(size, size).raw().toBuffer());
      }
    }
    assert.equal(manifest.portraits.length, 18);
    for (const item of manifest.portraits) {
      const original = await readFile(path.join(SOURCE_DIR, sourceName(item.faction)));
      assert.equal(item.input.sha256, sha256(original));
      const source = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(source.info.width, 392);
      assert.equal(source.info.height, 167);
      const png = await readFile(path.join(first, item.output.path));
      assert.equal(sha256(png), item.output.sha256);
      const metadata = await sharp(png).metadata();
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, 167);
      assert.equal(metadata.height, 167);
      const actual = await sharp(png).removeAlpha().raw().toBuffer();
      // Independently slice decoded source scanlines rather than reuse sharp.extract.
      const expected = Buffer.concat(
        Array.from({ length: 167 }, (_, y) => {
          const start = (y * 392 + 13) * source.info.channels;
          return source.data.subarray(start, start + 167 * source.info.channels);
        })
      );
      assert.deepEqual(actual, expected, item.faction);
    }
    const contact = await readFile(path.join(first, "contact-sheet.png"));
    assert.equal(sha256(contact), manifest.contactSheet.sha256);
    const metadata = await sharp(contact).metadata();
    assert.equal(metadata.width, 1146);
    assert.equal(metadata.height, 615);
    for (let i = 0; i < 18; i++) {
      const left = (i % 6) * 191;
      const top = Math.floor(i / 6) * 205;
      const portrait = await sharp(contact)
        .extract({ left: left + 12, top: top + 8, width: 167, height: 167 })
        .removeAlpha()
        .raw()
        .toBuffer();
      const expected = await sharp(path.join(first, manifest.portraits[i].output.path)).removeAlpha().raw().toBuffer();
      assert.deepEqual(portrait, expected);
      const label = await sharp(contact)
        .extract({ left, top: top + 179, width: 191, height: 20 })
        .removeAlpha()
        .raw()
        .toBuffer();
      assert.ok(label.includes(240), `Visible label for ${FACTIONS[i]}`);
      assert.ok(label.includes(24));
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
    assert.deepEqual(await readdir(SCORE_SOURCE_DIR), scoreSourceFiles);
    for (const [name, hash] of scoreBefore)
      assert.equal(sha256(await readFile(path.join(SCORE_SOURCE_DIR, name))), hash, `Score source modified: ${name}`);
    assert.deepEqual(await readdir(SOURCE_DIR), sourceFiles);
    for (const [name, hash] of before)
      assert.equal(sha256(await readFile(path.join(SOURCE_DIR, name))), hash, `Source modified: ${name}`);
  }
});
