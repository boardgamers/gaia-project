import { ChooseTechTile } from "../available/types";
import { AdvTechTile, AdvTechTilePos, AnyTechTile, AnyTechTilePos, Operator, TechPos, TechTile } from "../enums";
import Event, { EventSource } from "../events";
import Reward from "../reward";

const techTileSpec: { [key in AnyTechTile]: string[] } = {
  [TechTile.Tech1]: ["o,q"],
  [TechTile.Tech2]: ["pt > k"],
  [TechTile.Tech3]: [Operator.FourPowerBuildings],
  [TechTile.Tech4]: ["7vp"],
  [TechTile.Tech5]: ["+o,pw"],
  [TechTile.Tech6]: ["+k,c"],
  [TechTile.Tech7]: ["mg >> 3vp"],
  [TechTile.Tech8]: ["+4c"],
  [TechTile.Tech9]: ["=> 4pw"],
  [TechTile.TechFrontiers1]: ["trade >> 2c"],
  [AdvTechTile.AdvTech1]: ["fed | 3vp"],
  [AdvTechTile.AdvTech2]: ["a >> 2vp"],
  [AdvTechTile.AdvTech3]: ["=> q,5c"],
  [AdvTechTile.AdvTech4]: ["m > 2vp"],
  [AdvTechTile.AdvTech5]: ["lab | 3vp"],
  [AdvTechTile.AdvTech6]: ["s > o"],
  [AdvTechTile.AdvTech7]: ["pt | vp"],
  [AdvTechTile.AdvTech8]: ["g > 2vp"],
  [AdvTechTile.AdvTech9]: ["ts > 4vp"],
  [AdvTechTile.AdvTech10]: ["s > 2vp"],
  [AdvTechTile.AdvTech11]: ["=> 3o"],
  [AdvTechTile.AdvTech12]: ["fed > 5vp"],
  [AdvTechTile.AdvTech13]: ["=> 3k"],
  [AdvTechTile.AdvTech14]: ["m >> 3vp"],
  [AdvTechTile.AdvTech15]: ["ts >> 3vp"],
};

export function techTileEventWithSource(tile: AnyTechTile, source: EventSource): Event[] {
  return Event.parse(techTileSpec[tile], source);
}

export function techTileEventSource(pos: AnyTechTilePos): AdvTechTilePos | TechPos {
  return isAdvanced(pos) ? (pos as AdvTechTilePos) : (`tech-${pos}` as TechPos);
}

export function techTileEvents(chooseTechTile: ChooseTechTile): Event[] {
  return techTileEventWithSource(chooseTechTile.tile, techTileEventSource(chooseTechTile.pos));
}

export function techTileRewards(tile: AnyTechTile): Reward[] {
  return techTileEventWithSource(tile, null).flatMap((e) => e.rewards);
}

export function isAdvanced(pos: AnyTechTilePos): boolean {
  return pos.startsWith("adv");
}
