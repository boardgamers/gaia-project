// Does a keystroke belong to a text field the user is typing into?
//
// Several viewer components register their keyboard shortcuts on `window` (MoveButton's per-button
// shortcut letters and its Enter-clicks-the-primary-button rule, AdvancedLog's "h"/"y", Commands'
// Escape-undoes). `window` sees every keystroke in the document, including the ones aimed at a text
// box - so typing in the chat composer used to fire game shortcuts behind it. Owner-reported
// 2026-08-12: typing a letter into the in-game chat opened a faction sheet, exactly as if the tap
// had gone through the on-screen keyboard and the chat popup and landed on a faction button.
//
// The fix belongs in the listeners rather than on each input: `@keydown.stop` on one textarea (which
// is what LostFleetNotes.vue does) shields only that textarea, and the viewer keeps growing new text
// fields - two chat composers, the silent-auction bid boxes, the Preference Split bid boxes, the
// hosted lobby's search and sign-in forms. A global shortcut that fires while the caret is in a text
// field is wrong in every one of those cases.
//
// Deliberately duck-typed instead of `instanceof HTMLElement`: an event can originate in another
// document (an iframe, a portal), and the check has to work in jsdom too.

/** `<input type>` values that are buttons/toggles rather than text entry. Space and Enter are their
 * own activation keys there, and no letter a shortcut cares about ever ends up inside one, so they
 * should NOT shield the global shortcuts. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isContentEditableAttribute(element: Partial<HTMLElement>): boolean {
  const attribute = element.getAttribute?.("contenteditable");
  return attribute === "" || attribute === "true" || attribute === "plaintext-only";
}

/**
 * True when `target` is a field the user types into - a textarea, a select, a text-ish input, or
 * anything contenteditable. Global keyboard shortcuts should return early on it.
 */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  const element = target as (Partial<HTMLElement> & Partial<HTMLInputElement>) | null | undefined;
  if (!element || typeof element.tagName !== "string") {
    return false;
  }
  // `isContentEditable` is the real answer (it inherits down the tree), but jsdom does not implement
  // it, so fall back to the attribute the tests can actually set.
  if (element.isContentEditable || isContentEditableAttribute(element)) {
    return true;
  }
  switch (element.tagName.toUpperCase()) {
    case "TEXTAREA":
    case "SELECT":
      return true;
    case "INPUT":
      // A missing/unknown type is a text input as far as the browser is concerned.
      return !NON_TEXT_INPUT_TYPES.has(String(element.type ?? "text").toLowerCase());
    default:
      return false;
  }
}
