import { expect } from "chai";
import Engine from "../engine";
import { Booster, Phase, Player as PlayerEnum } from "../enums";
import { possibleRoundBoosters } from "./round";

describe("possibleRoundBoosters", () => {
  const SETUP = [
    "init 2 randomSeed",
    "p1 faction terrans",
    "p2 faction nevlas",
    "terrans build m -1x2",
    "nevlas build m -1x0",
    "nevlas build m 0x-4",
    "terrans build m -4x-1",
    "nevlas booster booster7",
    "terrans booster booster3",
  ];

  function game() {
    return new Engine(SETUP);
  }

  it("in a real game, only offers boosters still on the table", () => {
    const engine = game();
    const [command] = possibleRoundBoosters(engine, PlayerEnum.Player1);

    expect(command.data.boosters).to.not.include(Booster.Booster3);
    expect(command.data.boosters).to.not.include(Booster.Booster7);
    expect(command.data.boosters.length).to.be.greaterThan(0);
  });

  it("in analysis mode, offers only this game’s boosters except the one currently held", () => {
    const engine = game();
    engine.player(PlayerEnum.Player1).data.analysis = true;

    const [command] = possibleRoundBoosters(engine, PlayerEnum.Player1);

    // Player1 (terrans) is holding booster3 - can't pick the one you just had.
    expect(command.data.boosters).to.not.include(Booster.Booster3);
    // booster7 is off the table in a real game (held by the other player), but analysis assumes
    // it's still pickable since opponents are frozen and might not really have taken it.
    expect(command.data.boosters).to.include(Booster.Booster7);
    expect(command.data.boosters).to.have.members(
      Object.keys(engine.tiles.boosters).filter((booster) => booster !== Booster.Booster3)
    );
    const unused = Booster.values(engine.expansions).filter((booster) => engine.tiles.boosters[booster] === undefined);
    expect(unused.length).to.be.greaterThan(0);
    expect(command.data.boosters).to.not.include.members(unused);
  });

  it("during setup, excludes unused boosters and those already picked by opponents", () => {
    const engine = new Engine(SETUP.slice(0, -1));
    engine.player(PlayerEnum.Player1).data.analysis = true;
    expect(engine.phase).to.equal(Phase.SetupBooster);
    const [command] = possibleRoundBoosters(engine, PlayerEnum.Player1);
    expect(command.data.boosters).to.have.members(
      Object.keys(engine.tiles.boosters).filter((booster) => engine.tiles.boosters[booster])
    );
    expect(command.data.boosters).to.not.include(Booster.Booster7);
  });

  it("does not let the analysis assumption leak to a seat that isn't the sandbox", () => {
    const engine = game();
    engine.player(PlayerEnum.Player1).data.analysis = true;

    const [command] = possibleRoundBoosters(engine, PlayerEnum.Player2);

    // Player2 (nevlas) is holding booster7, and is not the analysis seat, so real-game
    // availability still applies: booster3 (held by player1) stays off the table.
    expect(command.data.boosters).to.not.include(Booster.Booster3);
    expect(command.data.boosters).to.not.include(Booster.Booster7);
  });
});
