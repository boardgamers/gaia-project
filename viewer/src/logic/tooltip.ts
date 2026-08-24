// Real "can this device usefully hover" check (not a screen-size breakpoint) - a touch-only
// phone/tablet never gets a mouseenter before the tap that's supposed to open the tooltip, so a
// .hover-triggered tooltip there only shows on a second tap at best. Matches Commands.vue's own
// supportsHover() check (used for the map's federation-forming hover preview) - same underlying
// question, kept as a single source of truth here. Never returns true outside a browser (SSR/
// tests without matchMedia) - "assume touch" is the safe default.
export function supportsHoverTooltips(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(hover: hover)").matches;
}

// v-b-tooltip's dynamic trigger config: hover on devices that support it (desktop mouse), click
// on touch-only devices (mobile), where hover can't reliably open/close a tooltip at all. Bound
// as the directive's value (not a .hover/.click modifier) so it can react to the actual device
// instead of being fixed at compile time; pair with the .nofade modifier at each call site,
// which is what actually prevents a fade-in/fade-out race when hovering rapidly between two
// adjacent icons (see docs/lost-fleet/PROGRESS.md's tooltip fix history).
export function tooltipTriggerConfig(): { trigger: "hover" | "click" } {
  return { trigger: supportsHoverTooltips() ? "hover" : "click" };
}
