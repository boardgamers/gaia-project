import { Resource as ResourceKind } from "@gaia-project/engine";
import Vue from "vue";
import Resource from "../components/Resource.vue";
import { translateText } from "../localization";
import type { makeStore } from "../store";

const symbols = [
  { kind: ResourceKind.Ore, hint: "Ore · the grey square used for buildings and terraforming" },
  { kind: ResourceKind.Credit, hint: "Credits · yellow circles used to pay for buildings and other actions" },
  { kind: ResourceKind.Knowledge, hint: "Knowledge · blue octagons spent to advance research" },
  { kind: ResourceKind.Qic, hint: "Q.I.C. · green cubes used for extra range and other actions" },
  { kind: ResourceKind.BowlToken, hint: "Power · purple tokens in the three bowls; spend from bowl III" },
  { kind: ResourceKind.VictoryPoint, hint: "Victory points · the green score symbol" },
];

const words: Record<string, ResourceKind> = {
  ore: ResourceKind.Ore,
  ores: ResourceKind.Ore,
  credit: ResourceKind.Credit,
  credits: ResourceKind.Credit,
  knowledge: ResourceKind.Knowledge,
  qic: ResourceKind.Qic,
  qics: ResourceKind.Qic,
  power: ResourceKind.BowlToken,
  "power token": ResourceKind.BowlToken,
  "power tokens": ResourceKind.BowlToken,
  vp: ResourceKind.VictoryPoint,
  "victory point": ResourceKind.VictoryPoint,
  "victory points": ResourceKind.VictoryPoint,
};

export function resourceTextParts(
  text: string,
  translate = (text: string) => text
): { text: string; kind?: ResourceKind }[] {
  const localizedWords = Object.fromEntries(
    Object.entries(words).flatMap(([word, kind]) => [
      [word, kind],
      [translate(word).toLocaleLowerCase(), kind],
    ])
  );
  const terms = Object.keys(localizedWords)
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(
    "(?<![\\p{L}\\p{N}])(?:\\d+(?:[–-]\\d+)?[\\s-]+)?(Q\\.I\\.C\\.|" + terms.join("|") + ")(?![\\p{L}\\p{N}])",
    "giu"
  );
  const parts: { text: string; kind?: ResourceKind }[] = [];
  let end = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > end) parts.push({ text: text.slice(end, match.index) });
    parts.push({ text: match[0], kind: localizedWords[match[1].toLocaleLowerCase().replace(/\./g, "")] });
    end = match.index + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}

/** Use the board's Resource component, keeping the words as readable, accessible labels. */
export function createResourceText(store: ReturnType<typeof makeStore>) {
  const options = {
    store,
    render: (h: Vue["$createElement"]) =>
      h(
        "div",
        symbols.map(({ kind }) =>
          h(
            "svg",
            {
              class: "tutorial-resource-icon",
              attrs: { viewBox: "-12 -12 24 24", width: "24", height: "24", "aria-hidden": "true", focusable: "false" },
            },
            [h(Resource, { props: { kind } })]
          )
        )
      ),
  };
  const app = new Vue(options).$mount();
  const icons = new Map(symbols.map((symbol, index) => [symbol.kind, app.$el.children[index].cloneNode(true)]));
  app.$destroy();

  return (target: HTMLElement) => {
    const doc = target.ownerDocument;
    const fragment = doc.createDocumentFragment();
    const translate = (text: string) => translateText(text, target.ownerDocument.documentElement.lang);
    for (const part of resourceTextParts(translate(target.textContent ?? ""), translate)) {
      if (!part.kind) {
        fragment.append(doc.createTextNode(part.text));
        continue;
      }
      const icon = icons.get(part.kind);
      if (!icon) throw new Error(`Missing tutorial resource icon: ${part.kind}`);
      const label = doc.createElement("span");
      label.className = "tutorial-resource";
      label.dataset.resource = part.kind;
      label.title = symbols.find((symbol) => symbol.kind === part.kind)?.hint ?? "";
      label.append(icon.cloneNode(true), doc.createTextNode(part.text));
      fragment.append(label);
    }
    target.replaceChildren(fragment);
  };
}
