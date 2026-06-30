import Engine, {
  Faction,
  Spaceship,
} from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import LostFleetShipActionsRow from "./LostFleetShipActionsRow.vue";

describe("LostFleetShipActionsRow", () => {
  it("stays hidden outside Lost Fleet", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 2 base-spaceships"]));

    const { container } = render(LostFleetShipActionsRow, { store });

    expect(container.querySelector(".lost-fleet-action-row")).to.equal(null);
  });

  it("renders compact ship action groups with faction-colored access slots", () => {
    const engine = new Engine(["init 2 lost-fleet-ship-action-row"], { lostFleet: true });
    engine.players[0].faction = Faction.Terrans;
    engine.players[0].name = "Ada";
    engine.players[1].faction = Faction.Lantids;
    engine.players[1].name = "Bo";

    engine.players[0].data.explorationShips[Spaceship.Twilight] = 2;
    engine.players[1].data.explorationShips[Spaceship.Eclipse] = 4;
    engine.spaceshipActions[Spaceship.Twilight] = { qic: PlayerEnum.Player1 };

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(LostFleetShipActionsRow, { store });

    expect(container.querySelectorAll(".lost-fleet-action-row__group").length).to.equal(3);
    expect(container.querySelectorAll(".lost-fleet-action-row__action").length).to.equal(9);
    expect(container.querySelector('[data-ship="rebellion"]')).to.equal(null);
    expect(container.querySelector('[data-ship="twilight"] [data-action="qic"]')?.textContent).to.contain("Used by Ada");
    expect(container.querySelector('[data-ship="twilight"] [data-slot="2"]')?.getAttribute("style")).to.contain("--slot-bg");
    expect(container.querySelector('[data-ship="eclipse"] [data-slot="4"]')?.getAttribute("title")).to.contain("Bo");
  });
});
