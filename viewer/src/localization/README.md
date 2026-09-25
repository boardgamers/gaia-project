# Viewer translations

The viewer follows BGS's shared `preferences.locale` value. Tutorials receive `options.locale`. Supported locales match BGS: English, German, French, Polish, Romanian, Greek, Hindi, Russian, Danish, Brazilian Portuguese, Korean, Traditional Chinese, Vietnamese, Italian and Dutch.

`en.json` contains source UI text, including tutorial explanations and engine-generated descriptions rendered by the viewer. The other catalogues use the same keys. `{p0}`, `{p1}`, etc. represent dynamic display values: translators may reorder them but must preserve every placeholder. Add or update the corresponding entries in all catalogues when changing source wording. Component names and terminology need game-specific review; translations were initially machine-assisted.

The rendering adapter translates text and accessible labels, including tooltips, without changing state, action identifiers, input values or HTML structure. It remembers source text so a language change is reversible, observes subsequent framework updates, and disconnects on viewer destruction. Player names and chat messages are excluded. `translate="no"` also excludes any element and its descendants. Keep user-provided content inside excluded elements.

For rich text that is split into icons and spans, call `translateText` on the complete sentence before splitting it; localize the tokenizer's resource labels too. This preserves sentence grammar. Avoid relying on rendered labels to identify an action—use action IDs or data attributes.

Run `node scripts/check-locales.mjs viewer/src/localization` to verify catalogue coverage and placeholders. The viewer's normal build and browser tests should also cover language switching, action controls, translated tutorial progression and narrow layouts. Browser text must remain readable if a translation is missing; English is the fallback.
