import { AdvTechTile, AdvTechTilePos, Operator, TechTile, TechTilePos } from "../enums";

export default {
  [TechTile.Tech1]: ["o,q"],
  [TechTile.Tech2]: ["pt > k"],
  [TechTile.Tech3]: [Operator.Special],
  [TechTile.Tech4]: ["7vp"],
  [TechTile.Tech5]: ["+o,pw"],
  [TechTile.Tech6]: ["+k,c"],
  [TechTile.Tech7]: ["mg >> 3vp"],
  [TechTile.Tech8]: ["+4c"],
  [TechTile.Tech9]: ["=> 4pw"],
  [TechTile.Ship0]: ["=> move"],
  [TechTile.Ship1]: ["trade >> 2vp"],
  [TechTile.Ship2]: ["k => range+2"],
  [TechTile.Ship3]: ["import > k"],
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
  [AdvTechTile.Ship1]: ["a > vp"],
  [AdvTechTile.Ship2]: ["trade > vp"],
  [AdvTechTile.Ship3]: ["4up-0"],
  [AdvTechTile.Ship4]: ["2ship+4"], // Place two ships, and move them at +4 range
  [AdvTechTile.Ship5]: ["=> 5vp"],
  [AdvTechTile.Ship6]: ["=> q,o,2turn"],
};

export function isAdvanced(pos: TechTilePos | AdvTechTilePos): boolean {
  return pos.startsWith("adv");
}
