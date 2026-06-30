import Engine from "@gaia-project/engine";
import { Building, Command, Planet, Player as PlayerEnum, Spaceship } from "@gaia-project/engine/src/enums";
import { expect } from "chai";
import { buildScenarioUrl, loadScenarioEngine, parseScenarioFromQuery, selfContainedScenarios } from "./self-contained-scenarios";

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

  it("keeps Twilight's temporary range active in the +3 range scenario", () => {
    const engine = loadScenarioEngine("lost-fleet-twilight-range-plus-3");

    expect(engine.player(PlayerEnum.Player1).data.temporaryRange).to.equal(3);
  });

  it("opens the artifact picker directly in the artifact-choice scenario", () => {
    const engine = loadScenarioEngine("lost-fleet-artifact-choice");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseArtifactToken);

    expect(command?.data.tokens).to.deep.equal(["artifact-credit", "artifact-federation", "artifact-deepspace"]);
  });

  it("offers explored-ship federation claims in the federation scenario", () => {
    const engine = loadScenarioEngine("lost-fleet-ship-federation-claim");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.FormFederation);

    expect(command).to.not.equal(undefined);
    expect(command?.data.claimableFederations).to.have.length(2);
  });

  it("opens the tech-pick flow in the ship tech claim scenario", () => {
    const engine = loadScenarioEngine("lost-fleet-ship-tech-claim");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.ChooseTechTile);

    expect(command).to.not.equal(undefined);
    expect(command?.data.tiles.some((tile) => tile.pos === Spaceship.TFMars)).to.equal(true);
  });

  it("opens the direct targeting step for T F Mars instant Gaiaforming", () => {
    const engine = loadScenarioEngine("lost-fleet-tf-mars-instant-gaiaforming");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.GaiaFormTransdim);

    expect(command).to.not.equal(undefined);
    expect(command?.data.spaces.length).to.be.greaterThan(0);
  });

  it("opens Eclipse's asteroid-mine placement step", () => {
    const engine = loadScenarioEngine("lost-fleet-eclipse-asteroid-mine");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Build);

    expect(command).to.not.equal(undefined);
    expect(command?.data.buildings.length).to.be.greaterThan(0);
    expect(command?.data.buildings.every((entry) => engine.map.getS(entry.coordinates).data.planet === Planet.Asteroid)).to.equal(true);
  });

  it("opens both federation-token build-mine follow-up scenarios", () => {
    const rangeEngine = loadScenarioEngine("lost-fleet-range-fed-build-mine");
    const terraformEngine = loadScenarioEngine("lost-fleet-terraform-fed-build-mine");

    const rangeCommand = rangeEngine.findAvailableCommand(PlayerEnum.Player1, Command.Build);
    const terraformCommand = terraformEngine.findAvailableCommand(PlayerEnum.Player1, Command.Build);

    expect(rangeCommand).to.not.equal(undefined);
    expect(terraformCommand).to.not.equal(undefined);
    expect(rangeCommand?.data.buildings.length).to.be.greaterThan(0);
    expect(terraformCommand?.data.buildings.length).to.be.greaterThan(0);
  });

  it("opens Rebellion's ship-upgrade step on an owned mine", () => {
    const engine = loadScenarioEngine("lost-fleet-rebellion-upgrade-ts");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Build);

    expect(command).to.not.equal(undefined);
    expect(command?.data.buildings.some((entry) => entry.upgrade && entry.building === Building.TradingStation)).to.equal(true);
  });

  it("keeps Moweyds' power-ring special action available", () => {
    const engine = loadScenarioEngine("lost-fleet-moweyds-power-ring");

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Special);

    expect(command).to.not.equal(undefined);
    expect(command?.data.specialacts.some((entry) => entry.income === "power-ring")).to.equal(true);
  });
});
