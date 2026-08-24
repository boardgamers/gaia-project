import Engine, { PlayerEnum, ResearchField, ScoringBoardExtensionSide, TechTilePos } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { expect } from "chai";
import fs from "fs";
import { makeStore } from "../store";
import ResearchBoard from "./ResearchBoard.vue";

describe("ResearchBoard", () => {
  it("puts a gold dot on the token of a track an opponent advanced since the viewer's last turn", () => {
    // A real, fully set-up game: every player has a faction and a token on each track, which is what
    // ResearchTile needs to draw them at all.
    const engine = Engine.fromData(JSON.parse(fs.readFileSync("../engine/fixtures/Beta-2.json").toString()));
    const ownFaction = engine.players[PlayerEnum.Player1].faction;
    const opponentFaction = engine.players[PlayerEnum.Player2].faction;
    (engine as any).moveHistory = [
      `init ${engine.players.length} recent-research`,
      `${ownFaction} up ${ResearchField.Economy}`,
      `${opponentFaction} up ${ResearchField.Navigation}`,
    ];
    (engine as any).advancedLog = [
      { player: PlayerEnum.Player1, move: 1 },
      { player: PlayerEnum.Player2, move: 2 },
      { player: PlayerEnum.Player1 },
    ];

    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });
    const dots = [...container.querySelectorAll("circle.research-tile.last-move")];

    // only the opponent's track, and only their own token on it - not the viewer's own upgrade
    expect(dots.length).to.equal(1);
    const tile = dots[0].closest(`g.${ResearchField.Navigation}`);
    expect(tile).to.not.be.null;

    // ResearchTile lays its tiles out by level (y=278 at level 0, 0 at level 5) and its tokens out by
    // seat (x = 10 + 13 * seat), so both coordinates confirm the dot landed on the right token.
    const levelY = [278, 240, 202, 146, 108, 0];
    const level = engine.players[PlayerEnum.Player2].data.research[ResearchField.Navigation];
    expect(tile.getAttribute("transform")).to.equal(`translate(0, ${levelY[level]})`);
    expect(dots[0].closest("g[transform]").getAttribute("transform")).to.contain("translate(23, ");
  });

  it("marks the pool position a tech tile was taken from, for any taker", () => {
    const engine = new Engine(["init 2 recent-tech-pool", "p1 faction terrans", "p2 faction hadsch-hallas"]);
    (engine as any).moveHistory = [
      "init 2 recent-tech-pool",
      "terrans build m 1A1",
      `hadsch-hallas build lab 1A2. tech ${TechTilePos.Economy}`,
    ];
    (engine as any).advancedLog = [{ player: 0, move: 1 }, { player: 1, move: 2 }, { player: 0 }];

    const store = makeStore();
    store.commit("player", { index: PlayerEnum.Player1 });
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    // the research board's copy has no owner, so it marks whoever took from that stack
    expect(container.querySelector(`svg.techTile.${TechTilePos.Economy}.last-move`)).to.not.equal(null);
    expect(container.querySelectorAll("svg.techTile.last-move").length).to.equal(1);
  });

  it("does not add the 7th (Scoring Board Extension) column for a base game", () => {
    const engine = new Engine(["init 2 base-game-seed"]);
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    expect(container.querySelector(".techTile.adv-ext")).to.equal(null);
    const [, , width] = container.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);
    expect(width).to.equal(ResearchField.values(engine.expansions).length * 60);
  });

  it("adds a 7th column aligned with the adv-tech row, with an icon-based VP gate, for a Lost Fleet game", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.VictoryPoints;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const advExt = container.querySelector(".techTile.adv-ext");
    expect(advExt).to.not.equal(null);
    const gate = container.querySelector('.extension-gate[data-gate-kind="vp"]');
    expect(gate).to.not.equal(null);
    expect(gate?.getAttribute("aria-label")).to.equal("Requires 25 victory points");
    expect(gate?.querySelector("g.resource .vp")).to.not.equal(null);
    expect(gate?.textContent).to.contain("25");
    expect(gate?.textContent).to.not.contain("vp");

    // Aligned with the other 6 adv-tech tiles: same y-translate (79) as ResearchTrack.vue's own
    // `translate(30, 79) scale(0.95)` for its adv-tech tile.
    const advExtGroup = advExt!.closest("g[transform]");
    expect(advExtGroup!.getAttribute("transform")).to.contain("translate(30, 79)");

    // Round scoring tiles render in the same column, "just under" the adv-tech tile.
    const scoringTiles = container.querySelectorAll(".scoringTile");
    expect(scoringTiles.length).to.equal(engine.tiles.scorings.round.length);

    // Each tile is 40 units tall but the track's own level slots are only 38 apart - scaled down
    // to 0.9 (36 tall, matching ResearchTile's own height in the same slots) so consecutive tiles
    // don't overlap.
    for (const tile of Array.from(scoringTiles)) {
      expect(tile.getAttribute("transform")).to.contain("scale(0.9)");
    }
  });

  it("shows a counted spaceship icon when the explored-ships gate is active", () => {
    const engine = new Engine(["init 3 lf-scoring-extension-ships"], { lostFleet: true });
    engine.scoringExtensionSide = ScoringBoardExtensionSide.ExploredShips;
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const gate = container.querySelector('.extension-gate[data-gate-kind="ships"]');
    expect(gate).to.not.equal(null);
    expect(gate?.getAttribute("aria-label")).to.equal("Requires 3 explored spaceships");
    expect(gate?.querySelector(".extension-gate__ship-icon")).to.not.equal(null);
    expect(gate?.querySelector(".extension-gate__count")?.textContent).to.equal("3");
    expect(gate?.textContent).to.not.contain("explorations");
  });

  it("spaces every round scoring tile the same distance apart", () => {
    const engine = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const ys = Array.from(container.querySelectorAll(".scoringTile")).map((tile) => {
      const match = tile.getAttribute("transform")!.match(/translate\(0, (-?\d+(?:\.\d+)?)\)/);
      return Number(match![1]);
    });
    const gaps = new Set(ys.slice(1).map((y, i) => Math.abs(y - ys[i])));
    expect(gaps.size).to.equal(1);
  });

  it("renders final scoring directly below the round scoring tiles, in the same column", () => {
    const engine = new Engine(["init 2 lost-fleet-space-map"], { lostFleet: true });
    const store = makeStore();
    store.commit("receiveData", engine);

    const { container } = render(ResearchBoard, { store });

    const tiles = container.querySelectorAll(".finalScoringTile");
    expect(tiles.length).to.equal(engine.tiles.scorings.final.length);

    const scoringTiles = container.querySelectorAll(".scoringTile");
    const lastRoundTileY = Math.max(
      ...Array.from(scoringTiles).map((tile) =>
        Number(tile.getAttribute("transform")!.match(/translate\(0, (-?\d+)\)/)![1])
      )
    );
    const finalGroup = tiles[0].closest("g[transform]")!;
    const finalY = Number(finalGroup.getAttribute("transform")!.match(/translate\(0, (-?\d+)\)/)![1]);
    expect(finalY).to.be.greaterThan(lastRoundTileY);
  });

  it("widens the viewBox by the extra column's width for Lost Fleet games", () => {
    const withoutExt = new Engine(["init 2 base-game-seed"]);
    const storeWithout = makeStore();
    storeWithout.commit("receiveData", withoutExt);
    const { container: containerWithout } = render(ResearchBoard, { store: storeWithout });
    const [, , widthWithout] = containerWithout.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);

    const withExt = new Engine(["init 2 lf-scoring-extension"], { lostFleet: true });
    const storeWith = makeStore();
    storeWith.commit("receiveData", withExt);
    const { container: containerWith } = render(ResearchBoard, { store: storeWith });
    const [, , widthWith] = containerWith.querySelector("svg").getAttribute("viewBox").split(" ").map(Number);

    expect(widthWith).to.equal(widthWithout + 70);
  });
});
