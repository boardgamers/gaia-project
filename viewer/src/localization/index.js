import "./rtl.css";
import { createTranslator, mountLocalization as mount, resolveLocale } from "./runtime.js";
export { languages, resolveLocale } from "./runtime.js";

const catalogUrls = import.meta.glob(["./*.json", "!./en.json"], {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
async function fetchCatalog(locale) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(catalogUrls[`./${locale}.json`], { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Language ${locale}: HTTP ${response.status}`);
    }
    return { default: await response.json() };
  } finally {
    clearTimeout(timeout);
  }
}
export const catalogs = { en: {} };
const pending = new Map();
const translators = new Map();
export function loadLocale(value) {
  const locale = resolveLocale(value);
  if (catalogs[locale]) return Promise.resolve(locale);
  if (!pending.has(locale)) {
    pending.set(
      locale,
      fetchCatalog(locale)
        .then((module) => {
          catalogs[locale] = module.default;
          translators.delete(locale);
          return locale;
        })
        .catch((error) => {
          pending.delete(locale);
          throw error;
        })
    );
  }
  return pending.get(locale);
}
export function translateText(text, locale = "en") {
  if (!translators.has(locale)) {
    translators.set(locale, createTranslator(catalogs, locale));
  }
  return translators.get(locale).translate(text);
}
export function mountLocalization(target, locale) {
  const localization = mount(target, catalogs, "en");
  let revision = 0;
  let ready = Promise.resolve(true);
  function setLocale(value) {
    const attempt = ++revision;
    ready = loadLocale(value)
      .then((loaded) => {
        if (attempt !== revision) return false;
        localization.setLocale(loaded);
        return true;
      })
      .catch((error) => {
        console.warn("Could not load game language", error);
        if (attempt !== revision) return false;
        localization.setLocale("en");
        return true;
      });
    return ready;
  }
  setLocale(locale ?? target.ownerDocument.documentElement.lang ?? "en");
  return {
    ...localization,
    setLocale,
    get locale() {
      return localization.locale;
    },
    get ready() {
      return ready;
    },
    destroy() {
      revision++;
      localization.destroy();
    },
  };
}
export function localizeTutorial(mountTutorial) {
  return async (target, options) => {
    const localization = mountLocalization(target, options.locale);
    try {
      await localization.ready;
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
