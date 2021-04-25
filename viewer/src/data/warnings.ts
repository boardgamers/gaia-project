import { BuildWarning } from "@gaia-project/engine";

export const buildWarnings: { [key in BuildWarning]: { text: string } } = {
  "step-booster-not-used": { text: "Step booster is not used." },
  "range-booster-not-used": { text: "Range booster is not used." },
  "expensive-terraforming": { text: "Terraforming for more than 1o per step." },
  "step-action-partially-wasted": { text: "Board action could save 2 terraforming steps, but only 1 is used." },
  "gaia-forming-with-charged-tokens": { text: "Gaia forming with tokens that are not in area 1." },
};
