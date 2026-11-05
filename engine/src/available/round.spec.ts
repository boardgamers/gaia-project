import { expect } from "chai";
import Engine from "../engine";
import { Booster, Command, Phase, Player as PlayerEnum } from "../enums";
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

  it("before anyone has passed, offers this game's boosters except the planning seat's current one", () => {
    const engine = game();
    engine.player(PlayerEnum.Player1).data.analysis = true;

    const [command] = possibleRoundBoosters(engine, PlayerEnum.Player1);

    // Player1 (terrans) is holding booster3 - can't pick the one you just had.
    expect(command.data.boosters).to.not.include(Booster.Booster3);
    // booster7 is currently held by the other player, who has not passed yet. Planning allows
    // for that player returning it before our future pass.
    expect(command.data.boosters).to.include(Booster.Booster7);
    expect(command.data.boosters).to.have.members(
      Object.keys(engine.tiles.boosters).filter((booster) => booster !== Booster.Booster3)
    );
    const unused = Booster.values(engine.expansions).filter((booster) => engine.tiles.boosters[booster] === undefined);
    expect(unused.length).to.be.greaterThan(0);
    expect(command.data.boosters).to.not.include.members(unused);
  });

  it("respects an opponent's completed pass when generating and validating a planning pass", () => {
    const real = new Engine([...SETUP, "terrans pass booster4"]);
    const original = JSON.stringify(real);
    const engine = Engine.fromData(JSON.parse(original));
    engine.player(PlayerEnum.Player2).data.analysis = true;
    engine.clearAvailableCommands();
    engine.generateAvailableCommands();

    const command = engine.findAvailableCommand(PlayerEnum.Player2, Command.Pass);
    expect(command.data.boosters).to.have.members(
      Object.keys(real.tiles.boosters).filter((booster) => real.tiles.boosters[booster])
    );
    // The old booster was returned; the new one is already reserved for round 2.
    expect(command.data.boosters).to.include(Booster.Booster3);
    expect(command.data.boosters).to.not.include(Booster.Booster4);
    expect(command.data.boosters).to.not.include(Booster.Booster7);
    expect(() => engine.move("nevlas pass booster4")).to.throw("booster4 is not in the available boosters");
    expect(JSON.stringify(real)).to.equal(original);
  });

  it("keeps real pass order and booster ownership intact across the next round", () => {
    const engine = new Engine([...SETUP, "terrans pass booster4", "nevlas pass booster5"]);
    expect(engine.round).to.equal(2);
    expect(engine.turnOrder).to.deep.equal([PlayerEnum.Player1, PlayerEnum.Player2]);
    expect(engine.passedPlayers).to.deep.equal([]);
    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Pass);
    expect(command.data.boosters).to.include(Booster.Booster3);
    expect(command.data.boosters).to.include(Booster.Booster7);
    expect(command.data.boosters).to.not.include(Booster.Booster4);
    expect(command.data.boosters).to.not.include(Booster.Booster5);
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
