import { Planet } from "@gaia-project/engine";
import { expect } from "chai";
import planets from "./planets";

describe("Lost Fleet planet colors", () => {
  it("maps Asteroid to pink and Protoplanet to turquoise", () => {
    expect(planets[Planet.Asteroid].color).to.equal("#ff66b3");
    expect(planets[Planet.Protoplanet].color).to.equal("#30d5c8");
  });
});
