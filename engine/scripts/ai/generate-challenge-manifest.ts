import { writeFileSync } from "fs";
import { resolve } from "path";
import { generateChallengeManifest, stableManifestJson } from "../../src/ai/challenge-manifest";

function outputPath(args: string[]): string | undefined {
  const index = args.indexOf("--output");
  return index >= 0 ? args[index + 1] : undefined;
}

const json = stableManifestJson(generateChallengeManifest()) + "\n";
const target = outputPath(process.argv.slice(2));

if (target) {
  writeFileSync(resolve(target), json, "utf8");
} else {
  process.stdout.write(json);
}
