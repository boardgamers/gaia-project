import { ArtifactToken } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import ArtifactIcon from "./ArtifactIcon.vue";

Vue.use(BootstrapVue);

describe("ArtifactIcon", () => {
  it("shows the ongoing-income '+' marker for the Power artifact (2 power into Area 3 every income phase)", () => {
    const { container } = render(ArtifactIcon, { props: { artifact: ArtifactToken.Power } });

    expect(container.querySelector(".lost-fleet-ship__artifact-plus")).to.not.equal(null);
    // "ta3" (not a plain bowl-1 power token) so Resource.vue's bowl-3 badge renders, showing this
    // specific artifact goes straight into Area 3 rather than the default bowl.
    expect(container.querySelector(".token-area-badge")).to.not.equal(null);
  });

  it("shows the ongoing-income '+' marker for the KnowledgeOre artifact too", () => {
    const { container } = render(ArtifactIcon, { props: { artifact: ArtifactToken.KnowledgeOre } });

    expect(container.querySelector(".lost-fleet-ship__artifact-plus")).to.not.equal(null);
  });

  it("does not show the ongoing-income marker for a one-time artifact like Credit", () => {
    const { container } = render(ArtifactIcon, { props: { artifact: ArtifactToken.Credit } });

    expect(container.querySelector(".lost-fleet-ship__artifact-plus")).to.equal(null);
    expect(container.querySelector(".token-area-badge")).to.equal(null);
  });
});
