import type { AvailableSetupOption } from "@gaia-project/engine";
import Engine, { Command, SetupType } from "@gaia-project/engine";
import { expect } from "chai";
import type { ButtonData } from "../../data";
import { setupButton } from "./setup";
import type { CommandController } from "./types";

function leaves(button: ButtonData): string[] {
  return button.buttons ? button.buttons.flatMap(leaves) : [button.command];
}

describe("host setup controls", () => {
  for (const lostFleet of [false, true]) {
    it(`offers every engine choice throughout ${lostFleet ? "Lost Fleet" : "base game"} setup`, () => {
      const engine = new Engine(["init 3 host-ui"], { lostFleet, customBoardSetup: true });
      const seen = new Set<SetupType>();
      const controller = {
        subscribeFinal: () => {},
        highlightSectors: (coordinates) => {
          expect(coordinates.length).to.be.greaterThan(0);
          for (const coord of coordinates) expect(Number.isFinite(coord.q) && Number.isFinite(coord.r)).to.equal(true);
        },
        emitButtonCommand: () => {},
      } as CommandController;
      for (let step = 0; step < 100; step++) {
        const command = engine.findAvailableCommand(0, Command.Setup);
        if (!command) break;
        const data = command.data as AvailableSetupOption;
        seen.add(data.type);
        const button = setupButton(data, controller, engine);
        expect(button, data.type).to.exist;
        expect(button.command).to.equal(`set ${data.type} ${data.position} to`);
        expect(leaves(button).sort()).to.deep.equal([...data.options].sort());
        expect(data.options.length).to.be.greaterThan(0);
        button.onClick?.(button);
        engine.move(`p1 ${button.command} ${leaves(button)[0]}`);
      }
      expect(engine.findAvailableCommand(0, Command.RotateSectors)).to.exist;
      if (lostFleet) expect([...seen].sort()).to.deep.equal(Object.values(SetupType).sort());
    });
  }
});
