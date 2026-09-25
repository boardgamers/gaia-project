export const languages = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  pl: "Polski",
  ro: "Română",
  el: "Ελληνικά",
  hi: "हिन्दी",
  ru: "Русский",
  da: "Dansk",
  "pt-BR": "Português (Brasil)",
  ko: "한국어",
  "zh-TW": "繁體中文",
  vi: "Tiếng Việt",
  it: "Italiano",
  nl: "Nederlands",
};

export function resolveLocale(value) {
  if (typeof value !== "string") {
    return "en";
  }
  const tag = value.toLowerCase().replaceAll("_", "-");
  const exact = Object.keys(languages).find((locale) => locale.toLowerCase() === tag);
  if (exact) {
    return exact;
  }
  if (tag === "pt" || tag.startsWith("pt-")) {
    return "pt-BR";
  }
  if (/^zh-(?:tw|hk|mo|hant)(?:-|$)/.test(tag)) {
    return "zh-TW";
  }
  return Object.keys(languages).find((locale) => locale === tag.split("-")[0]) ?? "en";
}

const normalize = (text) => text.replace(/\s+/g, " ").trim();

export function createTranslator(catalogs, initialLocale = "en") {
  let locale = resolveLocale(initialLocale);
  let names = new Set();
  let patterns = [];
  let upperCase = new Map();
  const cache = new Map();
  function prepare() {
    cache.clear();
    upperCase = new Map(
      Object.entries(catalogs[locale] ?? {})
        .filter(([source]) => !/\{p\d+\}/.test(source))
        .map(([source, value]) => [source.toLocaleUpperCase(), value.toLocaleUpperCase()])
    );
    patterns = Object.keys(catalogs[locale] ?? {})
      .filter((source) => /\{p\d+\}/.test(source) && source.replace(/\{p\d+\}/g, "").trim().length >= 1)
      .sort((a, b) => b.replace(/\{p\d+\}/g, "").length - a.replace(/\{p\d+\}/g, "").length)
      .map((source) => ({ source, pieces: source.split(/(\{p\d+\})/) }))
      .filter(({ pieces }) =>
        pieces.every((piece, i) => i === 0 || i === pieces.length - 1 || i % 2 !== 0 || piece.length > 0)
      );
  }
  function translate(value, depth = 0) {
    if (typeof value !== "string" || locale === "en") {
      return value;
    }
    const text = normalize(value);
    if (!text || names.has(text) || !/[A-Za-zÀ-ž]/.test(text)) {
      return value;
    }
    const catalog = catalogs[locale] ?? {};
    let translated = Object.prototype.hasOwnProperty.call(catalog, text) ? catalog[text] : undefined;
    if (translated === undefined && text === text.toLocaleUpperCase()) {
      translated = upperCase.get(text);
    }
    if (translated === undefined && cache.has(text)) {
      translated = cache.get(text);
    }
    if (translated === undefined && depth < 2 && text.length <= 2500) {
      for (const { source, pieces } of patterns) {
        if (!text.startsWith(pieces[0])) {
          continue;
        }
        let offset = pieces[0].length;
        const parameters = {};
        let matches = true;
        for (let i = 1; i < pieces.length; i += 2) {
          const delimiter = pieces[i + 1];
          const last = i + 2 >= pieces.length;
          const end = last
            ? text.endsWith(delimiter)
              ? text.length - delimiter.length
              : -1
            : text.indexOf(delimiter, offset);
          if (end < 0 || end - offset > 500) {
            matches = false;
            break;
          }
          parameters[pieces[i]] = text.slice(offset, end);
          offset = end + delimiter.length;
        }
        if (!matches || offset !== text.length) {
          continue;
        }
        translated = catalog[source].replace(/\{p\d+\}/g, (key) => translate(parameters[key] ?? key, depth + 1));
        break;
      }
    }
    if (translated === undefined) {
      const prefix = /^(\d+\s*\/\s*\d+\s*·\s*)(.+)$/u.exec(text);
      if (prefix && depth < 2) {
        translated = prefix[1] + translate(prefix[2], depth + 1);
      }
    }
    if (translated === undefined) {
      const match = /^(.*?)(\s*[:.!?—–·→←↑↓↗↙↘↖↻↺✓✗]\s*|\s+\d+(?:\s*\/\s*\d+)?\s*)$/u.exec(text);
      if (match && catalog[match[1]] !== undefined) {
        translated = catalog[match[1]] + match[2];
      }
    }
    if (translated === undefined) {
      const amount = /^(.*?[$€£◈])(\d+(?:[.,]\d+)?)$/.exec(text);
      if (amount && catalog[amount[1]] !== undefined) {
        translated = catalog[amount[1]] + amount[2];
      }
    }
    if (translated === undefined) {
      translated = text;
    }
    if (cache.size > 5000) {
      cache.clear();
    }
    cache.set(text, translated);
    return value.slice(0, value.indexOf(value.trimStart())) + translated + value.slice(value.trimEnd().length);
  }
  prepare();
  return {
    translate,
    get locale() {
      return locale;
    },
    setLocale(value) {
      const next = resolveLocale(value);
      if (next === locale) {
        return false;
      }
      locale = next;
      prepare();
      return true;
    },
    setNames(values) {
      const next = new Set(values.filter((value) => typeof value === "string").map(normalize));
      if (next.size === names.size && [...next].every((name) => names.has(name))) {
        return false;
      }
      names = next;
      cache.clear();
      return true;
    },
  };
}

// Only presentation text is changed. Never translate player input or rewrite game state.
export function mountLocalization(target, catalogs, initialLocale = "en") {
  const translator = createTranslator(catalogs, initialLocale);
  const originals = new WeakMap();
  const attributes = ["title", "aria-label", "placeholder", "alt"];
  const excluded =
    'script,style,code,pre,[contenteditable="true"],[translate="no"],[data-bgs-player],[data-message-id],.chat-message-text,.chat-message-body,.chat-content,.message-text,.chat-author,.chat-segment';
  let destroyed = false;
  function apply(node, attribute) {
    const element = node.nodeType === 3 ? node.parentElement : node;
    if (!element || element.closest?.(excluded)) {
      return;
    }
    const value = attribute ? node.getAttribute(attribute) : node.data;
    if (typeof value !== "string") {
      return;
    }
    let record = originals.get(node);
    if (!record) {
      record = new Map();
      originals.set(node, record);
    }
    const key = attribute ?? "text";
    const previous = record.get(key);
    const source = previous?.output === value ? previous.source : value;
    const output = translator.translate(source);
    record.set(key, { source, output });
    if (value !== output) {
      if (attribute) {
        node.setAttribute(attribute, output);
      } else {
        node.data = output;
      }
    }
  }
  function visit(node) {
    if (destroyed) {
      return;
    }
    if (node.nodeType === 3) {
      apply(node);
      return;
    }
    if (node.nodeType !== 1 && node !== target) {
      return;
    }
    if (node.matches?.(excluded)) {
      return;
    }
    for (const attr of attributes) {
      if (node.hasAttribute?.(attr)) {
        apply(node, attr);
      }
    }
    if (node.matches?.("input,textarea")) {
      return;
    }
    for (const child of node.childNodes ?? []) {
      visit(child);
    }
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        apply(record.target);
      } else if (record.type === "attributes") {
        apply(record.target, record.attributeName);
      } else {
        for (const node of record.addedNodes) {
          visit(node);
        }
      }
    }
  });
  observer.observe(target, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: attributes,
  });
  function refresh() {
    target.lang = translator.locale;
    visit(target);
  }
  refresh();
  return {
    translate: translator.translate,
    get locale() {
      return translator.locale;
    },
    setLocale(locale) {
      if (translator.setLocale(locale)) {
        refresh();
      }
    },
    setNames(names) {
      if (translator.setNames(names)) {
        refresh();
      }
    },
    setState(state) {
      const players = state?.players ?? state?.game?.players;
      if (players && typeof players === "object") {
        if (translator.setNames(Object.values(players).flatMap((player) => [player?.name, player?.username]))) {
          refresh();
        }
      }
    },
    refresh,
    destroy() {
      destroyed = true;
      observer.disconnect();
    },
  };
}
