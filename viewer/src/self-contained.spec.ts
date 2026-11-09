import Engine, { AuctionVariant, Phase } from "@gaia-project/engine";
import { expect } from "chai";
import { parseSelfContainedSetup } from "./self-contained";
import { buildStateUrl, loadEngineFromData, parseLoadFromQuery } from "./self-contained-state";
import { LoadFromJsonType } from "./store";

describe("self-contained setup", () => {
  it("reads Lost Fleet from URL query params", () => {
    const setup = parseSelfContainedSetup("?players=2&seed=lf-demo&lostFleet=1");

    expect(setup.players).to.equal(2);
    expect(setup.seed).to.equal("lf-demo");
    expect(setup.options.lostFleet).to.equal(true);
  });

  it("lets explicit falsy values disable build-time flags", () => {
    const setup = parseSelfContainedSetup("?lostFleet=0", {
      VUE_APP_players: "4",
      VUE_APP_lostFleet: "1",
    });

    expect(setup.players).to.equal(4);
    expect(setup.options.lostFleet).to.equal(false);
  });

  it("defaults offline games to Silent Auction with a ban phase and allows an explicit override", () => {
    const offline = parseSelfContainedSetup("?offline=1&players=3&seed=offline-defaults");

    expect(offline.options.auction).to.equal(AuctionVariant.Silent);
    expect(offline.options.banPhase).to.equal(true);
    const engine = new Engine([`init ${offline.players} ${offline.seed}`], offline.options);
    expect(engine.phase).to.equal(Phase.SetupFactionBan);

    const standard = parseSelfContainedSetup("?offline=1&auction=none&banPhase=0");
    expect(standard.options.auction).to.equal(undefined);
    expect(standard.options.banPhase).to.equal(false);

    const ordinaryTestGame = parseSelfContainedSetup("?players=3");
    expect(ordinaryTestGame.options.auction).to.equal(undefined);
    expect(ordinaryTestGame.options.banPhase).to.equal(undefined);
  });

  it("parses an encoded state URL and restores the exact exported game", () => {
    const engine = new Engine(["init 2 lf-share-url"], { lostFleet: true });
    engine.generateAvailableCommandsIfNeeded();

    const url = buildStateUrl("https://example.com/viewer?players=4&lostFleet=0", engine);
    const parsed = parseLoadFromQuery(new URL(url).search);

    expect(parsed).to.not.equal(null);
    expect(parsed.type).to.equal(LoadFromJsonType.load);

    const restored = loadEngineFromData(parsed!);
    expect(JSON.parse(JSON.stringify(restored))).to.deep.equal(JSON.parse(JSON.stringify(engine)));
  });

  it("strictly imports historical charge resumes without allowing new cancellations", () => {
    const history = [
      "init 4 concurrent-charge-test",
      "p1 faction terrans",
      "p2 faction nevlas",
      "p3 faction firaks",
      "p4 faction hadsch-hallas",
      "p1 build m 8A2",
      "p2 build m 8B1",
      "p3 build m 8B3",
      "p4 build m 7B5",
      "p4 build m 1A2",
      "p3 build m 7A4",
      "p2 build m 5A2",
      "p1 build m 4A4",
      "p4 booster booster2",
      "p3 booster booster4",
      "p2 booster booster5",
      "p1 booster booster6",
      "hadsch-hallas income 2t",
      "terrans build ts 8A2.",
      "nevlas decline 1pw @1",
      "nevlas waitForCharges",
      "nevlas resumeCharges",
      "nevlas waitForCharges",
    ];
    const engineData = { moveHistory: history, options: { concurrentCharges: true } };
    const restored = loadEngineFromData({ engineData, type: LoadFromJsonType.strictReplay });
    expect(restored.moveHistory.slice(-3)).to.deep.equal(history.slice(-3));
    expect(restored.replay).not.to.equal(true);
    const before = JSON.stringify(restored);
    expect(() => restored.move("nevlas resumeCharges")).to.throw();
    expect(JSON.stringify(restored)).to.equal(before);

    // This incomplete turn is accepted by permissive replay, but not strict import.
    const invalid = {
      ...engineData,
      moveHistory: [...history, "hadsch-hallas decline 1pw @2", "nevlas up eco", "nevlas ."],
    };
    expect(() => loadEngineFromData({ engineData: invalid, type: LoadFromJsonType.strictReplay })).to.throw();
    expect(() => loadEngineFromData({ engineData: invalid, type: LoadFromJsonType.permissiveReplay })).not.to.throw();
  });

  it("supports stopMove with a shared state URL by replaying to an earlier move", () => {
    const engine = new Engine(["init 2 lf-share-stop", "p1 faction terrans", "p2 faction xenos"], { lostFleet: true });

    const stopMove = engine.moveHistory[2];
    const url = buildStateUrl("https://example.com/viewer", engine, LoadFromJsonType.strictReplay, stopMove);
    const parsed = parseLoadFromQuery(new URL(url).search);

    expect(parsed).to.not.equal(null);
    expect(parsed?.type).to.equal(LoadFromJsonType.strictReplay);
    expect(parsed?.stopMove).to.equal(stopMove);

    const restored = loadEngineFromData(parsed!);
    expect(restored.moveHistory).to.deep.equal(["init 2 lf-share-stop", "p1 faction terrans"]);
  });
});
