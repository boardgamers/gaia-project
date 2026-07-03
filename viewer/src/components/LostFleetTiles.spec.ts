import Engine, { AdvTechTile, Booster as BoosterEnum, TechTilePos } from "@gaia-project/engine";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { techTileEventWithSource } from "@gaia-project/engine/src/tiles/techs";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import Booster from "./Booster.vue";
import TechTile from "./TechTile.vue";

// Locks the reuse-first rule for the Lost Fleet tile families: every LF Advanced Tech tile and
// round booster must render through the base game's TechContent icon system (Condition/Resource/
// Operator icons), never fall back to printing the raw event spec as text.
describe("Lost Fleet tiles render with base-game iconography", () => {
  const store = () => {
    const s = makeStore();
    s.commit("receiveData", new Engine(["init 2 lost-fleet-tiles-spec"], { lostFleet: true }));
    return s;
  };

  it("renders all 6 Lost Fleet Advanced Tech tiles without raw spec text", () => {
    const lostFleetTiles = [
      AdvTechTile.AsteroidPass,
      AdvTechTile.Big,
      AdvTechTile.Deep,
      AdvTechTile.DeepPass,
      AdvTechTile.QAction,
      AdvTechTile.Terra,
    ];

    for (const tile of lostFleetTiles) {
      const { container } = render(TechTile, {
        props: { pos: TechTilePos.Economy, tileOverride: tile, countOverride: 1, disableTooltip: true },
        store: store(),
      });

      const rawSpec = techTileEventWithSource(tile, null)[0].spec;
      expect(container.textContent, `${tile} must not print its raw spec "${rawSpec}"`).to.not.contain(rawSpec);
      expect(
        container.querySelector("g.condition"),
        `${tile} should render a condition icon`
      ).to.not.equal(null);
    }
  });

  it("renders the asteroid and ship-QIC-action conditions with their own icons", () => {
    const asteroid = render(TechTile, {
      props: { pos: TechTilePos.Economy, tileOverride: AdvTechTile.AsteroidPass, countOverride: 1, disableTooltip: true },
      store: store(),
    });
    expect(asteroid.container.querySelector("g.condition .planet-fill.a")).to.not.equal(null);

    const qAction = render(TechTile, {
      props: { pos: TechTilePos.Economy, tileOverride: AdvTechTile.QAction, countOverride: 1, disableTooltip: true },
      store: store(),
    });
    expect(qAction.container.querySelector("g.condition polygon")).to.not.equal(null);
  });

  it("renders all 4 Lost Fleet round boosters through the base booster template", () => {
    const lostFleetBoosters = [
      BoosterEnum.LostFleetFormer,
      BoosterEnum.LostFleetPlanet,
      BoosterEnum.LostFleetDeep,
      BoosterEnum.LostFleetInstant,
    ];

    for (const booster of lostFleetBoosters) {
      const { container } = render(Booster, { props: { booster }, store: store() });

      expect(container.querySelector(".booster-background"), `${booster} background`).to.not.equal(null);
      for (const event of boosterEvents(booster)) {
        expect(container.textContent, `${booster} must not print its raw spec "${event.spec}"`).to.not.contain(
          event.spec
        );
      }
    }

    // spot-check the distinctive parts: the pass-VP boosters show the red PASS ribbon + a condition
    // icon, and the instant-gaiaforming booster shows a special-action octagon
    const former = render(Booster, { props: { booster: BoosterEnum.LostFleetFormer }, store: store() });
    expect(former.container.textContent).to.contain("PASS");
    expect(former.container.querySelector("g.condition")).to.not.equal(null);

    const instant = render(Booster, { props: { booster: BoosterEnum.LostFleetInstant }, store: store() });
    expect(instant.container.querySelector("g.specialAction")).to.not.equal(null);
  });
});
