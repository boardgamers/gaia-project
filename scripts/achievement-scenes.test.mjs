import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { ROOT, generateScenes, scenes, sha256, svgFor } from "./generate-achievement-scenes.mjs";

const require = createRequire(import.meta.url);
// GAIA_ART_PACK_ROOT points at the unpacked EXACT npm artifact for the release gate.
const engineRoot = process.env.GAIA_ART_PACK_ROOT || path.join(ROOT, "engine");
const hooks = require(path.join(engineRoot, "dist/wrapper.js"));
const fixtures = path.join(ROOT, "scripts/assets/achievement-scenes");
const json = async (name) => JSON.parse(await readFile(path.join(fixtures, name), "utf8"));
const preservedSources = await json("preserved-sources.json");
async function checkSources() {
  for (const [file, hash] of Object.entries(preservedSources))
    assert.equal(sha256(await readFile(path.join(ROOT, file))), hash, file);
}

test("complete protocol asset references, 36 unchanged definitions, 22 preserved rows and unchanged evaluator", async () => {
  const baseline = await json("baseline-manifest.json");
  const actual = hooks.achievementDefinitions();
  assert.equal(actual.revision, 5);
  assert.equal(actual.achievements.length, 36);
  assert.equal(new Set(actual.achievements.map((a) => a.id)).size, 36);
  assert.deepEqual(
    actual.achievements.map(({ icon, ...rest }) => rest),
    baseline.achievements.map(({ icon, ...rest }) => rest)
  );
  const preserved = baseline.achievements.filter((a) => a.icon);
  assert.equal(preserved.length, 22);
  for (const row of preserved)
    assert.deepEqual(
      actual.achievements.find((a) => a.id === row.id),
      row
    );
  const pins = await json("preserved-assets.json");
  assert.equal(pins.length, 20);
  assert.deepEqual(new Set(pins.map((a) => a.key)), new Set(preserved.map((a) => a.icon.key)));
  const generated = scenes().map((a) => `achievement-${a.id}`);
  assert.equal(generated.length, 14);
  assert.equal(new Set(generated).size, 14);
  const allKeys = new Set([...generated, ...pins.map((a) => a.key)]);
  assert.equal(allKeys.size, 34);
  for (const row of actual.achievements) {
    assert.deepEqual(Object.keys(row.icon).sort(), ["key", "type"]);
    assert.equal(row.icon.type, "asset");
    assert.match(row.icon.key, /^[a-z0-9][a-z0-9-]{0,63}$/);
    assert.ok(allKeys.has(row.icon.key));
  }
  assert.deepEqual(
    new Set(baseline.achievements.filter((a) => !a.icon).map((a) => a.id)),
    new Set(scenes().map((a) => a.id))
  );
  const source = await readFile(path.join(engineRoot, "src/achievements.ts"), "utf8");
  assert.equal(
    sha256(source.slice(source.indexOf("/** Evaluate authoritative"))),
    (await readFile(path.join(fixtures, "baseline-evaluator.sha256"), "utf8")).trim()
  );
  assert.equal(require(path.join(engineRoot, "package.json")).version, "4.17.10");
  // Real completed-game fixture exercises hooks in the packed artifact, not fabricated production data.
  const finished = JSON.parse(await readFile(path.join(ROOT, "engine/fixtures/Beta-2.json"), "utf8"));
  assert.ok(hooks.achievements(finished).length > 0);
  for (const seat of hooks.achievements(finished))
    for (const id of seat.earned) assert.ok(actual.achievements.some((a) => a.id === id));
  await checkSources();
});

test("exact depicted counts, sets and difficulty mapping; no victory marks on non-winning feats", () => {
  const items = scenes();
  const item = (id) => items.find((a) => a.id === id);
  const count = (id, fragment) => (svgFor(item(id)).match(new RegExp(fragment, "g")) || []).length;
  for (const [kind, n] of Object.entries({ mine: 8, trade: 4, lab: 3, institute: 1, academy: 2 }))
    assert.equal(count("build-all-standard", `data-building="${kind}"`), n);
  assert.equal(count("federation-form-4", 'data-formation="true"'), 4);
  assert.equal(count("faction-ivits-growing-federation", 'data-growing-federation="true"'), 1);
  assert.equal(item("faction-ivits-growing-federation").semantics.growthMilestones, 4);
  assert.equal(count("faction-lantids-shared-civilization", 'data-building="mine"'), 6);
  assert.equal(count("faction-lantids-shared-civilization", 'data-building="trade"'), 6);
  assert.equal(count("faction-bescods-balanced-research", 'data-level="3"'), 6);
  const base = ["terra", "desert", "swamp", "oxide", "volcanic", "titanium", "ice", "gaia", "lost"];
  for (const [mode, types] of [
    ["base", base],
    ["lost-fleet", [...base, "asteroid", "protoplanet"]],
  ]) {
    const id = `explore-all-types-${mode}`;
    assert.deepEqual(item(id).semantics.planetTypes, types);
    assert.equal(count(id, 'data-colony="true"'), types.length);
    for (const type of types) assert.equal(count(id, `data-planet="${type}"`), 1);
  }
  for (const difficulty of ["automalein", "automa", "automaechtig", "ultoma", "alptrauma"]) {
    const id = `win-automa-${difficulty}`;
    assert.deepEqual(item(id).semantics, { difficulty, exact: true, victory: true });
    assert.equal(count(id, `data-automa-card="${difficulty}"`), 1);
  }
  assert.equal(count("win-mode-lost-fleet", "data-ship="), 4);
  for (const a of items) assert.equal(svgFor(a).includes('data-victory="true"'), a.id.startsWith("win-"));
});

test("deterministic new-only SVG/PNG export, decoded images, hashes, contact sheet and preserved inputs", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "gaia-scenes-"));
  try {
    await checkSources();
    const first = path.join(temp, "a"),
      second = path.join(temp, "b");
    const manifest = await generateScenes(first);
    assert.deepEqual(await generateScenes(second), manifest);
    const files = await readdir(first);
    assert.equal(files.length, 30); // 14 editable SVGs + 14 PNGs + manifest + sheet
    assert.deepEqual(files, await readdir(second));
    for (const name of files)
      assert.deepEqual(await readFile(path.join(first, name)), await readFile(path.join(second, name)), name);
    assert.equal(new Set(manifest.assets.map((a) => a.output.sha256)).size, 14);
    assert.equal(new Set(manifest.assets.map((a) => a.source.sha256)).size, 14);
    for (const asset of manifest.assets) {
      for (const part of [asset.source, asset.output])
        assert.equal(sha256(await readFile(path.join(first, part.path))), part.sha256);
      const image = sharp(path.join(first, asset.output.path));
      const meta = await image.metadata();
      assert.equal(meta.width, 512);
      assert.equal(meta.height, 512);
      assert.equal(meta.format, "png");
      // Flat geometric silhouettes intentionally have less entropy than the old raster portraits.
      assert.ok((await image.stats()).entropy > 1.5);
      for (const size of [32, 48, 64]) {
        const raw = await image.clone().resize(size).raw().toBuffer({ resolveWithObject: true });
        assert.equal(raw.info.width, size);
        assert.ok(raw.data.some((v) => v > 200));
      }
    }
    const sheet = await sharp(path.join(first, "contact-sheet.png")).metadata();
    assert.equal(sheet.width, 1300);
    assert.equal(sheet.height, 1470);
    assert.deepEqual(manifest.preserved, await json("preserved-assets.json"));
    assert.equal(manifest.generator.sha256, sha256(await readFile(path.join(ROOT, manifest.generator.path))));
    await checkSources();
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
