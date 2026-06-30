import { expect } from "chai";
import Engine from "../engine";
import { possibleSpecialActions } from "../available/actions";
import { factionBoard } from ".";
import { Building, Command, Faction, Operator, Phase, Player as PlayerEnum, Resource, TinkeringTile } from "../enums";
import { moveChooseTinkeringTile } from "../move/actions";
import { Power } from "../player-data";

describe("Tinkeroids", () => {
  const board = factionBoard(Faction.Tinkeroids);
  const defaults = factionBoard(Faction.Terrans);

  it("should have power Area I = 4 and Area II = 2", () => {
    expect(board.power).to.deep.equal({ area1: 4, area2: 2 });
  });

  it("should use standard building costs", () => {
    for (const building of [
      Building.Mine,
      Building.TradingStation,
      Building.ResearchLab,
      Building.Academy1,
      Building.Academy2,
      Building.PlanetaryInstitute,
    ]) {
      expect(board.cost(building, false)).to.deep.equal(defaults.cost(building, false));
    }
  });

  it("should grant a free Science research step on game start", () => {
    const setupRewards = board.income[0].rewards;

    expect(setupRewards.some((r) => r.type === Resource.UpgradeScience)).to.be.true;
  });

  it("should interrupt round income with a Tinkering-tile choice, then expose the chosen tile as a once-per-round action", () => {
    const engine = new Engine(["init 2 lost-fleet-tinkeroids-round-income"], { lostFleet: true });

    engine.players[0].faction = Faction.Tinkeroids;
    engine.players[0].loadFaction(null, engine.expansions);
    engine.players[0].data.victoryPoints = 30;
    engine.players[0].data.qics = 10;
    engine.players[0].data.credits = 20;
    engine.players[0].data.knowledge = 10;
    engine.players[0].data.ores = 10;
    engine.players[0].data.power = new Power(4, 4, 4, 0);
    engine.players[0].data.buildings[Building.PlanetaryInstitute] = 1;

    engine.players[1].faction = Faction.Terrans;
    engine.players[1].loadFaction(null, engine.expansions);

    engine.phase = Phase.RoundIncome;
    engine.round = 1;
    engine.turnOrder = engine.players.map((pl) => pl.player);
    engine.currentPlayer = PlayerEnum.Player1;

    engine.generateAvailableCommands();
    const chooseCommand = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseTinkeringTile);

    expect(chooseCommand.data.tiles).to.have.members([
      TinkeringTile.Step1,
      TinkeringTile.Power4,
      TinkeringTile.Qic1,
    ]);

    moveChooseTinkeringTile(engine, chooseCommand, PlayerEnum.Player1, TinkeringTile.Step1);

    expect(engine.player(PlayerEnum.Player1).data.currentTinkeringTile).to.equal(TinkeringTile.Step1);

    const specialCommand = possibleSpecialActions(engine, PlayerEnum.Player1)[0];
    const action = specialCommand.data.specialacts.find((entry) => entry.income === "step");

    expect(action).to.not.equal(undefined);
    expect(engine.player(PlayerEnum.Player1).events[Operator.Activate].some((ev) => ev.spec === "=> step")).to.be.true;
  });
});
