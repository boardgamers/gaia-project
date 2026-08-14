import Engine, { TechTile } from "@gaia-project/engine";
import { expect } from "chai";
import { compactMoveSummary, normalizeCachedMoveSummary } from "./move-summary";

describe("compact move summaries", () => {
  it("uses compact Gaia notation for common turns", () => {
    expect(compactMoveSummary("terrans up int.")).to.equal("Terrans: QIC↑");
    expect(compactMoveSummary("terrans build m 8A2.")).to.equal("Terrans: m @ 8A2");
    expect(compactMoveSummary("hadsch-hallas build lab 3A4.")).to.equal("Hadsch Hallas: rl @ 3A4");
    expect(compactMoveSummary("geodens action power4.")).to.equal("Geoden: PA +7c");
    expect(compactMoveSummary("nevlas federation 1A4,9A9,9B4,9C fed4.")).to.equal("Nevlas: fed → 7vp/2o");
    expect(compactMoveSummary("xenos pass booster3.")).to.equal("Xenos: pass → B(1q/2c)");
    expect(compactMoveSummary("terrans explore tfmars. endturn")).to.equal("Terrans: explore TFM");
  });

  it("summarizes setup without exposing sealed bids", () => {
    expect(compactMoveSummary("p1 faction terrans.")).to.equal("P1: pick Terrans");
    expect(compactMoveSummary("p2 banFaction xenos.")).to.equal("P2: ban Xenos");
    expect(compactMoveSummary("itars silentBid itars 10 ivits 0 space-giants 10.")).to.equal("Itars: bids in");
  });

  it("keeps the source and result of compound actions", () => {
    expect(compactMoveSummary("terrans burn 1. action power6. build m 8A2.")).to.equal("Terrans: PA step → m @ 8A2");
    expect(compactMoveSummary("space-giants spaceshipAction eclipse power. up int. endturn")).to.equal(
      "Space Giants: Eclipse PA → QIC↑"
    );
    expect(compactMoveSummary("moweyds spaceshipAction tfmars qic. endturn")).to.equal(
      "Moweyds: TFM QA → 2vp + 1vp/tech"
    );
  });

  it("adds compact tech and research follow-ups", () => {
    const engine = new Engine(["init 2 summary-tech", "p1 faction terrans", "p2 faction geodens"]);
    (engine.tiles.techs as any).terra = { tile: TechTile.Tech1, count: 4 };

    expect(compactMoveSummary("terrans build lab 3A4. tech terra. up sci.", engine)).to.equal(
      "Terrans: rl @ 3A4 · tech 1o/1q · SCI↑"
    );
    expect(compactMoveSummary("terrans action qic1. tech terra. up int.", engine)).to.equal(
      "Terrans: QA tech · tech 1o/1q · QIC↑"
    );
  });

  it("drops leech and payment-only rows", () => {
    expect(compactMoveSummary("xenos charge 2pw. brainstone area3")).to.equal(null);
  });

  it("modernizes legacy cached prose immediately", () => {
    expect(normalizeCachedMoveSummary("Terrans up int.")).to.equal("Terrans: QIC↑");
    expect(normalizeCachedMoveSummary("Terrans build mine sector 8.")).to.equal("Terrans: m @ S8");
    expect(normalizeCachedMoveSummary("Hadsch Hallas build lab.")).to.equal("Hadsch Hallas: rl");
    expect(normalizeCachedMoveSummary("Geoden power action 4.")).to.equal("Geoden: PA +7c");
    expect(normalizeCachedMoveSummary("Itars silentBid itars 10 ivits 0 space-giants 10.")).to.equal("Itars: bids in");
  });
});
