import Engine, { Spaceship } from "@gaia-project/engine";
import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import AlternateShips from "../../../old-ui/src/components/LostFleetShips.vue";
import LostFleetShips from "../components/LostFleetShips.vue";
import SpaceshipEmblem from "../components/SpaceshipEmblem.vue";
import { spaceshipLabels, spaceshipNames } from "../data/spaceships";
import { makeStore } from "../store";
import { mountLocalization } from "./runtime.js";

const modules = import.meta.glob<Record<string, string>>("./*.json", { eager: true, import: "default" });
const catalogs = Object.fromEntries(Object.entries(modules).map(([path, catalog]) => [path.slice(2, -5), catalog]));

describe("canonical spaceship names in localized rendering", () => {
  for (const [ui, component, selector] of [
    ["primary", LostFleetShips, ".lost-fleet-ship__name-rest"],
    ["alternate", AlternateShips, "header strong"],
  ] as const) {
    it(`preserves all four ${ui} board headers through every locale and back to English`, () => {
      const store = makeStore();
      store.commit("receiveData", new Engine(["init 4 localized-ships"], { lostFleet: true }));
      const { container, unmount } = render(component, { store });
      const localization = mountLocalization(container, catalogs);
      try {
        for (const locale of [...Object.keys(catalogs), "en"]) {
          localization.setLocale(locale);
          expect(Array.from(container.querySelectorAll(selector), (node) => node.textContent).sort()).toEqual(
            Object.values(spaceshipNames)
              .map((name) => name.toUpperCase())
              .sort()
          );
        }
      } finally {
        localization.destroy();
        unmount();
      }
    });
  }

  it("preserves names in SVG titles and accessible labels without freezing translated affiliations", () => {
    for (const ship of [Spaceship.Twilight, Spaceship.Eclipse, Spaceship.Rebellion, Spaceship.TFMars]) {
      const { container, unmount } = render(SpaceshipEmblem, { props: { ship } });
      const localization = mountLocalization(container, catalogs);
      const label = `${spaceshipNames[ship]} — ${spaceshipLabels[ship]}`;
      try {
        for (const locale of [...Object.keys(catalogs), "en"]) {
          localization.setLocale(locale);
          const expected = catalogs[locale][label];
          expect(expected).toContain(spaceshipNames[ship]);
          expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(expected);
          expect(container.querySelector("title")?.textContent).toBe(expected);
        }
      } finally {
        localization.destroy();
        unmount();
      }
    }
  });
});
