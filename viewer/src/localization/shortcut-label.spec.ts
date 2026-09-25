import { describe, expect, it } from "vitest";
import { translateText } from ".";
import { translateShortcutLabel } from "./shortcut-label";

describe("translated keyboard labels", () => {
  const french = (label: string) => translateText(label, "fr");

  it("translates the whole action before placing its shortcut", () => {
    expect(translateShortcutLabel("Free <u>a</u>ction", french)).toBe("<u>A</u>ction gratuite");
  });

  it("keeps an absent shortcut explicit instead of changing the binding", () => {
    expect(translateShortcutLabel("<u>F</u>ree action", french)).toBe("<u>F</u>: Action gratuite");
    expect(translateShortcutLabel("<u>1</u>: Free action", french)).toBe("<u>1</u>: Action gratuite");
  });

  it("preserves the English shortcut and supports changing language", () => {
    const label = "Free <u>a</u>ction";
    expect(translateShortcutLabel(label, (text) => translateText(text, "en"))).toBe(label);
    expect(translateShortcutLabel(label, french)).toBe("<u>A</u>ction gratuite");
  });

  it("does not interpret translated text as HTML", () => {
    expect(translateShortcutLabel("Free <u>a</u>ction", () => '<a href="x">&')).toBe('&lt;<u>a</u> href="x"&gt;&amp;');
  });
});

describe("context-sensitive game vocabulary", () => {
  it("keeps charge about power and Gaiaformers about units", () => {
    expect(translateText("Undo charge", "pt-BR")).toBe("Desfazer carga de poder");
    expect(translateText("(Other players can charge power)", "de")).toBe("(Andere Spieler dürfen Macht aufladen)");
    expect(translateText("Upgrade Gaia Former to Mine", "pl")).toBe("Zastąp Gaiaformera kopalnią");
    expect(translateText("Move phase", "ko")).toBe("행동 단계");
  });

  it("translates complete log controls without losing their real shortcut", () => {
    const french = (text: string) => translateText(text, "fr");
    expect(translateShortcutLabel("Show ever<u>y</u>thing", french)).toBe("<u>y</u>: Tout afficher");
    expect(translateShortcutLabel("<u>H</u>ide log until next turn", french)).toBe(
      "Masquer le journal jusqu’au proc<u>h</u>ain tour"
    );
  });
});
