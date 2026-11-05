import Engine from "@gaia-project/engine";
import { mount } from "@vue/test-utils";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeStore } from "../../store";
import Buildings from "./Buildings.vue";

describe("research-lab artwork", () => {
  it("keeps the original art and size without an image viewport that clips its outline", () => {
    const engine = new Engine(["init 2 lab-artwork", "p1 faction hadsch-hallas", "p2 faction terrans"]);
    const store = makeStore();
    store.commit("receiveData", engine);
    const wrapper = mount(Buildings, { store });
    const original = new DOMParser().parseFromString(
      readFileSync(resolve(__dirname, "../../assets/buildings/research-lab.svg"), "utf8"),
      "image/svg+xml"
    );
    const originalPath = original.querySelector("path");
    const originalGradient = original.querySelector("linearGradient");
    const gradient = wrapper.find("#research-lab-shading");
    for (const attribute of ["x1", "y1", "x2", "y2", "gradientUnits"]) {
      expect(gradient.attributes(attribute)).to.equal(originalGradient.getAttribute(attribute));
    }
    expect(gradient.findAll("stop").wrappers.map((stop) => stop.attributes("stop-color"))).to.deep.equal([
      "#F2F2F7",
      "#B6B6B6",
    ]);
    for (const faction of ["hadsch-hallas", "terrans", "gen"]) {
      const lab = wrapper.find(`#lab-${faction}`);
      expect(lab.attributes("filter")).to.equal(`url(#color-${faction})`);
      expect(lab.find("image, svg, clipPath").exists(), "no per-image boundary may trim the stroke").to.equal(false);
      const path = lab.find("path");
      for (const attribute of ["d", "stroke", "stroke-width", "stroke-miterlimit"]) {
        expect(path.attributes(attribute)).to.equal(originalPath.getAttribute(attribute));
      }
      expect(path.attributes("fill")).to.equal("url(#research-lab-shading)");
      expect(path.attributes("transform")).to.equal(`scale(${80 / 522}) translate(-255.5, -261)`);
    }
    wrapper.destroy();
  });
});
