import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Vue from "vue";
import { catalogs, loadLocale, mountLocalization, resolveLocale, translateText } from ".";
import { makeStore } from "../store";
import { createResourceText } from "../tutorial/resource-text";
import persianCatalog from "./fa.json";

describe("Persian viewer localization", () => {
  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(persianCatalog)))
    );
    await loadLocale("fa");
  });
  afterAll(() => vi.unstubAllGlobals());
  afterEach(() => document.body.replaceChildren());

  it("resolves regional preferences and preserves display parameters and machine strings", () => {
    for (const locale of ["fa", "fa-IR", "FA_ir", "fa-AF"]) expect(resolveLocale(locale)).toBe("fa");
    expect(translateText("Build Mine for 2", "fa-IR")).toBe("ساخت معدن به‌هزینهٔ 2");
    expect(translateText("Round 6", "fa")).toBe("دور ۶");
    expect(translateText("1/3 · Six rounds to score", "fa")).toBe("1/3 · شش دور برای امتیازگیری");
    for (const source of ["#federation-{p0}-{p1}", "translate({p0}, {p1})", "terrans build m 1x0."]) {
      expect(catalogs.fa[source]).toBe(source);
    }
    expect(translateText("Rules and Factions", "fa")).toBe("قوانین و جناح‌ها");
  });

  it("localizes Vue updates and tooltips reversibly without replacing SVG or player content", async () => {
    const target = document.createElement("div");
    target.dir = "rtl";
    document.body.append(target);
    const app = new Vue({
      data: { round: 1 },
      render(h) {
        return h("section", [
          h("p", { attrs: { title: "Build a Research Lab" } }, `Round ${this.round}`),
          h("span", { attrs: { "data-bgs-player": "" } }, "Mine"),
          h("div", { class: "chat-message-text" }, "Build"),
          h("input", { domProps: { value: "Mine" } }),
          h("svg", [h("g", { attrs: { transform: "translate(2, 3)" } }, [h("text", "Mine")])]),
        ]);
      },
    }).$mount();
    target.append(app.$el);
    const group = target.querySelector("g");
    const localization = mountLocalization(target, "fa-IR");
    await localization.ready;
    expect(target.querySelector("p")?.textContent).toBe("دور ۱");
    expect(target.querySelector("p")?.title).toBe("یک آزمایشگاه پژوهشی بسازید");
    expect(target.querySelector("[data-bgs-player]")?.textContent).toBe("Mine");
    expect(target.querySelector(".chat-message-text")?.textContent).toBe("Build");
    expect(target.querySelector("input")?.value).toBe("Mine");
    expect(target.dir).toBe("ltr");
    expect(target.lang).toBe("fa");
    app.$data.round = 2;
    await Vue.nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(target.querySelector("p")?.textContent).toBe("دور ۲");
    expect(target.querySelector("g")).toBe(group);
    expect(group?.getAttribute("transform")).toBe("translate(2, 3)");
    await localization.setLocale("en");
    expect(target.querySelector("p")?.textContent).toBe("Round 2");
    expect(target.querySelector("p")?.title).toBe("Build a Research Lab");
    localization.destroy();
    expect(target.dir).toBe("rtl");
    expect(target.hasAttribute("data-gaia-locale")).toBe(false);
    app.$destroy();
  });

  it("protects player names in Persian dynamic messages", async () => {
    const target = document.createElement("div");
    target.textContent = "Mine's turn";
    const localization = mountLocalization(target, "fa");
    await localization.ready;
    localization.setNames(["Mine"]);
    expect(target.textContent).toBe("نوبت Mine");
    localization.destroy();
  });

  it("translates complete detached tutorial answers before adding resource icons", () => {
    const store = makeStore();
    store.commit("preferences", { locale: "fa-IR" });
    const button = document.createElement("button");
    button.textContent = "3 ore";
    createResourceText(store)(button);
    expect(button.textContent).toBe("۳ سنگ معدن");
    expect(button.querySelector('[data-resource="o"]')?.textContent).toBe("۳ سنگ معدن");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });
});
