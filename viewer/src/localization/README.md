# Viewer translations

The viewer follows BGS's shared `preferences.locale` value. Tutorials receive `options.locale`. Supported locales match BGS: English, German, French, Polish, Romanian, Greek, Hindi, Russian, Danish, Brazilian Portuguese, Korean, Traditional Chinese, Vietnamese, Italian, Dutch and Persian (`fa`, including regional tags such as `fa-IR`).

`en.json` contains source UI text, including tutorial explanations and engine-generated descriptions rendered by the viewer. The other catalogues use the same keys. `{p0}`, `{p1}`, etc. represent dynamic display values: translators may reorder them but must preserve every placeholder. Add or update the corresponding entries in all catalogues when changing source wording. Component names and terminology need game-specific review; translations were initially machine-assisted.

The rendering adapter translates text and accessible labels, including tooltips, without changing state, action identifiers, input values or HTML structure. It remembers source text so a language change is reversible, observes subsequent framework updates, and disconnects on viewer destruction. Player names and chat messages are excluded. `translate="no"` also excludes any element and its descendants. Keep user-provided content inside excluded elements.

For rich text that is split into icons and spans, call `translateText` on the complete sentence before splitting it; localize the tokenizer's resource labels too. This preserves sentence grammar. Avoid relying on rendered labels to identify an action—use action IDs or data attributes.

Run `node scripts/check-locales.mjs viewer/src/localization` to verify catalogue coverage and placeholders. The viewer's normal build and browser tests should also cover language switching, action controls, translated tutorial progression and narrow layouts. Browser text must remain readable if a translation is missing; English is the fallback.

The Persian catalogue was authored directly, without a translation service. It covers viewer controls, faction rules, auction explanations and the tutorial lessons. The source extraction also includes internal developer diagnostics, CSS selectors, SVG transforms and replay commands; these retain their original spelling where they are not player-facing prose. New presentation labels absent from the original catalogues have English fallback entries in the older locales. Resource abbreviations and replay/state identifiers remain unchanged.

Persian reading surfaces use scoped RTL styles. The viewer mount remains LTR so the map, research tracks, SVG coordinates and board geometry keep their meaning. Localization never replaces Vue elements or wraps their text nodes. Tutorial resource decoration translates a complete sentence using the tutorial store's locale before inserting icons; this also works for detached answer buttons and Persian digits.

After building the viewer, run `node viewer/scripts/persian-smoke.mjs` from the repository root to check all 19 chapter openings at mobile width, RTL prose versus LTR boards, and localized progression at desktop and mobile widths. The tutorial preview accepts `?locale=fa-IR`.
