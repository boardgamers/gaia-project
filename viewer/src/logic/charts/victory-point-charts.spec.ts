import Engine, {
  BoardAction,
  Expansion,
  Faction,
  Phase,
  PlayerEnum,
  ResearchField,
  Resource,
} from "@gaia-project/engine";
import { expect } from "chai";
import { extractChanges, getDataPoints } from "./charts";
import { victoryPointDetails, victoryPointSources } from "./victory-point-charts";

describe("victoryPointSources research rewards", () => {
  it("separates Economy income from Gaia level 5 without including end-game research scoring twice", () => {
    const engine = new Engine(["init 2 victory-point-charts-economy"], { lostFleet: true });
    const player = engine.players[0];
    player.faction = Faction.Terrans;
    player.loadFaction(null, Expansion.LostFleet);
    engine.advancedLog = [
      { round: 3 },
      { player: player.player, changes: { [ResearchField.Economy]: { [Resource.VictoryPoint]: 1 } } },
      { round: 4 },
      { player: player.player, changes: { [ResearchField.Economy]: { [Resource.VictoryPoint]: 1 } } },
      { player: player.player, changes: { [ResearchField.GaiaProject]: { [Resource.VictoryPoint]: 11 } } },
      { round: 5 },
      { player: player.player, changes: { [ResearchField.Economy]: { [Resource.VictoryPoint]: 1 } } },
      { player: PlayerEnum.Player2, changes: { [ResearchField.Economy]: { [Resource.VictoryPoint]: 1 } } },
    ];
    const sources = victoryPointSources((tile) => `final${tile}`, Expansion.LostFleet, [player.faction]).filter(
      (source) => source.label === "Gaia" || source.label === "Economy"
    );
    const totals = () =>
      victoryPointDetails(engine, player.player, sources, "last").map((source) => ({
        label: source.label,
        vp: source.getDataPoints()[0],
      }));
    const expected = [
      { label: "Gaia", vp: 11 },
      { label: "Economy", vp: 3 },
    ];
    expect(totals()).to.deep.equal(expected);

    engine.advancedLog.push(
      { phase: Phase.EndGame },
      {
        player: player.player,
        changes: {
          [ResearchField.GaiaProject]: { [Resource.VictoryPoint]: 12 },
          [ResearchField.Economy]: { [Resource.VictoryPoint]: 8 },
        },
      }
    );
    expect(totals()).to.deep.equal(expected);
  });

  it("keeps the Economy income row out of base-game statistics", () => {
    expect(victoryPointSources((tile) => `final${tile}`, Expansion.None, []).map((s) => s.label)).not.to.include(
      "Economy"
    );
  });
});

// Regression for a real reported bug (PROGRESS.md's "solar drift" report): rescoring a Federation
// tile always tags its reward BoardAction.Qic2 (move/federation.ts), regardless of what triggered
// the rescore - including Lost Fleet's Twilight ship-board QIC action and Artifact-token rescores,
// which are the only way to rescore under Lost Fleet since the real Qic2 board action is disabled
// there. The stats panel's "QIC" bucket used to build its `types` list purely from
// BoardAction.values(expansion), which deliberately excludes Qic1-3 under Lost Fleet (they aren't
// legal actions to take there) - but that also silently excluded "qic2" as a possible reward
// *source tag*, so every Lost Fleet rescore's VP vanished from the stats total while the player's
// real (authoritative) victoryPoints correctly kept it.
describe("victoryPointSources QIC bucket", () => {
  it("always includes BoardAction.Qic2, even under Lost Fleet (rescoring a Federation tile always tags it that way)", () => {
    const qicBucket = victoryPointSources((tile) => `final${tile}`, Expansion.LostFleet, []).find(
      (s) => s.label === "QIC"
    );

    expect(qicBucket.types).to.include(BoardAction.Qic2);
  });

  it("counts a Lost-Fleet-triggered Federation rescore's VP under the QIC bucket, matching the player's real victoryPoints", () => {
    const engine = new Engine(["init 2 victory-point-charts-qic2"], { lostFleet: true });
    const player = engine.players[0];
    player.faction = null as any; // avoid touching faction-specific getDataPoints paths this test doesn't need

    // Simulate the rescore's effect directly on advancedLog, the same way move/federation.ts's
    // hardcoded `BoardAction.Qic2` source tag would - deliberately not routed through a real
    // Twilight-QIC move, since this test is about the stats bucket, not the move pipeline.
    engine.advancedLog.push({
      player: PlayerEnum.Player1,
      changes: { [BoardAction.Qic2]: { [Resource.VictoryPoint]: 7 } },
    });
    player.data.victoryPoints += 7;

    const qicBucket = victoryPointSources((tile) => `final${tile}`, Expansion.LostFleet, []).find(
      (s) => s.label === "QIC"
    );
    const extractChange = (_p: PlayerEnum, source: string, resource: string, _round: number, change: number) =>
      resource === Resource.VictoryPoint && qicBucket.types.includes(source as BoardAction) ? change : 0;

    const points = getDataPoints(engine, 0, extractChanges(PlayerEnum.Player1, extractChange), () => 0, null, "last");

    expect(points[0]).to.equal(7);
  });
});
