import Engine, {
  Building,
  GaiaHex,
  Phase,
  PlayerEnum,
  Resource,
  Resource as ResourceEnum,
  Reward,
  SpaceMap,
} from "@gaia-project/engine";
import { upgradedBuildings } from "@gaia-project/engine/src/buildings";
import { LEECHING_DISTANCE } from "@gaia-project/engine/src/engine";
import { RichText } from "../graphics/utils";

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
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
  return [{ rewards: chargePowerToPay(Reward.parse(s.replace(/ /g, ""))) }];
}

function newPlusReward(): Reward {
  const reward = new Reward("+", ResourceEnum.None);
  reward.count = "+" as any;
  return reward;
}

export const plusReward = newPlusReward();
