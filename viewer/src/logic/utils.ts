import Engine, {
  Building,
  Expansion,
  GaiaHex,
  hasExpansion,
  Phase,
  PlayerEnum,
  Resource,
  Resource as ResourceEnum,
  Reward,
  Round,
  SpaceMap,
} from "@gaia-project/engine";
import { upgradedBuildings } from "@gaia-project/engine/src/buildings";
import { LEECHING_DISTANCE } from "@gaia-project/engine/src/engine";
import type { RichText } from "../graphics/rich-text";
import { richTextRewards } from "../graphics/rich-text";

/**
 * The seed a game was created with, read from the "init <players> <seed>" line that's always
 * moveHistory[0] - NOT from `engine.map.seed`, which is only set on a freshly-generated SpaceMap
 * and is lost across any serialize/deserialize round-trip (`SpaceMap.fromData` doesn't restore
 * it, since `SpaceMap.toJSON()` never included it - the seed's only job is one-time board
 * generation, so the engine itself never needed it back). moveHistory, by contrast, is the
 * append-only replay log this whole app is built around and always survives.
 */
export function gameSeed(engine: Engine): string | undefined {
  const init = engine.moveHistory[0];
  return init ? init.split(" ").slice(2).join(" ") || undefined : undefined;
}

// The bottommost (R1) round scoring tile's y-position in ResearchBoard.vue's 7th (Lost Fleet
// only) column - see that file's own SCORING_TILE_Y[0]. Final scoring sits directly below it.
// Kept in sync manually with ResearchBoard.vue, which re-exports this same value rather than
// hardcoding its own copy, so the two can never drift apart the way Game.vue's hardcoded
// `<ResearchBoard height="450">` once did (see `researchBoardHeight` below).
export const BOTTOM_SCORING_TILE_Y = 300;
const FINAL_SCORING_GAP_BELOW_ROUND_TILES = 40;
const FINAL_SCORING_NATIVE_HEIGHT = 56;
const FINAL_SCORING_NATIVE_GAP = 60;
const FINAL_SCORING_SCALE = 0.9;
// The 6 research tracks' own fixed content height (independent of Lost Fleet's 7th column, which
// can grow taller than this to fit final scoring - see researchBoardHeight below). Exported so
// Game.vue can anchor the base-game power/QIC action row to the tracks' own bottom edge instead of
// to researchBoardHeight()'s Lost-Fleet-inflated value, which left a large visible gap under the
// (shorter) tracks whenever the 7th column's final scoring tiles made the board taller overall.
export const BASE_RESEARCH_BOARD_HEIGHT = 440;

/**
 * ResearchBoard.vue's own SVG viewBox height: a fixed 440 normally, or - for Lost Fleet, which
 * grows a 7th column of round scoring tiles + final scoring under the adv-tech tile - tall enough
 * to fit however many final scoring tiles (1 or 2) are seeded below the round scoring tiles. Used
 * both by ResearchBoard.vue itself (its viewBox) and by Game.vue (the `height` it declares for
 * that nested component), so the two can never drift apart the way a hardcoded height on the
 * Game.vue side once did - see PROGRESS.md's Gaia 4 UI polish notes.
 */
export function researchBoardHeight(engine: Engine): number {
  const finalScoringCount = hasExpansion(engine.expansions, Expansion.LostFleet)
    ? (engine.tiles?.scorings?.final?.length ?? 0)
    : 0;
  if (finalScoringCount === 0) {
    return BASE_RESEARCH_BOARD_HEIGHT;
  }
  const finalScoringY = BOTTOM_SCORING_TILE_Y + FINAL_SCORING_GAP_BELOW_ROUND_TILES;
  const nativeBlockHeight =
    finalScoringCount > 1 ? FINAL_SCORING_NATIVE_GAP + FINAL_SCORING_NATIVE_HEIGHT : FINAL_SCORING_NATIVE_HEIGHT;
  const bottom = finalScoringY + nativeBlockHeight * FINAL_SCORING_SCALE;
  return Math.max(BASE_RESEARCH_BOARD_HEIGHT, Math.ceil(bottom + 10));
}

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFactionBan ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction ||
    data.phase === Phase.SetupSilentBid ||
    data.phase === Phase.SetupPreferenceBid
  );
}

/**
 * True through every setup phase (faction/board/auction/initial mine & ship
 * placement, boosters) and false from the moment round 1's income phase
 * begins - `engine.round` stays `Round.None` (0) for the whole setup stage
 * and only becomes 1 once `beginRoundStartPhase` (move/phase.ts) runs. The
 * setup-preview screen's scratch engine never advances past `SetupFaction`
 * (it only ever replays the "init" move), so this is also always true there.
 */
export function isBeforeRound1(data: Engine): boolean {
  return data.round === Round.None;
}

export const deltaCounter: (initial: number) => (val: number) => number = (initial: number) => {
  let last = initial;

  return (val: number) => {
    const ret = val - last;
    last = val;
    return ret;
  };
};

export function radiusTranslate(radius: number, index: number, positions: number) {
  const deg = 360 / positions;
  const x = radius * Math.sin(((-180 + index * deg) * Math.PI) / 180);
  const y = radius * Math.cos(((-180 + index * deg) * Math.PI) / 180);
  return `translate(${x}, ${y})`;
}

export function leechPlanets(map: SpaceMap, player: PlayerEnum, hex: GaiaHex): { hex: GaiaHex; building: Building }[] {
  return Array.from(map.grid.values()).flatMap((h) => {
    if (map.distance(h, hex) <= LEECHING_DISTANCE) {
      if (h.colonizedBy(player)) {
        return [{ hex: h, building: h.buildingOf(player) }];
      }
      if (h.customPosts.includes(player)) {
        return [{ hex: h, building: Building.CustomsPost }];
      }
    }
    return [];
  });
}

export function upgradableBuildingsOfOtherPlayers(engine: Engine, hex: GaiaHex, player: PlayerEnum): number {
  const p = hex.data.player;
  return p != null && p != player && upgradedBuildings(hex.buildingOf(p), engine.player(p).faction).length > 0 ? 1 : 0;
}

export function rotate<T>(list: Array<T>, first: T): Array<T> {
  const i = list.indexOf(first);
  if (i <= 0) {
    return list;
  }
  return list.slice(i).concat(list.slice(0, i));
}

export function chargePowerToPay(rewards: Reward[]): Reward[] {
  return rewards.map((r) =>
    r.type === Resource.ChargePower && r.count < 0 ? new Reward(-r.count, Resource.PayPower) : r
  );
}

export function parseRewardsForLog(s: string): RichText {
  return [richTextRewards(chargePowerToPay(Reward.parse(s.replace(/ /g, ""))))];
}

function newPlusReward(): Reward {
  const reward = new Reward("+", ResourceEnum.None);
  reward.count = "+" as any;
  return reward;
}

export const plusReward = newPlusReward();
