import Engine, { AuctionVariant, Faction, Planet } from "@gaia-project/engine";
import { expect } from "chai";
import { terraformCost3Set } from "./faction-overview";

const row = [Planet.Volcanic, Planet.Ice, Planet.Titanium, Planet.Desert, Planet.Oxide, Planet.Terra, Planet.Swamp];

describe("auction terraforming previews", () => {
  it("counts Nevlas while temporarily unowned and agrees with completed setup", () => {
    const engine = new Engine(
      [
        "init 4 Foreign-gecko-8667",
        "p1 faction lantids",
        "p2 faction nevlas",
        "p3 faction firaks",
        "p4 faction moweyds",
        "p1 bid lantids 8",
        "p2 bid firaks 0",
        "p3 bid firaks 1",
        "p4 bid lantids 9",
        "p1 bid lantids 10",
        "p2 bid moweyds 0",
        "p4 bid firaks 2",
        "p3 bid moweyds 1",
      ],
      { lostFleet: true, auction: AuctionVariant.ChooseBid }
    );
    expect(engine.players.some((pl) => pl.faction === Faction.Nevlas)).to.equal(false);
    const costs = terraformCost3Set(engine, Faction.Moweyds, row);
    expect(costs).to.have.members([Planet.Terra, Planet.Ice, Planet.Titanium]);
    expect(costs).not.to.include(Planet.Volcanic);
    engine.move("p2 bid nevlas 0");
    expect(engine.players.find((pl) => pl.faction === Faction.Moweyds).data.lostFleetCost3Planets).to.have.members(
      costs
    );
  });

  it("keeps both special factions in setup order even when seat ownership is reversed", () => {
    const engine = new Engine(["init 3 preview-order"], { lostFleet: true });
    engine.setup = [Faction.Tinkeroids, Faction.Nevlas, Faction.Moweyds];
    engine.players[0].faction = Faction.Moweyds;
    engine.players[2].faction = Faction.Tinkeroids;
    expect(terraformCost3Set(engine, Faction.Tinkeroids, row)).to.have.members([
      Planet.Ice,
      Planet.Volcanic,
      Planet.Titanium,
    ]);
    expect(terraformCost3Set(engine, Faction.Moweyds, row)).to.have.members([Planet.Ice, Planet.Desert, Planet.Oxide]);
  });
});
