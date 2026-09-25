import catalog8 from "./da.json";
import catalog1 from "./de.json";
import catalog5 from "./el.json";
import catalog0 from "./en.json";
import catalog2 from "./fr.json";
import catalog6 from "./hi.json";
import catalog13 from "./it.json";
import catalog10 from "./ko.json";
import catalog14 from "./nl.json";
import catalog3 from "./pl.json";
import catalog9 from "./pt-BR.json";
import catalog4 from "./ro.json";
import catalog7 from "./ru.json";
import { createTranslator, mountLocalization as mount } from "./runtime.js";
import catalog12 from "./vi.json";
import catalog11 from "./zh-TW.json";
export { languages, resolveLocale } from "./runtime.js";
export const catalogs = {
  en: catalog0,
  de: catalog1,
  fr: catalog2,
  pl: catalog3,
  ro: catalog4,
  el: catalog5,
  hi: catalog6,
  ru: catalog7,
  da: catalog8,
  "pt-BR": catalog9,
  ko: catalog10,
  "zh-TW": catalog11,
  vi: catalog12,
  it: catalog13,
  nl: catalog14,
};
const translators = new Map();
export function translateText(text, locale = "en") {
  if (!translators.has(locale)) {
    translators.set(locale, createTranslator(catalogs, locale));
  }
  return translators.get(locale).translate(text);
}
export function mountLocalization(target, locale) {
  return mount(target, catalogs, locale ?? target.ownerDocument.documentElement.lang ?? "en");
}
export function localizeTutorial(mountTutorial) {
  return async (target, options) => {
    const localization = mountLocalization(target, options.locale);
    try {
      const dispose = await mountTutorial(target, options);
      localization.refresh();
      return () => {
        localization.destroy();
        dispose?.();
      };
    } catch (error) {
      localization.destroy();
      throw error;
    }
  };
}
