import { BuildWarning } from "@gaia-project/engine";

export const buildWarnings: { [key in BuildWarning]: { text: string } } = {
  "step-booster-not-used": { text: "Step booster is not used." },
  "range-booster-not-used": { text: "Range booster is not used." },
  "expensive-terraforming": { text: "Terraforming using more than 1 ore per step." },
  "step-action-partially-wasted": { text: "Board action could save 2 terraforming steps, but only 1 is used." },
  "gaia-forming-with-charged-tokens": { text: "Gaia forming with tokens that are not in area 1." },
  "federation-with-charged-tokens": { text: "Form federation with tokens that are not in area 1." },
  "lantids-deadlock": { text: "Once you have only guest mines, you cannot upgrade to trading stations any more." },
  "lantids-build-without-PI": { text: "Building guest mines with the planetary institute would give 2 knowledge." },
};
