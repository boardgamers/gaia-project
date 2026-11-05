import { describe, expect, it } from "vitest";
import { createTranslator } from "./runtime.js";

const modules = import.meta.glob("./*.json", { eager: true, import: "default" });
const catalogs = Object.fromEntries(Object.entries(modules).map(([path, catalog]) => [path.slice(2, -5), catalog]));

describe("Lost Fleet counter localization", () => {
  for (const locale of Object.keys(catalogs).filter((locale) => locale !== "en")) {
    it(`translates dynamic shuttle counts and sector tooltips in ${locale}`, () => {
      const translator = createTranslator(catalogs, locale);
      for (const remaining of [0, 1, 2, 3]) {
        const source = `Exploration shuttles remaining: ${remaining} of 3`;
        const translated = translator.translate(source);
        expect(translated).not.toBe(source);
        expect(translated).not.toMatch(/\{p\d\}/);
      }
      for (const source of [
        "Deep Space sectors",
        "Space sectors with a colonized planet. Click to highlight colonized Space sectors.",
        "Deep Space sectors with a colonized planet. Click to highlight colonized Deep Space sectors.",
      ]) {
        expect(translator.translate(source)).not.toBe(source);
      }
    });
  }
  it("translates emblem affiliations while retaining ship identities", () => {
    const translator = createTranslator(catalogs, "fr");
    expect(translator.translate("T F Mars — Gaia Federation")).toBe("T F Mars — Alliance Gaia");
  });
});
