import { Expansion } from "@gaia-project/engine";
import { describe, expect, it } from "vitest";
import { federationsSourceFactory } from "../logic/charts/federations";
import { lostFleetSourceFactories } from "../logic/charts/lost-fleet";
import { boardActionSourceFactory } from "../logic/charts/resources";
import { baseTechSourceFactory } from "../logic/charts/tech";
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

describe("Lost Fleet statistics labels", () => {
  const sources = [
    ...boardActionSourceFactory(Expansion.LostFleet).sources.filter((s) => s.type.startsWith("spaceshipAction:")),
    ...baseTechSourceFactory(Expansion.LostFleet).sources.filter((s) => s.type.startsWith("ship")),
    ...lostFleetSourceFactories(Expansion.LostFleet).flatMap((f) => f.sources),
  ];
  for (const locale of Object.keys(catalogs)) {
    it(`covers ship identities, action descriptions, acquisitions and dynamic summaries in ${locale}`, () => {
      const catalog = catalogs[locale] as Record<string, string>;
      const translator = createTranslator(catalogs, locale);
      for (const source of sources) {
        for (const text of [source.label, source.description].filter(Boolean)) {
          expect(catalog[text], text).toBeDefined();
          expect(translator.translate(text), text).toBe(catalog[text]);
          expect(translator.translate(text)).not.toMatch(/\{p\d\}/);
        }
        if (source.type.startsWith("spaceshipAction:")) {
          expect(translator.translate(source.label)).toContain(source.label.split(":")[0]);
          expect(translator.translate(source.description)).toContain(source.label.split(":")[0]);
        }
      }
      for (const factory of lostFleetSourceFactories(Expansion.LostFleet)) {
        expect(catalog[factory.name]).toBeDefined();
        expect(catalog[factory.playerSummaryLineChartTitle]).toBeDefined();
      }
      for (const text of [
        "Spaceships and artifacts",
        "Exploration",
        "Spaceship board actions and Twilight artifact costs and rewards",
      ]) {
        expect(catalog[text]).toBeDefined();
      }
      for (const source of federationsSourceFactory(Expansion.LostFleet).sources.filter((s) =>
        s.label.startsWith("Spaceship federation:")
      )) {
        expect(translator.translate(source.label)).not.toMatch(/\{p\d\}/);
        if (locale !== "en") expect(translator.translate(source.label)).not.toContain("Spaceship federation:");
      }
      if (locale !== "en") {
        expect(translator.translate("Spaceships and artifacts income")).not.toContain("Spaceships and artifacts");
        expect(translator.translate("Spaceships and artifacts cost")).not.toContain("Spaceships and artifacts");
      }
    });
  }
});
