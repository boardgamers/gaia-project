import Engine, { Building, Command, PlayerEnum } from "@gaia-project/engine";
import { expect } from "chai";
import { ButtonData } from "../../data";
import { buildButtons } from "./buildings";
import { CommandController } from "./types";

// The sandbox's two Trading Station buttons (owner instruction, 2026-08-19). Every build button in
// this app is icon-only, with the words in the tooltip - which stops working the moment two buttons
// carry the same Trading Station icon, so the pair has to be readable on the button face itself.
describe("the sandbox's cheap/expensive Trading Station pair", () => {
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

  function tradingStationButtons(sandbox: boolean): ButtonData[] {
    const engine = new Engine(SETUP);
    const pl = engine.player(PlayerEnum.Player1);
    pl.data.credits = 20;
    pl.data.ores = 20;
    pl.data.analysis = sandbox;
    engine.clearAvailableCommands();
    engine.generateAvailableCommands();

    const controller = {
      customButtons: [],
      subscriptions: {},
      temporaryRange: 0,
      analysisMode: sandbox,
      highlightHexes: () => {},
      subscribeHexClick: () => {},
      handleButtonClick: () => {},
      handleCommand: () => {},
      executeCommand: () => {},
      activate: () => {},
      disableTooltips: () => {},
      supportsHover: () => false,
      enabledButtonWarnings: () => [],
      isWarningEnabled: () => false,
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

    const command = engine.findAvailableCommand(PlayerEnum.Player1, Command.Build)!;
    // `withShortcut` puts <u> markers inside the real button's label, so match on the stripped text.
    return buildButtons(controller, engine, command as any, pl).filter((b) =>
      (b.label ?? "").replace(/<\/?u>/g, "").includes("Trading Station")
    );
  }

  // The text actually painted on the button, as opposed to the tooltip.
  const faceText = (button: ButtonData) =>
    (button.richText ?? [])
      .map((part: any) => part.text ?? "")
      .join(" ")
      .trim();

  it("gives a real game exactly one, unlabelled apart from its icon - unchanged from before the pair existed", () => {
    const buttons = tradingStationButtons(false);

    expect(buttons).to.have.length(1);
    expect(faceText(buttons[0])).to.equal("");
    expect(buttons[0].shortcuts).to.deep.equal(["t"]);
  });

  it("gives the sandbox two, each carrying its own word on the button face", () => {
    const buttons = tradingStationButtons(true);

    expect(buttons).to.have.length(2);
    expect(buttons.map(faceText)).to.deep.equal(["Expensive", "Cheap"]);
  });

  it("says which price each one charges, and that the cheap one is a sandbox fiction", () => {
    const [expensive, cheap] = tradingStationButtons(true);

    expect(expensive.label).to.contain("6c");
    expect(cheap.label).to.contain("3c");
    expect(cheap.label).to.contain("cannot be committed");
  });

  it("keeps the shortcut on the real one only, since nothing here resolves a collision", () => {
    const [expensive, cheap] = tradingStationButtons(true);

    expect(expensive.shortcuts).to.deep.equal(["t"]);
    expect(cheap.shortcuts ?? []).to.deep.equal([]);
  });

  it("sends the cheap one's hexes through the qualifier the engine reads, and the real one's without it", () => {
    const [expensive, cheap] = tradingStationButtons(true);

    expect(cheap.buttons.length).to.be.greaterThan(0);
    expect(cheap.buttons.every((b) => b.command.endsWith(" cheap"))).to.equal(true);
    expect(expensive.buttons.some((b) => b.command.endsWith(" cheap"))).to.equal(false);
  });
});
