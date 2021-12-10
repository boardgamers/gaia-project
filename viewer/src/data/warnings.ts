import { BuildWarning } from "@gaia-project/engine";
import { BrainstoneWarning } from "@gaia-project/engine/src/available-command";
import { ButtonData } from "./index";

export enum WarningKey {
  declineFree = "decline-free",
  resourceWaste = "resource-waste",
  actionNotUsed = "action-not-used",
  itarsNotBurned = "itars-not-burned",
  taklonsNotBurned = "taklons-not-burned",
  taklonsBrainstoneArea3 = "taklons-brainstone-area3",
  cannotBeDisabled = "-",
}

export const moveWarnings: { [key in BuildWarning | BrainstoneWarning]: { text: string } } = {
  "step-booster-not-used": { text: "Step booster is not used." },
  "range-booster-not-used": { text: "Range booster is not used." },
  "expensive-terraforming": { text: "Terraforming using more than 1 ore per step." },
  "step-action-partially-wasted": { text: "Board action could save 2 terraforming steps, but only 1 is used." },
  "gaia-forming-with-charged-tokens": { text: "Gaia forming with tokens that are not in area 1." },
  "federation-with-charged-tokens": { text: "Form federation with tokens that are not in area 1." },
  "lantids-deadlock": { text: "Once you have only guest mines, you cannot upgrade to trading stations any more." },
  "lantids-build-without-PI": { text: "Building guest mines with the planetary institute would give 2 knowledge." },
  "geodens-build-without-PI": {
    text: "Building on a new planet type with the planetary institute would give 3 knowledge.",
  },
  "expensive-trade-station": { text: "Trade station for 6c instead of 3c." },
  "gaia-former-would-extend-range": { text: "Upgrade a gaia former first to save QICs for range." },
  "gaia-former-last-round": { text: "The gaia former cannot be upgraded - it's the last round." },
  "building-will-be-part-of-federation": {
    text: "The building will be part of an existing federation - not helping you to form new federations.",
  },
  "brainstone-charges-wasted": {
    text: "Some of the 3 brainstone charges are wasted. Convert 3 power charges to 3 credit at once.",
  },
};

export function isWarningEnabled(disableKey: string, preferences: any) {
  return preferences[`warning-${disableKey}`] ?? true;
}

export function enabledButtonWarnings(button: ButtonData, preferences: any): string[] {
  if (!button.warning) {
    return [];
  }
  return button.warning.body.filter((w) => isWarningEnabled(w.disableKey, preferences)).map((w) => w.message);
}
