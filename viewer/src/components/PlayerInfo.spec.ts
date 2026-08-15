import Engine, { Event, Operator } from "@gaia-project/engine";
import {
  ArtifactToken,
  Booster,
  Faction,
  Federation,
  Planet,
  Spaceship,
  SpaceshipFederation,
  SpaceshipTechTile,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine/src/enums";
import { boosterEvents } from "@gaia-project/engine/src/tiles/boosters";
import { fireEvent, render } from "@testing-library/vue";
import { expect } from "chai";
import { makeStore } from "../store";
import PlayerInfo from "./PlayerInfo.vue";

describe("PlayerInfo terraforming strip", () => {
  it("keeps the default full-size markers for base factions", () => {
    const engine = new Engine(["init 2 player-info-base", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });

    const stepOneMarkers = container.querySelectorAll('[data-terraforming-step="1"]');
    expect(stepOneMarkers.length).to.equal(2);
    stepOneMarkers.forEach((marker) => {
      expect(marker.getAttribute("data-radius")).to.equal("1");
    });
  });

  it("shows resolved 1-step and 3-step planets for Tinkeroids using compact markers", () => {
    const engine = new Engine(
      ["init 3 player-info-lost-fleet", "p1 faction tinkeroids", "p2 faction bescods", "p3 faction moweyds"],
      { lostFleet: true }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const cost3Planets = engine.players[0].data.lostFleetCost3Planets;

    expect(container.querySelectorAll('[data-terraforming-step="1"]').length).to.equal(4);
    expect(container.querySelectorAll('[data-terraforming-step="3"]').length).to.equal(3);

    cost3Planets.forEach((planet) => {
      expect(container.querySelector(`[data-terraforming-step="3"][data-planet="${planet}"]`)).to.not.equal(null);
      expect(container.querySelector(`[data-terraforming-step="1"][data-planet="${planet}"]`)).to.equal(null);
    });

    container.querySelectorAll('[data-terraforming-step="1"]').forEach((marker) => {
      expect(Number(marker.getAttribute("data-radius"))).to.be.lessThan(1);
    });
  });

  it("renders claimed Lost Fleet ship tech tiles on the player board", () => {
    const engine = new Engine(["init 2 player-info-ship-tech", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });

    engine.players[0].data.tiles.techs.push({
      tile: SpaceshipTechTile.Resource,
      pos: Spaceship.Rebellion,
      enabled: true,
    });

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const shipTech = container.querySelector<SVGElement>("svg.techTile.rebellion");

    expect(shipTech).to.not.equal(null);
    // renders through TechContent's icon system (o + 3k resource icons), not the old text fallback
    expect(shipTech?.querySelector("rect.ore")).to.not.equal(null);
    expect(shipTech?.textContent).to.contain("3");
    expect(shipTech?.textContent).to.not.contain("1o3k");
  });

  it("renders claimed Lost Fleet ship Federation tokens with the base-game token art", () => {
    const engine = new Engine(["init 2 player-info-ship-fed", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });

    engine.players[0].data.spaceshipFederations.push({ tile: SpaceshipFederation.Credit, green: true });

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const shipFed = container.querySelector(`[data-ship-federation="${SpaceshipFederation.Credit}"]`);

    expect(shipFed, "claimed ship Federation token should render in the tiles row").to.not.equal(null);
    expect(shipFed?.querySelector("image")).to.not.equal(null);
  });

  it("renders the Terraform ship Federation token with a free-mine icon and 3 terraform-step arrows, not a plain reward icon", () => {
    const engine = new Engine(["init 2 player-info-ship-fed-terra", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });

    engine.players[0].data.spaceshipFederations.push({ tile: SpaceshipFederation.Terraform, green: true });

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const shipFed = container.querySelector(`[data-ship-federation="${SpaceshipFederation.Terraform}"]`);

    expect(shipFed, "claimed Terraform ship Federation token should render in the tiles row").to.not.equal(null);
    expect(
      shipFed?.querySelector(".building"),
      "expected a mine building icon, matching the free-mine tech tile's icon style"
    ).to.not.equal(null);
    const arrows = Array.from(shipFed?.querySelectorAll("image") ?? []).filter((img) =>
      img.outerHTML.includes("dig-arrow")
    );
    expect(arrows.length, "expected 3 terraform-step arrows").to.equal(3);
  });

  it("shows only the Gaia planet counter for base-game (non-Lost-Fleet) games", () => {
    const engine = new Engine([
      "init 2 player-info-planet-counters-base",
      "p1 faction terrans",
      "p2 faction hadsch-hallas",
    ]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });

    expect(container.querySelector(".planet-fill.g")).to.not.equal(null);
    expect(container.querySelector(".planet-fill.p")).to.equal(null);
    expect(container.querySelector(".planet-fill.a")).to.equal(null);
  });

  it("shows a Gaia/Protoplanet/Asteroid 3-counter column for Lost Fleet games", () => {
    const engine = new Engine(
      ["init 2 player-info-planet-counters-lf", "p1 faction terrans", "p2 faction hadsch-hallas"],
      {
        lostFleet: true,
      }
    );
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });

    const gaia = container.querySelector(".planet-fill.g");
    const proto = container.querySelector(".planet-fill.p");
    const asteroid = container.querySelector(".planet-fill.a");
    expect(gaia, "Gaia counter").to.not.equal(null);
    expect(proto, "Protoplanet counter").to.not.equal(null);
    expect(asteroid, "Asteroid counter").to.not.equal(null);

    // All 3 share one column (same x translate on their parent <g>).
    const xOf = (el: Element) => el.parentElement?.getAttribute("transform")?.match(/translate\(([\d.]+),/)?.[1];
    expect(xOf(gaia!)).to.equal(xOf(proto!));
    expect(xOf(proto!)).to.equal(xOf(asteroid!));
  });

  it("toggles the correct planet type's highlight when a counter is clicked (not the player's home planet)", async () => {
    const engine = new Engine(["init 2 player-info-planet-click", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    const protoHitArea = container.querySelectorAll(".planet-fill.p")[0].parentElement!.querySelectorAll("circle")[1];

    await fireEvent.click(protoHitArea);

    expect(store.state.context.mapModes).to.deep.equal([{ type: "planetType", planet: Planet.Protoplanet }]);
  });

  it("marks a booster's special action with the same used-X as a power action, once activated", () => {
    const engine = new Engine(["init 2 player-info-booster-used", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    const player = engine.players[0];
    player.data.tiles.booster = Booster.Booster4;
    player.loadEvents(boosterEvents(Booster.Booster4));

    const store = makeStore();
    store.commit("receiveData", engine);

    const { container: before } = render(PlayerInfo, { props: { player }, store });
    expect(before.querySelector("svg.booster g.specialAction.disabled"), "not yet used").to.equal(null);

    const activateEvent = player.events[Operator.Activate].find((e) => e.source === Booster.Booster4);
    activateEvent.activated = true;

    const { container: after } = render(PlayerInfo, { props: { player }, store });
    expect(after.querySelector("svg.booster g.specialAction.disabled"), "marked used after activation").to.not.equal(
      null
    );
  });
});

describe("PlayerInfo last-move marks", () => {
  function opponentEngine(moves: string[]) {
    const engine = new Engine(["init 2 player-info-last-move", "p1 faction terrans", "p2 faction hadsch-hallas"], {
      lostFleet: true,
    });
    (engine as any).moveHistory = ["init 2 player-info-last-move", `${Faction.Terrans} build m 1A1`, ...moves];
    (engine as any).advancedLog = [
      { player: 0, move: 1 },
      ...moves.map((_move, i) => ({ player: 1, move: i + 2 })),
      { player: 0 },
    ];
    return engine;
  }

  it("marks the tile a special action came from, since the octagon lives inside the tile art", () => {
    const engine = opponentEngine([]);
    const opponent = engine.players[1];
    opponent.data.tiles.booster = Booster.Booster4;
    opponent.loadEvents(boosterEvents(Booster.Booster4));
    const rewards = opponent.events[Operator.Activate].find((e) => e.source === Booster.Booster4).action().rewards;
    (engine as any).moveHistory.push(`${Faction.HadschHallas} special ${rewards}`);
    (engine as any).advancedLog.splice(1, 0, { player: 1, move: 2 });

    const store = makeStore();
    store.commit("player", { index: 0 });
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: opponent }, store });
    expect(container.querySelector("svg.booster.last-move")).to.not.equal(null);

    const { container: own } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    expect(own.querySelector("svg.booster.last-move"), "the viewer's own board is never marked").to.equal(null);
  });

  it("marks a tech tile, a federation token and a booster claimed since the viewer's last turn", () => {
    const engine = opponentEngine([
      `${Faction.HadschHallas} build lab 1A2. tech ${TechTilePos.Economy}`,
      `${Faction.HadschHallas} federation 1A2,1A3 ${Federation.Fed2}`,
      `${Faction.HadschHallas} pass ${Booster.Booster5}`,
    ]);
    const opponent = engine.players[1];
    opponent.data.tiles.techs.push({ tile: TechTile.Tech1, pos: TechTilePos.Economy, enabled: true });
    opponent.data.tiles.federations.push({ tile: Federation.Fed2, green: true });
    opponent.data.tiles.booster = Booster.Booster5;
    engine.players[0].data.tiles.techs.push({ tile: TechTile.Tech2, pos: TechTilePos.Science, enabled: true });

    const store = makeStore();
    store.commit("player", { index: 0 });
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: opponent }, store });
    expect(container.querySelector(`svg.techTile.${TechTilePos.Economy}.last-move`)).to.not.equal(null);
    expect(container.querySelector("g.federationTile.last-move")).to.not.equal(null);
    expect(container.querySelector("svg.booster.last-move")).to.not.equal(null);

    const { container: own } = render(PlayerInfo, { props: { player: engine.players[0] }, store });
    expect(own.querySelectorAll(".last-move").length, "the viewer's own board is never marked").to.equal(0);
  });

  it("outlines a faction's own special-action octagon", () => {
    const engine = opponentEngine([`${Faction.HadschHallas} special 4pw`]);
    const opponent = engine.players[1];
    // a non-tile Activate event is exactly what `actionsWithoutTile` draws as an octagon
    opponent.loadEvents(Event.parse(["=> 4pw"], Faction.HadschHallas));

    const store = makeStore();
    store.commit("player", { index: 0 });
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: opponent }, store });
    expect(container.querySelector("g.specialAction.recent")).to.not.equal(null);
  });

  it("rings an artifact taken since the viewer's last turn", () => {
    const engine = opponentEngine([`${Faction.HadschHallas} examineArtifact. chooseArtifactToken artifact-power`]);
    const opponent = engine.players[1];
    opponent.data.artifacts = [ArtifactToken.Credit, ArtifactToken.Power];

    const store = makeStore();
    store.commit("player", { index: 0 });
    store.commit("receiveData", engine);

    const { container } = render(PlayerInfo, { props: { player: opponent }, store });

    expect(
      container.querySelector(`[data-artifact="${ArtifactToken.Power}"]`).classList.contains("last-move")
    ).to.equal(true);
    expect(
      container.querySelector(`[data-artifact="${ArtifactToken.Credit}"]`).classList.contains("last-move"),
      "an artifact they already had is not marked"
    ).to.equal(false);
  });
});
