import { expect } from "chai";
import { mount } from "@vue/test-utils";
import SettingsToggle from "./SettingsToggle.vue";

describe("SettingsToggle", () => {
  it("renders the label and reflects the checked prop", () => {
    const wrapper = mount(SettingsToggle, { propsData: { label: "Dark mode", checked: true } });
    expect(wrapper.text()).to.contain("Dark mode");
    expect((wrapper.find("input").element as HTMLInputElement).checked).to.equal(true);
  });

  it("emits change with the new value when toggled", async () => {
    const wrapper = mount(SettingsToggle, { propsData: { label: "Dark mode", checked: false } });
    await wrapper.find("input").setChecked(true);
    expect(wrapper.emitted("change")).to.deep.equal([[true]]);
  });

  it("stops the click from bubbling, so a parent dropdown does not auto-close on toggle", async () => {
    const wrapper = mount(SettingsToggle, {
      propsData: { label: "Dark mode", checked: false },
      attachTo: document.body,
    });
    let bubbled = false;
    document.addEventListener("click", () => {
      bubbled = true;
    });
    await wrapper.find("label").trigger("click");
    expect(bubbled, "the label's own click.stop should keep this from reaching a document-level listener").to.equal(
      false
    );
    wrapper.destroy();
  });
});
