import Engine, { AvailableCommand, Building, Command, Planet, PlayerEnum, Spaceship } from "@gaia-project/engine";
import { expect } from "chai";
import type { ButtonData } from "../../data";
import { loadScenarioEngine } from "../../self-contained-scenarios";
import { specialActionsButton } from "./actions";
import { buildButtons } from "./buildings";
import type { CommandController } from "./types";

const controller = {
  customButtons: [],
  subscriptions: {},
  temporaryRange: 0,
  analysisMode: false,
  highlightHexes: () => {},
  subscribeHexClick: () => {},
  handleButtonClick: () => {},
  handleCommand: () => {},
  executeCommand: () => {},
  activate: () => {},
  disableTooltips: () => {},
  supportsHover: () => false,
  enabledButtonWarnings: () => [],
  isWarningEnabled: () => true,
  highlightResearchTiles: () => {},
  highlightTechs: () => {},
  highlightSectors: () => {},
  highlightBoardActions: () => {},
  highlightSpecialActions: () => {},
  setFastConversionTooltips: () => {},
  subscribeAction: () => () => {},
  subscribeFinal: () => {},
  undo: () => {},
} as unknown as CommandController;

function command<T extends Command>(engine: Engine, name: T): AvailableCommand<T> {
  return engine.findAvailableCommand(PlayerEnum.Player1, name) as AvailableCommand<T>;
}

function gaiaFormerMenu(engine: Engine, commands = engine.availableCommands): ButtonData {
  const buttons = buildButtons(
    controller,
    engine,
    command(engine, Command.Build),
    engine.player(PlayerEnum.Player1),
    commands
  );
  return buttons.find((b) => b.richText?.some((part) => part.building?.type === Building.GaiaFormer));
}

const isHex = (b: ButtonData) => b.command?.startsWith(`${Command.Build} ${Building.GaiaFormer} `);

describe("Instant Gaiaforming in the Gaia Former menu", () => {
  it("offers the booster's action ahead of the hexes, as the same move the special action menu makes", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    const menu = gaiaFormerMenu(engine);

    const [instant, ...rest] = menu.buttons;
    expect(instant.command).to.equal(`${Command.Special} instant-gaiaforming`);
    expect(instant.shortcuts).to.deep.equal(["g"]);
    expect(instant.tooltip).to.contain("No power tokens are moved to your Gaia area");
    expect(rest.length).to.be.greaterThan(0);
    expect(rest.every(isHex), "every hex carries the whole build command").to.equal(true);
    expect(menu.command).to.equal(undefined);
  });

  it("leaves normal placements unwarned, since the menu already shows the instant way", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    const menu = gaiaFormerMenu(engine);

    expect(menu.buttons.filter(isHex).every((hex) => !hex.warning)).to.equal(true);
    expect(menu.warning).to.equal(null);
  });

  it("doesn't ask for confirmation on opening the menu, even when every hex has a warning", () => {
    // T F Mars's scenario only has 4 tokens in area 1 for a 6-token Gaia Project.
    const engine = loadScenarioEngine("lost-fleet-tf-mars-instant-gaiaforming");
    const menu = gaiaFormerMenu(engine);

    expect(menu.buttons.filter(isHex).every((hex) => hex.warning?.body.length > 0)).to.equal(true);
    expect(menu.warning).to.equal(null);
  });

  it("offers T F Mars's Power action with its cost", () => {
    const engine = loadScenarioEngine("lost-fleet-tf-mars-instant-gaiaforming");
    const [instant] = gaiaFormerMenu(engine).buttons;

    expect(instant.command).to.equal(`${Command.SpaceshipAction} ${Spaceship.TFMars} power`);
    expect(instant.richText[0].spaceshipAction).to.deep.equal({ ship: Spaceship.TFMars, type: "power" });
    expect(instant.tooltip).to.contain("T F Mars, 2pw");
  });

  it("gives each source its own letter when both are available", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    engine.player(PlayerEnum.Player1).data.explorationShips[Spaceship.TFMars] = 1;
    engine.clearAvailableCommands();
    engine.generateAvailableCommands();

    const choices = gaiaFormerMenu(engine).buttons.filter((b) => !isHex(b));
    expect(choices.map((b) => b.command)).to.deep.equal([
      `${Command.Special} instant-gaiaforming`,
      `${Command.SpaceshipAction} ${Spaceship.TFMars} power`,
    ]);
    expect(choices.map((b) => b.shortcuts)).to.deep.equal([["g"], ["i"]]);
  });

  it("leaves the menu as it was without a source of Instant Gaiaforming", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    const commands = engine.availableCommands.filter((c) => c.name !== Command.Special);
    const menu = gaiaFormerMenu(engine, commands);

    expect(menu.command).to.equal(`${Command.Build} ${Building.GaiaFormer}`);
    expect(menu.buttons.every((b) => !b.command.includes(" "))).to.equal(true);
    expect(menu.buttons.every((b) => !b.warning)).to.equal(true);
  });

  it("plays the offered move as instant Gaiaforming", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    const [instant] = gaiaFormerMenu(engine).buttons;
    const faction = engine.player(PlayerEnum.Player1).faction;
    const before = engine.player(PlayerEnum.Player1).data.power.gaia;

    const partial = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    partial.move(`${faction} ${instant.command}`);
    partial.generateAvailableCommandsIfNeeded();
    const target = command(partial, Command.GaiaFormTransdim).data.spaces[0].coordinates;

    engine.move(`${faction} ${instant.command}. ${Command.GaiaFormTransdim} ${target}`);

    expect(engine.map.getS(target).data.planet).to.equal(Planet.Gaia);
    expect(engine.map.getS(target).data.building).to.equal(Building.GaiaFormer);
    expect(engine.player(PlayerEnum.Player1).data.power.gaia).to.equal(before);
  });
});

describe("Instant Gaiaforming special action", () => {
  it("explains in its tooltip that no power tokens go to the Gaia area", () => {
    const engine = loadScenarioEngine("lost-fleet-instant-gaiaforming-booster");
    const button = specialActionsButton(
      command(engine, Command.Special),
      engine.player(PlayerEnum.Player1),
      controller
    );

    expect(button.command).to.equal(`${Command.Special} instant-gaiaforming`);
    expect(button.tooltip).to.contain("place a Gaia Former on a Transdim planet in range");
    expect(button.tooltip).to.contain("No power tokens are moved to your Gaia area");
  });
});
