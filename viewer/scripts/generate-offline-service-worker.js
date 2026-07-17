#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const appDir = path.resolve(__dirname, "../dist/app");
const serviceWorkerPath = path.join(appDir, "sw.js");
const startMarker = "/* __GAIA_PRECACHE_CONFIG_START__ */";
const endMarker = "/* __GAIA_PRECACHE_CONFIG_END__ */";

function walkFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

if (!fs.existsSync(serviceWorkerPath)) {
  throw new Error(`Built service worker not found: ${serviceWorkerPath}`);
}

const assetFiles = walkFiles(appDir)
  .filter((file) => file !== serviceWorkerPath && path.extname(file) !== ".map")
  .sort();
const assetUrls = assetFiles.map((file) => `/${path.relative(appDir, file).split(path.sep).join("/")}`);
const urls = Array.from(new Set(["/", "/?lobby=1", "/?offline=1", ...assetUrls]));

const hash = crypto.createHash("sha256");
for (const file of assetFiles) {
  hash.update(path.relative(appDir, file));
  hash.update(fs.readFileSync(file));
}
const version = hash.digest("hex").slice(0, 16);

const source = fs.readFileSync(serviceWorkerPath, "utf8");
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start < 0 || end < start) {
  throw new Error("Service-worker precache markers are missing or malformed.");
}

const generatedBlock = `${startMarker}\nconst PRECACHE_CONFIG = ${JSON.stringify(
  { version, urls },
  null,
  2
)};\n${endMarker}`;
const generated = `${source.slice(0, start)}${generatedBlock}${source.slice(end + endMarker.length)}`;
fs.writeFileSync(serviceWorkerPath, generated);

const verification = fs.readFileSync(serviceWorkerPath, "utf8");
for (const url of urls) {
  if (!verification.includes(JSON.stringify(url))) {
    throw new Error(`Generated service worker is missing ${url}`);
  }
}

console.log(`Generated offline service worker ${version}: ${urls.length} precached URLs`);
