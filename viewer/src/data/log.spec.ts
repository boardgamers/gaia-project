import Engine, { AdvTechTile, AdvTechTilePos, TechTile, TechTilePos } from "@gaia-project/engine";
import { expect } from "chai";
import { replaceMove } from "./log";

describe("Advanced log details", () => {
  const data = new Engine();
  data.tiles.techs[TechTilePos.Terraforming] = { tile: TechTile.Tech1, count: 1 };
  data.tiles.techs[AdvTechTilePos.GaiaProject] = { tile: AdvTechTile.AdvTech4, count: 1 };

  it("booster should be replaced", () => {
    expect(replaceMove(data, "gleens pass booster7")).to.equal("gleens pass booster7 (1o, 2 VP / ts)");
  });
  it("tech should be replaced (twice)", () => {
    expect(replaceMove(data, "baltaks build lab 4B1. tech terra. tech terra")).to.equal(
      "baltaks build lab 4B1. tech terra (o,q). tech terra (o,q)"
    );
  });
  it("advanced tech should be replaced", () => {
    expect(replaceMove(data, "baltaks build lab 4B1. tech adv-gaia")).to.equal(
      "baltaks build lab 4B1. tech adv-gaia (2 VP / mine)"
    );
  });
});
