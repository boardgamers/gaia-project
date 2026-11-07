import Engine, { Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import AlternateShips from "../../../old-ui/src/components/LostFleetShips.vue";
import AlternateHex from "../../../old-ui/src/components/SpaceHex.vue";
import { spaceshipColors, spaceshipNames } from "../data/spaceships";
import { makeStore } from "../store";
import SpaceHex from "./SpaceHex.vue";
import SpaceshipEmblem from "./SpaceshipEmblem.vue";

// The alternate UI inherits ship-board methods but owns its template. Exercise that real template,
// not a CSS-hidden variant, to protect its initial markers and canonical ship headings.
describe("Spaceship insignia proposal", () => {
  it("gives every insignia a graphic and its full accessible ship name, including Rebellion", () => {
    for (const ship of [Spaceship.Twilight, Spaceship.Rebellion, Spaceship.TFMars, Spaceship.Eclipse]) {
      const { container } = render(SpaceshipEmblem, { props: { ship } });
      expect(container.querySelector('[role="img"]').getAttribute("aria-label")).to.contain(spaceshipNames[ship]);
      expect(container.querySelector("text, [data-emblem-pending]")).to.equal(null);
      expect(container.querySelector("path")).not.to.equal(null);
    }
  });

  it("enlarges upright primary map emblems behind full-size explorers and keeps alternate initials", () => {
    const engine = new Engine(
      ["init 4 emblem-map", "p1 faction terrans", "p2 faction hadsch-hallas", "p3 faction moweyds", "p4 faction xenos"],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);
    for (const ship of [Spaceship.Twilight, Spaceship.Rebellion, Spaceship.TFMars, Spaceship.Eclipse]) {
      engine.players.forEach((player, i) => {
        player.data.explorationShips[ship] = i + 1;
      });
      const hex = Array.from(engine.map.grid.values()).find((hex) => hex.data.spaceship === ship);
      const props = { hex, contentRotation: 30 };
      const { container } = render(SpaceHex, { store, props });
      const emblem = container.querySelector(".spaceship-emblem");
      expect(emblem.parentElement.parentElement.getAttribute("transform")).to.equal("rotate(-30)");
      expect(container.querySelector(".lost-fleet-spaceship__hex")).to.equal(null);
      expect(container.querySelector("title").textContent).to.contain(spaceshipNames[ship]);
      expect(emblem.getAttribute("transform")).to.equal("scale(0.08)");
      const layers = Array.from(emblem.parentElement.children);
      const explorers = Array.from(container.querySelectorAll(".lost-fleet-spaceship__explorer"));
      expect(explorers).to.have.length(4);
      for (const explorer of explorers) {
        const [x, y] = explorer
          .getAttribute("transform")
          .match(/-?[\d.]+/g)
          .map(Number);
        // Overlap is intentional; the original full-size tokens remain above the large insignia.
        expect(Math.hypot(x, y)).to.be.lessThan(10 * 0.08 + 0.3);
        expect(layers.indexOf(explorer)).to.be.greaterThan(layers.indexOf(emblem));
        expect(explorer.querySelector(".lost-fleet-spaceship__explorer-outline").getAttribute("r")).to.equal("0.3");
        expect(explorer.querySelector(".planet-fill").getAttribute("r")).to.equal("0.25");
      }
      const { container: alternate } = render(AlternateHex, { store, props });
      expect(alternate.querySelector(".spaceship-emblem")).to.equal(null);
      const color = document.createElement("span");
      color.style.fill = spaceshipColors[ship];
      expect((alternate.querySelector(".lost-fleet-spaceship__hex") as SVGElement).style.fill).to.equal(
        color.style.fill
      );
      expect(alternate.querySelector(".lost-fleet-spaceship__label").textContent).to.equal(
        { twilight: "T", rebellion: "R", tfmars: "M", eclipse: "E" }[ship]
      );
    }
  });

  it("keeps the alternate board template with complete canonical ship names", () => {
    const store = makeStore();
    store.commit("receiveData", new Engine(["init 4 emblem-alternate"], { lostFleet: true }));
    const { container } = render(AlternateShips, { store });
    expect(container.querySelector(".spaceship-emblem")).to.equal(null);
    expect(Array.from(container.querySelectorAll("header strong")).map((node) => node.textContent)).to.have.members([
      "TWILIGHT",
      "REBELLION",
      "T F MARS",
      "ECLIPSE",
    ]);
  });
});
