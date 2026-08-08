import { expect } from "chai";
import { Expansion, FinalTile, Player as PlayerEnum } from "../enums";
import Player from "../player";
import { finalRankings } from "./scoring";

describe("finalRankings", () => {
  it("uses the Lost Fleet neutral values in 2-player games", () => {
    const players = [
      new Player(Expansion.LostFleet, PlayerEnum.Player1),
      new Player(Expansion.LostFleet, PlayerEnum.Player2),
    ];

    expect(
      finalRankings([FinalTile.Asteroid], players, Expansion.LostFleet)[0].map((entry) => entry.count)
    ).to.deep.equal([3, 0, 0]);
    expect(
      finalRankings([FinalTile.PlanetaryInstituteAcademyDistance], players, Expansion.LostFleet)[0].map(
        (entry) => entry.count
      )
    ).to.deep.equal([8, 0, 0]);
    expect(
      finalRankings([FinalTile.PlanetType], players, Expansion.LostFleet)[0].map((entry) => entry.count)
    ).to.deep.equal([6, 0, 0]);
    expect(
      finalRankings([FinalTile.DeepSpaceSector], players, Expansion.LostFleet)[0].map((entry) => entry.count)
    ).to.deep.equal([3, 0, 0]);
  });

  it("keeps the base-game Planet Types neutral value outside Lost Fleet", () => {
    const players = [new Player(Expansion.None, PlayerEnum.Player1), new Player(Expansion.None, PlayerEnum.Player2)];

    expect(finalRankings([FinalTile.PlanetType], players, Expansion.None)[0].map((entry) => entry.count)).to.deep.equal(
      [5, 0, 0]
    );
  });
});
