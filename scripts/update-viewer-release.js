#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const VALID_BUMPS = new Set(["major", "minor", "patch"]);
const [, , bumpType, title, ...changes] = process.argv;

if (!VALID_BUMPS.has(bumpType) || !title || changes.length === 0) {
  console.error(
    "Usage: node scripts/update-viewer-release.js <major|minor|patch> <title> <change1> [change2] [...]"
  );
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const viewerPackagePath = path.join(repoRoot, "viewer", "package.json");
const hostedReleasePath = path.join(repoRoot, "viewer", "src", "hosted", "release.json");
const publicReleasePath = path.join(repoRoot, "viewer", "public", "release.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function bumpVersion(version, type) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  let [major, minor, patch] = match.slice(1).map((part) => Number(part));
  if (type === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

const viewerPackage = readJson(viewerPackagePath);
const releaseData = readJson(hostedReleasePath);
const nextVersion = bumpVersion(viewerPackage.version, bumpType);
const releasedAt = new Date().toISOString().slice(0, 10);

viewerPackage.version = nextVersion;
releaseData.version = nextVersion;
releaseData.releasedAt = releasedAt;
releaseData.entries = [
  {
    version: nextVersion,
    releasedAt,
    kind: "update",
    title,
    impact: "",
    changes,
  },
  ...(releaseData.entries ?? []),
];

writeJson(viewerPackagePath, viewerPackage);
writeJson(hostedReleasePath, releaseData);
writeJson(publicReleasePath, releaseData);

console.log(`Updated viewer release to v${nextVersion}`);
