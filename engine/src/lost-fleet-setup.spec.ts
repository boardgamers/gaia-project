import { expect } from "chai";
import Engine from "./engine";
import { Command, Phase, Planet } from "./enums";
import { findDeepSpaceNotches, findInterspaceHoles, lostFleetSectorCenters } from "./lost-fleet-map";
import { deepSpaceSetupFace } from "./lost-fleet-setup";
import { AvailableSetupOption, SetupType } from "./setup";

function choiceFromBoard(reference: Engine, { type, position, options }: AvailableSetupOption): string {
  const index = Number(position) - 1;
  switch (type) {
    case SetupType.Booster:
      return options.find((option) => reference.tiles.boosters[option]);
    case SetupType.TechTile:
    case SetupType.AdvTechTile:
      return reference.tiles.techs[position].tile;
    case SetupType.TerraformingFederation:
      return reference.terraformingFederation;
    case SetupType.RoundScoringTile:
      return reference.tiles.scorings.round[index];
    case SetupType.FinalScoringTile:
      return reference.tiles.scorings.final[index];
    case SetupType.SpaceshipTechTile:
      return reference.tiles.spaceshipTechs[position].tile;
    case SetupType.SpaceshipFederation:
      return reference.tiles.spaceshipFederations[position];
    case SetupType.ArtifactToken:
      return reference.tiles.artifacts[index];
    case SetupType.ScoringExtensionSide:
      return reference.scoringExtensionSide;
    case SetupType.EconomySide:
      return reference.lostFleetEconomySide;
    case SetupType.TerraformingColor:
      return reference.lostFleetTerraformingRow[index];
    case SetupType.MapTile:
      return reference.options.map.sectors[index].sector;
    case SetupType.InterspaceTile: {
      const hole = findInterspaceHoles(lostFleetSectorCenters(reference.players.length))[index];
      const hex = reference.map.grid.get(hole);
      return hex.data.spaceship ?? hex.data.planet;
    }
    case SetupType.DeepSpaceTile: {
      const cells = findDeepSpaceNotches(lostFleetSectorCenters(reference.players.length))[index];
      const hexes = cells.map((cell) => reference.map.grid.get(cell));
      const id = hexes[0].data.sector.slice(2, 4);
      return options.find(
        (option) =>
          option.startsWith(id) && deepSpaceSetupFace(option).every((planet, i) => planet === hexes[i].data.planet)
      );
    }
  }
}

describe("Lost Fleet host board setup", () => {
  for (const players of [2, 3, 4]) {
    for (const officialCenterSectors of [false, true]) {
      it(`can draft, reload and replay a complete ${players}p board (official centers: ${officialCenterSectors})`, () => {
        const init = `init ${players} ${players === 3 ? "Judicial-gondola-1080" : `custom-fleet-${players}`}`;
        const reference = new Engine([init], { lostFleet: true, officialCenterSectors });
        let engine = new Engine([init], { lostFleet: true, officialCenterSectors, customBoardSetup: true, creator: 1 });
        for (let i = 0; i < 100; i++) {
          const command = engine.findAvailableCommand(engine.playerToMove, Command.Setup);
          if (!command) break;
          expect(engine.playerToMove).to.equal(1);
          const data = command.data as AvailableSetupOption;
          const choice = choiceFromBoard(reference, data);
          expect(data.options, `${data.type} ${data.position}: ${choice}`).to.include(choice);
          engine.move(`p2 set ${data.type} ${data.position} to ${choice}`);
          engine = Engine.fromData(JSON.parse(JSON.stringify(engine)));
        }
        expect(engine.findAvailableCommand(engine.playerToMove, Command.RotateSectors)).to.exist;
        const rotations = reference.options.map.sectors
          .map(({ center, rotation }) => `${center.q}x${center.r} ${rotation}`)
          .join(" ");
        engine.move(`p2 rotate ${rotations}`);
        expect(engine.phase).to.equal(Phase.SetupFaction);
        expect(engine.map.grid.size).to.equal(reference.map.grid.size);
        for (const hex of reference.map.grid.values()) {
          expect(JSON.parse(JSON.stringify(engine.map.grid.get(hex).data))).to.deep.equal(
            JSON.parse(JSON.stringify(hex.data))
          );
        }
        expect(engine.tiles).to.deep.equal(reference.tiles);
        expect(engine.scoringExtensionSide).to.equal(reference.scoringExtensionSide);
        expect(engine.lostFleetEconomySide).to.equal(reference.lostFleetEconomySide);
        expect(engine.lostFleetTerraformingRow).to.deep.equal(reference.lostFleetTerraformingRow);
        const replay = engine.replayedTo();
        expect(replay.map.toJSON()).to.deep.equal(engine.map.toJSON());
        expect(replay.tiles).to.deep.equal(engine.tiles);
      });
    }
  }

  it("only offers Deep Space faces that preserve a valid board", () => {
    const engine = new Engine(["init 3 host-deep-space"], { lostFleet: true, customBoardSetup: true });
    for (let i = 0; i < 100; i++) {
      const command = engine.findAvailableCommand(0, Command.Setup);
      if (!command) break;
      const data = command.data as AvailableSetupOption;
      if (data.type === SetupType.DeepSpaceTile) {
        for (const choice of data.options) {
          const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));
          copy.move(`p1 set ${data.type} ${data.position} to ${choice}`);
          for (const hex of copy.map.grid.values()) {
            if (!hex.data.sector.startsWith("DS") || [Planet.Empty, Planet.Transdim].includes(hex.data.planet))
              continue;
            for (const neighbour of copy.map.grid.neighbours(hex)) {
              expect(neighbour.data.planet, choice).not.to.equal(hex.data.planet);
            }
          }
        }
      }
      expect(data.options.length).to.be.greaterThan(0);
      engine.move(`p1 set ${data.type} ${data.position} to ${data.options[0]}`);
    }
    expect(engine.findAvailableCommand(0, Command.RotateSectors)).to.exist;
  });

  it("rejects choosing the same booster twice", () => {
    const engine = new Engine(["init 3 duplicate"], { lostFleet: true, customBoardSetup: true });
    const data = engine.findAvailableCommand(0, Command.Setup).data as AvailableSetupOption;
    engine.move(`p1 set booster 1 to ${data.options[0]}`);
    expect(() => engine.move(`p1 set booster 2 to ${data.options[0]}`)).to.throw("Invalid booster setup choice");
  });
});
