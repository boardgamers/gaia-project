import { expect } from "chai";
import { parseSelfContainedSetup } from "./self-contained";

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
});
