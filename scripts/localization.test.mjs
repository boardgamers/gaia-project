import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source = await readFile(new URL("../viewer/src/localization/runtime.js", import.meta.url), "utf8");
const { createTranslator, languages, resolveLocale } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const catalogs = {
  nl: {
    Draw: "Tekenen",
    "Your cash: $": "Je geld: $",
    Ore: "Erts",
    east: "oost",
    "{p0} · ◈ {p1}": "{p0} · ◈ {p1}",
    Round: "Ronde",
    "Build {p0} for {p1}": "Bouw voor {p1}: {p0}",
    "{p0} buys {p1}": "{p0} koopt {p1}",
    "Make money by trading": "Verdien geld door te handelen",
    "Gain {p0} points{p1}": "Krijg {p0} punten{p1}",
  },
  fr: { Round: "Manche" },
};
test("regional language preferences select supported catalogues", () => {
  assert.equal(resolveLocale("nl-BE"), "nl");
  assert.equal(resolveLocale("pt-PT"), "pt-BR");
  assert.equal(resolveLocale("zh-Hant-TW"), "zh-TW");
  for (const tag of ["zh", "zh-CN", "zh_SG", "zh-Hans", "zh-Hans-CN"]) {
    assert.equal(resolveLocale(tag), "zh-CN");
  }
  for (const tag of ["zh-TW", "zh-Hant-CN", "zh-HK", "zh-MO"]) {
    assert.equal(resolveLocale(tag), "zh-TW");
  }
  assert.equal(resolveLocale(undefined), "en");
});
test("dynamic values are reordered while player names stay unchanged", () => {
  const t = createTranslator(catalogs, "nl");
  t.setNames(["Draw"]);
  assert.equal(t.translate("Draw buys 3"), "Draw koopt 3");
  assert.equal(t.translate("Build 2 for 10"), "Bouw voor 10: 2");
  assert.equal(t.translate("Draw"), "Draw");
  assert.equal(t.translate("Gain 2 points"), "Krijg 2 punten");
});
test("tutorial numbering and whitespace survive translation", () => {
  const t = createTranslator(catalogs, "nl");
  assert.equal(t.translate("  1/5 · Make money by trading\n"), "  1/5 · Verdien geld door te handelen\n");
  assert.equal(t.translate("Round 2"), "Ronde 2");
  assert.equal(t.translate("Unknown sentence"), "Unknown sentence");
});
test("language changes clear caches and preserve the English fallback", () => {
  const t = createTranslator(catalogs, "nl");
  assert.equal(t.translate("Round"), "Ronde");
  t.setLocale("fr");
  assert.equal(t.translate("Round"), "Manche");
  t.setLocale("en");
  assert.equal(t.translate("Round"), "Round");
});

test("icon-separated values and uppercase labels are localized", () => {
  const t = createTranslator(catalogs, "nl");
  assert.equal(t.translate("Ore · ◈ 10"), "Erts · ◈ 10");
  assert.equal(t.translate("EAST"), "OOST");
});

test("decorative arrows and attached currency values keep their meaning", () => {
  const t = createTranslator(catalogs, "nl");
  assert.equal(t.translate("Draw →"), "Tekenen →");
  assert.equal(t.translate("Your cash: $20"), "Je geld: $20");
});

test("Simplified Chinese preserves names and interpolates game messages", async () => {
  const chinese = JSON.parse(await readFile(new URL("../viewer/src/localization/zh-CN.json", import.meta.url), "utf8"));
  const translator = createTranslator({ "zh-CN": chinese }, "zh-Hans");
  translator.setNames(["Build"]);
  assert.equal(translator.translate("Build"), "Build");
  assert.equal(translator.translate("Build wins it with a bid of 12, and pays 8 VP"), "Build以12的出价获胜，并支付8分");
  assert.equal(translator.translate("Your turn - Round 3"), "轮到你了——第3轮");
  assert.equal(translator.translate("Choose your faction"), "选择你的种族");
});

test("untranslated Automa prose stays intact in every language", async () => {
  const sentences = [
    "Automa draws cards to choose its actions.",
    "Automa draws cards to choose its actions. BGS resolves them automatically. Its faction action happens whenever a card calls for it, even several times in a round.",
    "The support card settles choices when several options are valid.",
    "Automa can pass before the pile is empty.",
    "These values come from the current support card. They change when a new card is drawn.",
    "Automa draws cards to choose its actions. It does not use normal resources.",
    "Triggered by decision cards; it can happen more than once per round.",
    "Support card 6 — values for the last Automa turn. Show details",
  ];
  for (const locale of Object.keys(languages)) {
    if (locale === "en") continue;
    const catalog = JSON.parse(
      await readFile(new URL(`../viewer/src/localization/${locale}.json`, import.meta.url), "utf8")
    );
    const translator = createTranslator({ [locale]: catalog }, locale);
    for (const sentence of sentences) {
      assert.equal(translator.translate(sentence), sentence, `${locale}: ${sentence}`);
    }
  }
});

test("grammar-only templates still translate known labels and quantities", () => {
  const translator = createTranslator(
    {
      fr: {
        Ore: "Minerai",
        Round: "Manche",
        "{p0} for {p1}": "{p0} pour {p1}",
        "{p0} of {p1}": "{p0} sur {p1}",
      },
    },
    "fr"
  );
  assert.equal(translator.translate("Ore for 2"), "Minerai pour 2");
  assert.equal(translator.translate("Round 2 of 6"), "Manche 2 sur 6");
  assert.equal(translator.translate("Useful details for the last action"), "Useful details for the last action");
});
