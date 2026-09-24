import { expect } from "chai";
import "mocha";
import Engine, { EngineOptions } from "./engine";
import { BoardAction, Booster, Command, Faction, Phase, Player as PlayerEnum } from "./enums";

function roundMoveEngine() {
  const engine = new Engine(["init 2 qic-variant-preview"], { lostFleet: true, lostFleet2pQicTech: true });
  engine.players.forEach((player, index) => {
    player.faction = [Faction.Terrans, Faction.Xenos][index];
    player.loadFaction(null, engine.expansions);
    player.data.qics = 4;
    const booster = Object.keys(engine.tiles.boosters)[index] as Booster;
    player.getRoundBooster(booster);
    engine.tiles.boosters[booster] = false;
  });
  engine.phase = Phase.RoundMove;
  engine.round = 1;
  engine.turnOrder = [PlayerEnum.Player1, PlayerEnum.Player2];
  engine.currentPlayer = PlayerEnum.Player1;
  engine.passedPlayers = [];
  engine.clearAvailableCommands();
  return engine;
}

describe("Lost Fleet 2p QIC tech variant", () => {
  it("only restores qic1 when explicitly enabled in a two-player Lost Fleet game", () => {
    const cases: [number, EngineOptions, BoardAction[]][] = [
      [2, { lostFleet: true }, []],
      [2, { lostFleet: true, lostFleet2pQicTech: false }, []],
      [2, { lostFleet: true, lostFleet2pQicTech: true }, [BoardAction.Qic1]],
      [3, { lostFleet: true, lostFleet2pQicTech: true }, []],
      [4, { lostFleet: true, lostFleet2pQicTech: true }, []],
      [2, { lostFleet2pQicTech: true }, [BoardAction.Qic1, BoardAction.Qic2, BoardAction.Qic3]],
    ];
    for (const [players, options, expected] of cases) {
      const engine = new Engine([`init ${players} qic-variant`], options);
      expect(engine.boardActionTypes.filter((action) => action.startsWith("qic"))).to.deep.equal(expected);
      expect(Object.keys(engine.boardActions).filter((action) => action.startsWith("qic"))).to.deep.equal(expected);
    }
  });

  it("charges 4 QIC, grants a normal tech tile and research step, and locks the shared action after reload", () => {
    const engine = roundMoveEngine();
    const player = engine.players[0];
    const actions = () => engine.findAvailableCommand(PlayerEnum.Player1, Command.Action)?.data.poweracts ?? [];
    player.data.qics = 3;
    expect(actions().some((action) => action.name === BoardAction.Qic1)).to.equal(false);
    player.data.qics = 4;
    engine.clearAvailableCommands();
    expect(actions().some((action) => action.name === BoardAction.Qic1)).to.equal(true);
    engine.move("terrans action qic1. tech terra. up terra.");
    expect(player.data.qics).to.equal(0);
    expect(player.data.tiles.techs).to.have.length(1);
    expect(player.data.research.terra).to.equal(1);
    expect(engine.boardActions[BoardAction.Qic1]).to.equal(PlayerEnum.Player1);

    const restored = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    expect(restored.options.lostFleet2pQicTech).to.equal(true);
    expect(restored.boardActionTypes).to.include(BoardAction.Qic1);
    expect(() => restored.move("xenos action qic1")).to.throw();
  });

  it("makes the action available again next round", () => {
    const engine = roundMoveEngine();
    engine.move("terrans action qic1. tech terra. up terra.");
    for (let i = 0; i < 2; i++) {
      const seat = engine.currentPlayer;
      const pass = engine.findAvailableCommand(seat, Command.Pass);
      engine.move(`${engine.player(seat).faction} pass ${pass.data.boosters[0]}`);
    }
    expect(engine.round).to.equal(2);
    expect(engine.boardActions[BoardAction.Qic1]).to.equal(null);
    expect(engine.boardActions).not.to.have.property(BoardAction.Qic2);
    expect(engine.boardActions).not.to.have.property(BoardAction.Qic3);
  });
});
