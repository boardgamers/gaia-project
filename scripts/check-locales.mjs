import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
const directory = process.argv[2];
if (!directory) {
  throw Error("Usage: node check-locales.mjs <localization directory>");
}
const source = JSON.parse(await readFile(join(directory, "en.json"), "utf8"));
const placeholders = (text) => [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort();
const locales = ["en", "de", "fr", "pl", "ro", "el", "hi", "ru", "da", "pt-BR", "ko", "zh-TW", "vi", "it", "nl"];
for (const locale of locales) {
  const catalog = JSON.parse(await readFile(join(directory, `${locale}.json`), "utf8"));
  assert.deepEqual(Object.keys(catalog).sort(), Object.keys(source).sort(), `${locale}: missing or extra strings`);
  for (const [key, text] of Object.entries(catalog)) {
    assert.equal(typeof text, "string", `${locale}: ${key}`);
    assert.ok(text.trim(), `${locale}: empty translation of ${key}`);
    assert.deepEqual(placeholders(text), placeholders(source[key]), `${locale}: changed placeholders in ${key}`);
  }
}
console.log(`${locales.length} languages × ${Object.keys(source).length} messages validated`);
