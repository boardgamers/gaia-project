import Engine from "@gaia-project/engine";
import { ArtifactToken, Building, Command, Planet, Player as PlayerEnum, Spaceship } from "@gaia-project/engine/src/enums";
import { AvailableCommand } from "@gaia-project/engine/src/available/types";
import { expect } from "chai";
import { buildScenarioUrl, loadScenarioEngine, parseScenarioFromQuery, selfContainedScenarios } from "./self-contained-scenarios";

function clonedEngine(engine: Engine): Engine {
  return Engine.fromData(JSON.parse(JSON.stringify(engine)));
}

function currentPlayerPrefix(engine: Engine): string {
  return engine.player(engine.currentPlayer!).faction;
}

function expectCommand<C extends Command>(engine: Engine, command: C): AvailableCommand<C> {
  const available = engine.findAvailableCommand(PlayerEnum.Player1, command);
  expect(available, `expected ${command} to be available`).to.not.equal(undefined);
  return available as AvailableCommand<C>;
}

function executeUntilInteractiveState(engine: Engine, move: string): Engine {
  const copy = clonedEngine(engine);
  copy.move(move);
  copy.generateAvailableCommandsIfNeeded();
  return copy;
}

describe("self-contained scenarios", () => {
  it("uses unique ids and builds valid Lost Fleet engines", () => {
    const ids = new Set<string>();

    selfContainedScenarios.forEach((scenario) => {
      expect(ids.has(scenario.id), `duplicate scenario id ${scenario.id}`).to.equal(false);
      ids.add(scenario.id);

      const engine = loadScenarioEngine(scenario.id);
      expect(engine).to.be.instanceOf(Engine);
      expect(engine.options.lostFleet).to.equal(true);
    });
  });

  it("parses and builds short scenario URLs", () => {
    const url = buildScenarioUrl("https://example.com/viewer?state=abc", "lost-fleet-overview");

    expect(url).to.equal("https://example.com/viewer?scenario=lost-fleet-overview");
    expect(parseScenarioFromQuery(new URL(url).search)).to.equal("lost-fleet-overview");
  });

  it("keeps the explore-ready scenario executable", () => {
    const engine = loadScenarioEngine("lost-fleet-explore-ready");
    const prefix = currentPlayerPrefix(engine);
    const command = expectCommand(engine, Command.Explore);
    const ship = command.data.ships[0].ship;

    engine.move(`${prefix} explore ${ship}`);

    expect(engine.player(PlayerEnum.Player1).data.explorationShips[ship]).to.be.greaterThan(0);
  });

  it("keeps Twilight's +3 range scenario executable through mine placement", () => {
    const engine = loadScenarioEngine("lost-fleet-twilight-range-plus-3");
    const prefix = currentPlayerPrefix(engine);
    const start = engine.player(PlayerEnum.Player1).data.occupied[0];
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.SpaceshipAction} twilight knowledge`);
    const command = expectCommand(partial, Command.Build);
    const target = command.data.buildings.find(
      (entry) =>
        entry.building === Building.Mine &&
        engine.map.distance(start, engine.map.getS(entry.coordinates)) > engine.player(PlayerEnum.Player1).data.range
    );

    expect(target, "expected a mine target outside base range").to.not.equal(undefined);

    engine.move(`${prefix} ${Command.SpaceshipAction} twilight knowledge. ${Command.Build} m ${target!.coordinates}`);

    const builtHex = engine.map.getS(target!.coordinates);
    expect(builtHex.data.player).to.equal(PlayerEnum.Player1);
    expect(builtHex.data.building).to.equal(Building.Mine);
  });

  it("keeps the artifact scenario executable through token choice", () => {
    const engine = loadScenarioEngine("lost-fleet-artifact-choice");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.ExamineArtifact}`);
    const command = expectCommand(partial, Command.ChooseArtifactToken);
    const token = command.data.tokens.includes(ArtifactToken.Credit) ? ArtifactToken.Credit : command.data.tokens[0];

    engine.move(`${prefix} ${Command.ExamineArtifact}. ${Command.ChooseArtifactToken} ${token}`);

    expect(engine.tiles.artifacts).to.not.include(token);
  });

  it("keeps the Space Giants scenario executable through the free mine build", () => {
    const engine = loadScenarioEngine("lost-fleet-space-giants-special");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.Special} 2step`);
    const command = expectCommand(partial, Command.Build);
    const target = command.data.buildings.find((entry) => entry.building === Building.Mine);

    expect(target, "expected a mine target after Space Giants special").to.not.equal(undefined);

    engine.move(`${prefix} ${Command.Special} 2step. ${Command.Build} m ${target!.coordinates}`);

    const builtHex = engine.map.getS(target!.coordinates);
    expect(builtHex.data.player).to.equal(PlayerEnum.Player1);
    expect(builtHex.data.building).to.equal(Building.Mine);
  });

  it("keeps Rebellion's ship-tech scenario executable through tech claim and research", () => {
    const engine = loadScenarioEngine("lost-fleet-ship-tech-claim");
    const prefix = currentPlayerPrefix(engine);
    const afterAction = executeUntilInteractiveState(engine, `${prefix} ${Command.SpaceshipAction} rebellion qic`);
    const techCommand = expectCommand(afterAction, Command.ChooseTechTile);
    const shipTech = techCommand.data.tiles.find((tile) => tile.pos === Spaceship.Rebellion) ?? techCommand.data.tiles[0];
    const afterTech = executeUntilInteractiveState(
      engine,
      `${prefix} ${Command.SpaceshipAction} rebellion qic. ${Command.ChooseTechTile} ${shipTech.pos}`
    );
    const researchCommand = expectCommand(afterTech, Command.UpgradeResearch);
    const track = researchCommand.data.tracks[0].field;

    engine.move(
      `${prefix} ${Command.SpaceshipAction} rebellion qic. ${Command.ChooseTechTile} ${shipTech.pos}. ${Command.UpgradeResearch} ${track}`
    );

    expect(engine.player(PlayerEnum.Player1).data.tiles.techs.some((tile) => tile.pos === shipTech.pos)).to.equal(true);
  });

  it("keeps T F Mars's instant Gaiaforming scenario executable", () => {
    const engine = loadScenarioEngine("lost-fleet-tf-mars-instant-gaiaforming");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.SpaceshipAction} tfmars power`);
    const command = expectCommand(partial, Command.GaiaFormTransdim);
    const target = command.data.spaces[0];

    engine.move(`${prefix} ${Command.SpaceshipAction} tfmars power. ${Command.GaiaFormTransdim} ${target.coordinates}`);

    expect(engine.map.getS(target.coordinates).data.planet).to.equal(Planet.Gaia);
  });

  it("keeps Eclipse's asteroid-mine scenario executable", () => {
    const engine = loadScenarioEngine("lost-fleet-eclipse-asteroid-mine");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.SpaceshipAction} eclipse credit`);
    const command = expectCommand(partial, Command.Build);
    const target = command.data.buildings.find((entry) => entry.building === Building.Mine);

    expect(target, "expected an asteroid mine target").to.not.equal(undefined);

    engine.move(`${prefix} ${Command.SpaceshipAction} eclipse credit. ${Command.Build} m ${target!.coordinates}`);

    const builtHex = engine.map.getS(target!.coordinates);
    expect(builtHex.data.player).to.equal(PlayerEnum.Player1);
    expect(builtHex.data.building).to.equal(Building.Mine);
  });

  it("keeps Rebellion's upgrade scenario executable", () => {
    const engine = loadScenarioEngine("lost-fleet-rebellion-upgrade-ts");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.SpaceshipAction} rebellion power`);
    const command = expectCommand(partial, Command.Build);
    const target = command.data.buildings.find((entry) => entry.building === Building.TradingStation);

    expect(target, "expected a Trading Station upgrade target").to.not.equal(undefined);

    engine.move(`${prefix} ${Command.SpaceshipAction} rebellion power. ${Command.Build} ts ${target!.coordinates}`);

    const upgradedHex = engine.map.getS(target!.coordinates);
    expect(upgradedHex.data.player).to.equal(PlayerEnum.Player1);
    expect(upgradedHex.data.building).to.equal(Building.TradingStation);
  });

  it("keeps Moweyds' power-ring scenario executable", () => {
    const engine = loadScenarioEngine("lost-fleet-moweyds-power-ring");
    const prefix = currentPlayerPrefix(engine);
    const partial = executeUntilInteractiveState(engine, `${prefix} ${Command.Special} power-ring`);
    const command = expectCommand(partial, Command.PlacePowerRing);
    const target = command.data.spaces[0];

    engine.move(`${prefix} ${Command.Special} power-ring. ${Command.PlacePowerRing} ${target.coordinates}`);

    expect(engine.map.getS(target.coordinates).data.powerRing).to.equal(PlayerEnum.Player1);
  });
});
