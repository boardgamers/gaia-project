import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  CROP,
  FACTIONS,
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
  try {
    const first = path.join(temporary, "first");
    const second = path.join(temporary, "second");
    const manifest = await generatePortraits(first);
    assert.deepEqual(await generatePortraits(second), manifest);
    const expectedFiles = [
      ...FACTIONS.map((id) => `achievement-faction-${id}.png`),
      "contact-sheet.png",
      "manifest.json",
    ].sort();
    assert.deepEqual((await readdir(first)).sort(), expectedFiles);
    assert.deepEqual((await readdir(second)).sort(), expectedFiles);
    for (const name of expectedFiles)
      assert.deepEqual(await readFile(path.join(first, name)), await readFile(path.join(second, name)));
    assert.deepEqual(JSON.parse(await readFile(path.join(first, "manifest.json"), "utf8")), manifest);
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
    assert.deepEqual(await readdir(SOURCE_DIR), sourceFiles);
    for (const [name, hash] of before)
      assert.equal(sha256(await readFile(path.join(SOURCE_DIR, name))), hash, `Source modified: ${name}`);
  }
});
