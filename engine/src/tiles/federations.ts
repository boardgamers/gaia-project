import { Federation } from "../enums";
import Reward from "../reward";

const federationSpec: { [key in Federation]: string } = {
  [Federation.Fed1]: "12vp",
  [Federation.Fed2]: "8vp,q",
  [Federation.Fed3]: "8vp,2t",
  [Federation.Fed4]: "7vp,2o",
  [Federation.Fed5]: "7vp,6c",
  [Federation.Fed6]: "6vp,2k",
  [Federation.Gleens]: "o,k,2c",
};

export function federationRewards(federation: Federation): Reward[] {
  return Reward.parse(federationSpec[federation]);
}

export function isGreen(federation: Federation) {
  return federation !== Federation.Fed1;
}
