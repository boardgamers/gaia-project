#!/usr/bin/env node

// Adds one entry to the hosted changelog (viewer/src/hosted/release.json + its public/ mirror).
//
// STRICT RULE - read before adding a change:
//   Every change must be tagged "user:" or "dev:".
//     user: a real, visible/usable change - a new feature, a new option, a redesign, something a
//           player can see or do differently. Written short and in plain language.
//     dev:  anything else - bug fixes, crash fixes, backend/technical work, reliability/perf
//           fixes, refactors. This is the ONLY bucket for fixes, even if the bug was player-visible
//           (e.g. "fixed a crash" is dev:, not user:) - the "What's new" tab is for new things,
//           not for admitting things were broken.
//   "user:" changes appear on both the "What's new" and "Developer" changelog tabs. "dev:" changes
//   appear only on "Developer". This split is enforced here, not just by convention - there is no
//   way to add an entry through this script without tagging every line.
const fs = require("fs");
const path = require("path");

const VALID_BUMPS = new Set(["major", "minor", "patch"]);
const [, , bumpType, title, ...taggedChanges] = process.argv;

function usageError(message) {
  console.error(message);
  console.error("");
  console.error(
    'Usage: node scripts/update-viewer-release.js <major|minor|patch> <title> "user:<change>" "dev:<change>" [...]'
  );
  console.error("");
  console.error("  user:<change>  a real, visible/usable change (new feature, new option, redesign)");
  console.error("  dev:<change>   anything else, INCLUDING bug/crash fixes and backend/technical work");
  console.error("");
  console.error("Example:");
  console.error(
    '  node scripts/update-viewer-release.js patch "Lobby crash hotfix" "dev:Fixed a crash in the lobby\'s game-loading code"'
  );
  process.exit(1);
}

if (!VALID_BUMPS.has(bumpType) || !title || taggedChanges.length === 0) {
  usageError("Missing or invalid arguments.");
}

const changes = [];
const userChanges = [];
for (const raw of taggedChanges) {
  const match = /^(user|dev):\s*(.+)$/is.exec(raw);
  if (!match) {
    usageError(
      `Every change must start with "user:" or "dev:" - got: "${raw}"\n` +
        "(if you're not sure, it's dev: - user: is only for real, visible/usable changes)"
    );
  }
  const [, tag, text] = match;
  changes.push(text);
  if (tag.toLowerCase() === "user") {
    userChanges.push(text);
  }
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
    kind: userChanges.length > 0 ? "update" : "fix",
    title,
    impact: "",
    changes,
    userChanges,
  },
  ...(releaseData.entries ?? []),
];

writeJson(viewerPackagePath, viewerPackage);
writeJson(hostedReleasePath, releaseData);
writeJson(publicReleasePath, releaseData);

console.log(`Updated viewer release to v${nextVersion}`);
console.log(
  userChanges.length > 0
    ? `  ${userChanges.length} user-facing change(s), ${changes.length - userChanges.length} dev-only`
    : '  dev-only entry (no user-facing changes) - will not appear on the "What\'s new" tab'
);
