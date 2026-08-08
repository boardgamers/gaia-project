#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const viewerPackagePath = path.join(repoRoot, "viewer", "package.json");
const hostedReleasePath = path.join(repoRoot, "viewer", "src", "hosted", "release.json");
const publicReleasePath = path.join(repoRoot, "viewer", "public", "release.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function parseArgs(argv) {
  const cli = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    cli[key] = argv[i + 1];
    i += 1;
  }
  return cli;
}

function parsePushSpecs(stdinText) {
  return stdinText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

function changedFilesBetween(baseRef, headRef) {
  if (!baseRef || /^0+$/.test(baseRef)) {
    return git(["diff", "--name-only", headRef]).split(/\r?\n/).filter(Boolean);
  }
  return git(["diff", "--name-only", `${baseRef}..${headRef}`])
    .split(/\r?\n/)
    .filter(Boolean);
}

function assertReleaseMetadata() {
  const viewerPackage = readJson(viewerPackagePath);
  const hostedReleaseData = readJson(hostedReleasePath);
  const publicReleaseData = readJson(publicReleasePath);
  const releaseData = hostedReleaseData;
  const latestEntry = releaseData.entries?.[0];

  if (JSON.stringify(hostedReleaseData) !== JSON.stringify(publicReleaseData)) {
    throw new Error("viewer/src/hosted/release.json and viewer/public/release.json must stay identical.");
  }

  if (viewerPackage.version !== releaseData.version) {
    throw new Error(
      `viewer/package.json version (${viewerPackage.version}) does not match hosted release version (${releaseData.version}).`
    );
  }
  if (!latestEntry) {
    throw new Error("viewer/src/hosted/release.json must contain at least one changelog entry.");
  }
  if (!releaseData.releasedAt || !latestEntry.releasedAt) {
    throw new Error("Current release and latest changelog entry must both include a releasedAt date.");
  }
  if (latestEntry.version !== releaseData.version) {
    throw new Error(
      `Latest changelog entry version (${latestEntry.version}) does not match current release version (${releaseData.version}).`
    );
  }
  if (
    !latestEntry.kind ||
    !latestEntry.title ||
    !Array.isArray(latestEntry.changes) ||
    latestEntry.changes.length === 0
  ) {
    throw new Error("Latest changelog entry must include a title and at least one change line.");
  }
}

function main() {
  const cli = parseArgs(process.argv.slice(2));
  const stdinText = fs.readFileSync(0, "utf8");
  const pushSpecs = parsePushSpecs(stdinText);
  const fallbackSpec =
    cli["remote-ref"] || cli["local-ref"]
      ? [
          {
            localRef: cli["local-ref"] ?? "HEAD",
            localSha: cli["local-sha"] ?? "HEAD",
            remoteRef: cli["remote-ref"] ?? "refs/heads/master",
            remoteSha: cli["remote-sha"] ?? "origin/master",
          },
        ]
      : [];

  const specs = pushSpecs.length > 0 ? pushSpecs : fallbackSpec;
  const masterPushes = specs.filter((spec) => spec.remoteRef === "refs/heads/master");
  if (masterPushes.length === 0) {
    return;
  }

  assertReleaseMetadata();

  for (const spec of masterPushes) {
    const baseRef = cli["base-ref"] ?? spec.remoteSha;
    const headRef = cli["head-ref"] ?? spec.localSha ?? "HEAD";
    const changedFiles = changedFilesBetween(baseRef, headRef);

    if (changedFiles.length === 0) {
      continue;
    }

    const missing = ["viewer/package.json", "viewer/src/hosted/release.json", "viewer/public/release.json"].filter(
      (required) => !changedFiles.includes(required)
    );
    if (missing.length > 0) {
      throw new Error(
        `Pushing to master requires a release update. Missing changed file(s): ${missing.join(", ")}.\n` +
          'Use `node scripts/update-viewer-release.js <major|minor|patch> "<title>" "<change>" ...` before pushing.'
      );
    }
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
