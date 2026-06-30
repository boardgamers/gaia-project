import { expect } from "chai";
import { parseSelfContainedSetup } from "./self-contained";
import { buildStateUrl, loadEngineFromData, parseLoadFromQuery } from "./self-contained-state";
import Engine from "@gaia-project/engine";
import { LoadFromJsonType } from "./store";

describe("self-contained setup", () => {
  it("reads Lost Fleet from URL query params", () => {
    const setup = parseSelfContainedSetup("?players=2&seed=lf-demo&lostFleet=1");

    expect(setup.players).to.equal(2);
    expect(setup.seed).to.equal("lf-demo");
    expect(setup.options.lostFleet).to.equal(true);
    expect(setup.options.frontiers).to.equal(false);
  });

  it("lets explicit falsy values disable build-time flags", () => {
    const setup = parseSelfContainedSetup("?lostFleet=0", {
      VUE_APP_players: "4",
      VUE_APP_lostFleet: "1",
      VUE_APP_frontiers: "0",
    });

    expect(setup.players).to.equal(4);
    expect(setup.options.lostFleet).to.equal(false);
    expect(setup.options.frontiers).to.equal(false);
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

  it("supports stopMove with a shared state URL by replaying to an earlier move", () => {
    const engine = new Engine(
      [
        "init 2 lf-share-stop",
        "p1 faction terrans",
        "p2 faction xenos",
      ],
      { lostFleet: true }
    );

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
