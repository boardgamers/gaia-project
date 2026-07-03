/**
 * FUZZER_PLAN.md §2 — CLI campaign runner. NOT part of `npm test` (§2 runtime placement):
 *
 *   cd engine && npm run fuzz -- --lf 300 --base 100 [--seed-base lost-fleet-fuzz-v1] [--checkpoint 0]
 *
 * Prints one line per failing game and a summary; exits non-zero if any game failed. Every
 * failure line includes the seed + spec needed to reproduce it exactly (§J3 determinism).
 */
import { campaignCorpus, CORPUS_BASE_SEED } from "./corpus";
import { fuzzGame, FuzzGameResult } from "./driver";

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] !== undefined ? process.argv[idx + 1] : fallback;
}

function main() {
  const lfGames = +arg("lf", "30");
  const baseGames = +arg("base", "10");
  const seedBase = arg("seed-base", CORPUS_BASE_SEED);
  const checkpointEvery = +arg("checkpoint", "0");

  const corpus = campaignCorpus(lfGames, baseGames, seedBase);
  const t0 = Date.now();
  const failed: FuzzGameResult[] = [];
  let played = 0;

  for (const spec of corpus) {
    let result: FuzzGameResult;
    try {
      result = fuzzGame(spec, { checkpointEvery });
    } catch (err) {
      console.error(`INTERNAL ${JSON.stringify(spec)}: ${err.message}`);
      process.exitCode = 2;
      continue;
    }
    played++;
    if (result.failures.length > 0 || !result.finished) {
      failed.push(result);
      console.error(`FAIL ${spec.gameSeed} (${spec.players}p${spec.lostFleet ? " LF" : ""}):`);
      for (const f of result.failures) {
        console.error(`  [${f.oracle}] ${f.message}`);
        console.error(`  citation: ${f.citation}`);
      }
      if (result.failingLine) {
        console.error(`  failing line: ${result.failingLine}`);
      }
    }
  }

  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `${played - failed.length}/${played} games clean (${lfGames} LF + ${baseGames} base requested), ${seconds}s`
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
