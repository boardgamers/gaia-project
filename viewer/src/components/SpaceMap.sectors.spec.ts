import Engine, {
  Building,
  classifySectorId,
  Condition,
  FinalTile,
  GaiaHex,
  LostFleetSectorType,
  Planet,
  PlayerEnum,
} from "@gaia-project/engine";
import { lostFleetSectorKey } from "@gaia-project/engine/src/lost-fleet-map";
import { cleanup, fireEvent, render } from "@testing-library/vue";
import { expect } from "chai";
import fs from "fs";
import Vue from "vue";
import AlternateSpaceMap from "../../../old-ui/src/components/SpaceMap.vue";
import { MapModeType } from "../data/actions";
import { sectors as sectorCount } from "../data/stats";
import { makeStore } from "../store";
import FinalScoringTile from "./FinalScoringTile.vue";
import SpaceMap from "./SpaceMap.vue";

function position(lostFleet: boolean) {
  const engine = new Engine(["init 2 sector-map-regression", "p1 faction firaks", "p2 faction lantids"], {
    lostFleet,
  });
  const hexes = [...engine.map.grid.values()];
  const ordinary = hexes.filter((hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Space);
  const first = ordinary[0];
  const adjacent = ordinary.find(
    (hex) =>
      hex.data.sector !== first.data.sector &&
      engine.map.grid.neighbours(hex).some((other) => other.data.sector === first.data.sector)
  );
  expect(adjacent, "fixture needs two adjacent regular sectors").not.to.equal(undefined);
  const regularKeys = [first.data.sector, adjacent.data.sector];
  const otherKeys = [...new Set(ordinary.map((hex) => hex.data.sector))].filter((key) => !regularKeys.includes(key));
  function occupy(hex: GaiaHex, player = PlayerEnum.Player1, building = Building.Mine) {
    hex.data.player = player;
    hex.data.building = building;
    if (building !== Building.SpaceStation) hex.data.planet = Planet.Titanium;
    engine.players[player].data.occupied.push(hex);
    return hex;
  }
  const mines = regularKeys.map((key) => occupy(ordinary.find((hex) => hex.data.sector === key && hex.hasPlanet())));
  mines[0].data.additionalMine = PlayerEnum.Player2;
  engine.players[1].data.occupied.push(mines[0]);
  occupy(
    ordinary.find((hex) => hex.data.sector === otherKeys[0] && hex.hasPlanet()),
    PlayerEnum.Player2
  );
  occupy(
    ordinary.find((hex) => hex.data.sector === otherKeys[1] && hex.hasPlanet()),
    PlayerEnum.Player1,
    Building.GaiaFormer
  );
  occupy(
    ordinary.find((hex) => hex.data.sector === otherKeys[2] && !hex.hasPlanet()),
    PlayerEnum.Player1,
    Building.SpaceStation
  );
  // Sector tint must stay below the existing top-layer Power Ring.
  mines[0].data.powerRing = PlayerEnum.Player1;
  const deep = hexes.filter((hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.DeepSpace);
  const deepKey = deep.length ? lostFleetSectorKey(deep[0]) : undefined;
  if (lostFleet) {
    const tile = deep.filter((hex) => lostFleetSectorKey(hex) === deepKey);
    // An empty-cell-only highlight would be completely invisible on this planet-filled tile.
    tile.forEach((hex) => {
      hex.data.planet = Planet.Asteroid;
    });
    occupy(tile[1]);
    tile[1].data.additionalMine = PlayerEnum.Player2;
    engine.players[1].data.occupied.push(tile[1]);
    occupy(
      hexes.find((hex) => classifySectorId(hex.data.sector) === LostFleetSectorType.Interspace && hex.hasPlanet())
    );
  }
  return { engine, regularKeys, otherKeys, deepKey, mines };
}

function highlightedKeys(container: HTMLElement, engine: Engine): Set<string> {
  const ids = [...container.querySelectorAll(".space-hex-cell > .space-hex-sector-highlight")].map(
    (node) => node.parentElement.id
  );
  return new Set(ids.map((id) => lostFleetSectorKey(engine.map.getS(id))));
}

for (const [name, component] of [
  ["primary", SpaceMap],
  ["alternate", AlternateSpaceMap],
] as const) {
  describe(`${name} Sectors map mode`, () => {
    for (const lostFleet of [false, true]) {
      it(`separates adjacent highlighted tiles and follows the selected player (${lostFleet ? "Lost Fleet" : "base"})`, async () => {
        const { engine, regularKeys, otherKeys, deepKey, mines } = position(lostFleet);
        const store = makeStore();
        store.commit("receiveData", engine);
        // Exercise setup rotation as well as primary Lost Fleet's whole-board rotation.
        store.commit("rotate", mines[0]);
        store.commit("rotate", mines[0]);
        const { container } = render(component, { store });
        const geometry = () =>
          [...container.querySelectorAll(".sector, .space-hex-cell")].map((node) => ({
            id: node.id,
            transform: node.getAttribute("transform"),
            style: node.getAttribute("style"),
          }));
        const defaultGeometry = geometry();
        expect(container.querySelector(".sector-boundaries")).to.equal(null);
        expect(highlightedKeys(container, engine).size).to.equal(0);

        store.commit("toggleMapMode", { type: MapModeType.sectors, player: PlayerEnum.Player1 });
        await Vue.nextTick();
        expect([...highlightedKeys(container, engine)]).to.have.members([
          ...regularKeys,
          ...(lostFleet ? [deepKey] : []),
        ]);
        // Exactly the normal positions and polygons: no extra spacing, boundary layer, or strokes
        // expanding into the normal 1% inter-sector gap. The old .planet + .space-hex-federation
        // classes brought a 0.1-unit faction stroke, wider than the gap between adjacent sectors.
        expect(geometry()).to.deep.equal(defaultGeometry);
        expect(container.querySelector(".sector-boundaries, .sector-boundary")).to.equal(null);
        const highlights = [...container.querySelectorAll(".space-hex-sector-highlight")];
        expect(highlights.length).to.be.greaterThan(0);
        for (const highlight of highlights) {
          expect(highlight.classList.contains("space-hex-federation")).to.equal(false);
          expect(highlight.classList.contains("planet")).to.equal(false);
          const polygon = highlight.parentElement.querySelector("use.space-hex");
          expect(highlight.getAttribute("href") ?? highlight.getAttribute("xlink:href")).to.equal(
            polygon.getAttribute("href") ?? polygon.getAttribute("xlink:href")
          );
          expect(highlight.getAttribute("transform")).to.equal(null);
          const content = highlight.parentElement.querySelector("g");
          expect(highlight.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).not.to.equal(0);
        }
        if (lostFleet) {
          const deepHighlights = highlights.filter((node) => node.parentElement.id.startsWith(`${deepKey}_`));
          expect(deepHighlights.length).to.equal(3);
          // All three have planets: background tint must not depend on an empty hex being available.
          expect(deepHighlights.every((node) => engine.map.getS(node.parentElement.id).hasPlanet())).to.equal(true);
          const deep = deepHighlights[0].parentElement;
          expect(deep.parentElement.getAttribute("transform")).to.equal(name === "primary" ? "rotate(60)" : null);
        }
        const ring = container.querySelector(".space-hex-power-ring");
        expect(
          highlights.every((node) => !!(node.compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING))
        ).to.equal(true);
        expect(container.querySelectorAll("defs").length).to.equal(3);
        // The visual request must NOT change base sector scoring or the player-board statistic.
        expect(engine.players[0].eventConditionCount(Condition.Sector)).to.equal(2);
        expect(sectorCount(engine.players[0])).to.equal(2);

        store.commit("toggleMapMode", { type: MapModeType.sectors, player: PlayerEnum.Player2 });
        await Vue.nextTick();
        expect([...highlightedKeys(container, engine)]).to.have.members([
          regularKeys[0],
          otherKeys[0],
          ...(lostFleet ? [deepKey] : []),
        ]);
        store.commit("toggleMapMode", { type: MapModeType.default, player: PlayerEnum.Player2 });
        await Vue.nextTick();
        expect(container.querySelector(".sector-boundaries")).to.equal(null);
        expect(highlightedKeys(container, engine).size).to.equal(0);
        cleanup();
      });
    }
  });
}

describe("base final sector-scoring map shortcut", () => {
  it("excludes Deep Space from its scoring explanation without narrowing the player dropdown view", async () => {
    const { engine, regularKeys, deepKey } = position(true);
    engine.tiles.scorings.final[0] = FinalTile.Sector;
    const store = makeStore();
    store.commit("receiveData", engine);
    const map = render(SpaceMap, { store });
    const tile = render(FinalScoringTile, { store, props: { index: 0 } });
    await fireEvent.click(tile.container.querySelector('circle[role="button"]'));
    expect(store.getters.mapModes).to.deep.equal([
      { type: MapModeType.sectors, player: PlayerEnum.Player1, spaceSectorsOnly: true },
    ]);
    expect([...highlightedKeys(map.container, engine)]).to.have.members(regularKeys);
    // Switching back to the ordinary player dropdown restores Deep Space to the visual selection.
    store.commit("toggleMapMode", { type: MapModeType.sectors, player: PlayerEnum.Player1 });
    await Vue.nextTick();
    expect([...highlightedKeys(map.container, engine)]).to.have.members([...regularKeys, deepKey]);
    expect(engine.players[0].progress(FinalTile.Sector)).to.equal(2);
  });
});

// jsdom does not apply compiled SFC styles; assert the shared rule explicitly as well as the
// rendered class/placement contract above. Both UIs import this same SpaceHex stylesheet.
it("keeps sector highlights fill-only and noninteractive without changing federation strokes", () => {
  const source = fs.readFileSync("src/components/SpaceHex.vue", "utf8");
  const sectorStyle = /\.space-hex-sector-highlight\s*\{([^}]+)\}/.exec(source)[1];
  expect(sectorStyle).to.include("stroke: none;");
  expect(sectorStyle).to.include("pointer-events: none;");
  const federationStyle = /\.space-hex-federation\s*\{([^}]+)\}/.exec(source)[1];
  expect(federationStyle).to.include("stroke-width: 0.1;");
});
