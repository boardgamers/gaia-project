import { expect } from "chai";
import { Expansion, Spaceship } from "./enums";
import { artifactSlotCount, EXPLORATION_CHARGE_TRACK, shipsInPlay, spaceshipBoards } from "./spaceships";

describe("Spaceship boards", () => {
  it("should have exactly 3 actions per ship, one of each cost type (qic/power/knowledge-or-credit)", () => {
    for (const ship of Spaceship.values(Expansion.LostFleet)) {
      const board = spaceshipBoards[ship];
      expect(board.actions).to.have.length(3);
      expect(board.actions.map((a) => a.type)).to.contain("qic");
      expect(board.actions.map((a) => a.type)).to.contain("power");
      expect(board.actions.some((a) => a.type === "knowledge" || a.type === "credit")).to.be.true;
      for (const action of board.actions) {
        expect(action.cost).to.be.a("string").with.length.greaterThan(0);
        expect(action.effect).to.be.a("string").with.length.greaterThan(0);
      }
    }
  });

  it("should only give Twilight a Knowledge action and Rebellion the other Knowledge action", () => {
    expect(spaceshipBoards[Spaceship.Twilight].actions.some((a) => a.type === "knowledge")).to.be.true;
    expect(spaceshipBoards[Spaceship.Rebellion].actions.some((a) => a.type === "knowledge")).to.be.true;
    expect(spaceshipBoards[Spaceship.TFMars].actions.some((a) => a.type === "credit")).to.be.true;
    expect(spaceshipBoards[Spaceship.Eclipse].actions.some((a) => a.type === "credit")).to.be.true;
  });

  it("should give a Standard Tech slot to every ship except Twilight", () => {
    expect(spaceshipBoards[Spaceship.Twilight].hasStandardTechSlot).to.be.false;
    expect(spaceshipBoards[Spaceship.Rebellion].hasStandardTechSlot).to.be.true;
    expect(spaceshipBoards[Spaceship.TFMars].hasStandardTechSlot).to.be.true;
    expect(spaceshipBoards[Spaceship.Eclipse].hasStandardTechSlot).to.be.true;
  });

  it("should have a 4-space exploration charge track of 0/2/2/4", () => {
    expect(EXPLORATION_CHARGE_TRACK).to.deep.equal([0, 2, 2, 4]);
  });

  describe("artifactSlotCount", () => {
    it("should equal the player count, Twilight only", () => {
      expect(artifactSlotCount(Spaceship.Twilight, 2)).to.equal(2);
      expect(artifactSlotCount(Spaceship.Twilight, 4)).to.equal(4);
      expect(artifactSlotCount(Spaceship.Rebellion, 4)).to.equal(0);
      expect(artifactSlotCount(Spaceship.TFMars, 4)).to.equal(0);
      expect(artifactSlotCount(Spaceship.Eclipse, 4)).to.equal(0);
    });
  });

  describe("shipsInPlay", () => {
    it("should exclude Rebellion in 2-player games", () => {
      const ships = shipsInPlay(Expansion.LostFleet, 2);
      expect(ships).to.not.contain(Spaceship.Rebellion);
      expect(ships).to.have.length(3);
    });

    it("should include all 4 ships in 3+ player games", () => {
      for (const nbPlayers of [3, 4, 5]) {
        const ships = shipsInPlay(Expansion.LostFleet, nbPlayers);
        expect(ships).to.contain(Spaceship.Rebellion);
        expect(ships).to.have.length(4);
      }
    });

    it("should be empty without the Lost Fleet expansion", () => {
      expect(shipsInPlay(Expansion.None, 4)).to.deep.equal([]);
      expect(shipsInPlay(Expansion.Frontiers, 4)).to.deep.equal([]);
    });
  });
});
