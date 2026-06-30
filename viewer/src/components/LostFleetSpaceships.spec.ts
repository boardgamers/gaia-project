import Engine, {
  ArtifactToken,
  Faction,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
} from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import LostFleetSpaceships from "./LostFleetSpaceships.vue";

describe("LostFleetSpaceships", () => {
  it("stays hidden outside Lost Fleet", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 2 base-spaceships"]));

    const { container } = render(LostFleetSpaceships, { store });

    expect(container.querySelector(".lost-fleet-ships")).to.equal(null);
  });

  it("renders the Lost Fleet ship rewards and omits the action strip", () => {
    const engine = new Engine(["init 2 lost-fleet-spaceship-panel"], { lostFleet: true });
    engine.players[0].faction = Faction.Terrans;
    engine.players[0].name = "Ada";
    engine.players[1].faction = Faction.Lantids;
    engine.players[1].name = "Bo";

    engine.tiles.spaceshipTechs = {
      [Spaceship.TFMars]: { tile: SpaceshipTechTile.Range, count: 1 },
    };
    engine.tiles.spaceshipFederations = {
      [Spaceship.Twilight]: SpaceshipFederation.Tech,
    };
    engine.tiles.artifacts = [ArtifactToken.Credit, ArtifactToken.Power];

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetSpaceships, { store });

    expect(container.querySelectorAll(".lost-fleet-ship-card").length).to.equal(3);
    expect(container.querySelector('[data-ship="rebellion"]')).to.equal(null);
    expect(container.querySelector('[data-ship="twilight"] [data-marker="T"]')).to.not.equal(null);
    expect(container.querySelector('[data-ship="twilight"] [data-action="qic"]')).to.equal(null);
    expect(container.querySelector('[data-ship="tfmars"] [data-section="tech"]')?.textContent).to.contain("Range +1");
    expect(container.querySelector('[data-ship="twilight"] [data-section="federation"]')?.textContent).to.contain("Tech");
    expect(container.querySelector('[data-ship="twilight"] [data-artifact="artifact-credit"]')).to.not.equal(null);
    expect(container.querySelector('[data-ship="twilight"] [data-artifact="artifact-power"]')).to.not.equal(null);
  });
});
