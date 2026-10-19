import { expect } from "chai";
import Engine from "./engine";
import {
  AdvTechTile,
  AdvTechTilePos,
  Building,
  Command,
  Federation,
  Operator,
  Phase,
  Planet,
  ScoringBoardExtensionSide,
  ScoringTile,
  TechTile,
  TechTilePos,
} from "./enums";
import { roundScoringEvents } from "./tiles/scoring";

function position(building = Building.ResearchLab, vp = 22) {
  const engine = new Engine(["init 2 building-tech-scoring", "p1 faction gleens", "p2 faction terrans"], {
    lostFleet: true,
  });
  engine.phase = Phase.RoundMove;
  engine.round = 3;
  engine.currentPlayer = 0;
  engine.turnOrder = [0, 1];
  engine.passedPlayers = [];
  engine.scoringExtensionSide = ScoringBoardExtensionSide.VictoryPoints;
  engine.tiles.techs[AdvTechTilePos.ScoringExtension] = {
    tile: building === Building.ResearchLab ? AdvTechTile.AdvTech7 : AdvTechTile.Big,
    count: 1,
  };
  engine.tiles.techs[TechTilePos.Free1] = { tile: TechTile.Tech8, count: 2 };
  engine.tiles.techs[TechTilePos.Free2] = { tile: TechTile.Tech4, count: 2 };
  const player = engine.players[0];
  const hex = [...engine.map.grid.values()].find((hex) => hex.data.planet === Planet.Desert);
  hex.data.building = building === Building.ResearchLab ? Building.TradingStation : Building.ResearchLab;
  hex.data.player = 0;
  player.data.occupied.push(hex);
  player.data.buildings[hex.data.building] = 1;
  player.loadEvents(
    player.board.buildings[hex.data.building].income[0].filter((event) => event.operator !== Operator.Once)
  );
  player.data.tiles.federations.push({ tile: Federation.Fed5, green: true });
  player.gainTechTile({ tile: TechTile.Tech8, pos: TechTilePos.Free1 });
  player.data.victoryPoints = vp;
  player.data.credits = 10;
  player.data.ores = 10;
  const scoring = building === Building.ResearchLab ? ScoringTile.LfLab4 : ScoringTile.Score7;
  engine.tiles.scorings.round[2] = scoring;
  player.loadEvents(roundScoringEvents(scoring, 3));
  engine.clearAvailableCommands();
  engine.generateAvailableCommands();
  return { engine, move: `gleens build ${building} ${hex.toString()}` };
}

describe("building round scoring before technology selection", () => {
  for (const [building, roundVp, techVp] of [
    [Building.ResearchLab, 4, 0],
    [Building.Academy1, 5, 6],
  ] as const) {
    it(`uses the ${building} scoring VP to unlock the extension tile and awards them only once`, () => {
      const { engine, move } = position(building);
      const initial = JSON.stringify(engine);
      engine.move(move);
      expect(engine.players[0].data.victoryPoints).to.equal(22 + roundVp);
      expect(engine.findAvailableCommand(0, Command.ChooseTechTile).data.tiles.map((tile) => tile.pos)).to.include(
        AdvTechTilePos.ScoringExtension
      );

      // The viewer replays the whole unfinished move from the saved turn state for each choice.
      const completed = Engine.fromData(JSON.parse(initial));
      completed.move(`${move}. tech adv-ext. cover free1. up nav.`);
      const player = completed.players[0];
      expect(player.data.victoryPoints).to.equal(22 + roundVp + techVp);
      expect(player.data.tiles.federations[0].green).to.equal(false);
      expect(player.data.tiles.techs.find((tile) => tile.pos === TechTilePos.Free1).enabled).to.equal(false);
      expect(completed.tiles.techs[AdvTechTilePos.ScoringExtension].count).to.equal(0);
    });
  }

  it("still rejects the extension below 25 VP and scores a standard-tech upgrade only once", () => {
    const { engine, move } = position(Building.ResearchLab, 20);
    const initial = JSON.stringify(engine);
    engine.move(move);
    expect(engine.players[0].data.victoryPoints).to.equal(24);
    expect(engine.findAvailableCommand(0, Command.ChooseTechTile).data.tiles.map((tile) => tile.pos)).not.to.include(
      AdvTechTilePos.ScoringExtension
    );
    const completed = Engine.fromData(JSON.parse(initial));
    completed.move(`${move}. tech free2. up nav.`);
    expect(completed.players[0].data.victoryPoints).to.equal(31); // 20 + 4 for the lab + 7 from the tile
  });
});
