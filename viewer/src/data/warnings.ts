import { BrainstoneWarning, BuildWarning } from "@gaia-project/engine";
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
  [BuildWarning.stepBoosterNotUsed]: { text: "Step booster is not used." },
  [BuildWarning.rangeBoosterNotUsed]: { text: "Range booster is not used." },
  [BuildWarning.expensiveTerraforming]: { text: "Terraforming using more than 1 ore per step." },
  [BuildWarning.stepActionPartiallyWasted]: {
    text: "Board action could save 2 terraforming steps, but only 1 is used.",
  },
  [BuildWarning.gaiaFormingWithChargedTokens]: { text: "Gaia forming with tokens that are not in area 1." },
  [BuildWarning.federationWithChargedTokens]: { text: "Form federation with tokens that are not in area 1." },
  [BuildWarning.lantidsDeadlock]: {
    text: "Once you have only guest mines, you cannot upgrade to trading stations anymore.",
  },
  [BuildWarning.lantidsBuildWithoutPi]: {
    text: "Building guest mines with the planetary institute would give 2 knowledge.",
  },
  [BuildWarning.geodensBuildWithoutPi]: {
    text: "Building on a new planet type with the planetary institute would give 3 knowledge.",
  },
  [BuildWarning.expensiveTradingStation]: { text: "Trade station for 6c instead of 3c." },
  [BuildWarning.gaiaFormerWouldExtendRange]: { text: "Upgrade a gaia former first to save QICs for range." },
  [BuildWarning.gaiaFormerLastRound]: { text: "The gaia former cannot be upgraded - it's the last round." },
  [BuildWarning.buildingWillBePartOfFederation]: {
    text: "The building will be part of an existing federation - not helping you to form new federations.",
  },
  [BuildWarning.ambasFederationWithoutPi]: {
    text: "From federation with the Ambas PI is not taking advantage of the swap ability of the PI.",
  },
  [BuildWarning.ambasSwapIntoFederation]: {
    text: "This mine is part of an existing federation - it doesn't help you to form a new federation.",
  },
  [BrainstoneWarning.brainstoneChargesWasted]: {
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
