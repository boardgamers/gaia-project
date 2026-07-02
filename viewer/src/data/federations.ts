import { Federation, Reward, SpaceshipFederation } from "@gaia-project/engine";
import { federationRewards } from "@gaia-project/engine/src/tiles/federations";
import { spaceshipFederationRewards } from "@gaia-project/engine/src/tiles/spaceship-federations";

export const federationData: { [key in Federation]: { color: string; shortcut: string } } = {
  [Federation.Fed1]: { color: "--res-vp", shortcut: "v" },
  [Federation.Fed2]: { color: "--res-qic", shortcut: "q" },
  [Federation.Fed3]: { color: "--res-power", shortcut: "t" },
  [Federation.Fed4]: { color: "--res-ore", shortcut: "o" },
  [Federation.Fed5]: { color: "--res-credit", shortcut: "c" },
  [Federation.Fed6]: { color: "--res-knowledge", shortcut: "k" },
  [Federation.Gleens]: { color: "--desert", shortcut: "g" }, // is gained passively when building the PI
};

export type FederationChoice = Federation | SpaceshipFederation;

const spaceshipFederationDescriptions: Record<SpaceshipFederation, string> = {
  [SpaceshipFederation.Credit]: "8vp,8c",
  [SpaceshipFederation.Knowledge]: "4vp,4k",
  [SpaceshipFederation.OreQic]: "4vp,2o,q",
  [SpaceshipFederation.PowerTokens]: "7vp,2t",
  [SpaceshipFederation.Range]: "range mine",
  [SpaceshipFederation.Tech]: "tech",
  [SpaceshipFederation.Terraform]: "terraform mine",
  [SpaceshipFederation.Vp]: "12vp",
};

const spaceshipFederationShortcuts: Record<SpaceshipFederation, string> = {
  [SpaceshipFederation.Credit]: "8c",
  [SpaceshipFederation.Knowledge]: "4k",
  [SpaceshipFederation.OreQic]: "2o1q",
  [SpaceshipFederation.PowerTokens]: "2t",
  [SpaceshipFederation.Range]: "r",
  [SpaceshipFederation.Tech]: "t",
  [SpaceshipFederation.Terraform]: "3d",
  [SpaceshipFederation.Vp]: "12",
};

export function isSpaceshipFederation(federation: FederationChoice): federation is SpaceshipFederation {
  return (Object.values(SpaceshipFederation) as string[]).includes(federation as SpaceshipFederation);
}

export function federationChoiceDescription(federation: FederationChoice): string {
  if (isSpaceshipFederation(federation)) {
    return spaceshipFederationDescriptions[federation];
  }

  return federationRewards(federation).join(",");
}

export function federationChoiceShortcut(federation: FederationChoice): string {
  if (isSpaceshipFederation(federation)) {
    return spaceshipFederationShortcuts[federation];
  }

  return federationData[federation].shortcut;
}

export function federationChoiceRewards(federation: FederationChoice): Reward[] {
  if (isSpaceshipFederation(federation)) {
    return Reward.parse(spaceshipFederationRewards[federation] ?? "");
  }

  return federationRewards(federation);
}

/**
 * Display-only reward icons for rendering a spaceship Federation token with the base game's
 * FederationTile art. Differs from the engine's execution map (`spaceshipFederationRewards`):
 * PowerTokens shows its 2 area-III tokens, and Range/Terraform (bonus Build-a-Mine actions,
 * no direct reward) show a range / 3-step icon; tooltips carry the full effect text.
 */
const displayRewards: Record<SpaceshipFederation, string> = {
  [SpaceshipFederation.Credit]: "8vp,8c",
  [SpaceshipFederation.Knowledge]: "4vp,4k",
  [SpaceshipFederation.OreQic]: "4vp,2o,q",
  [SpaceshipFederation.PowerTokens]: "7vp,2t",
  [SpaceshipFederation.Range]: "range",
  [SpaceshipFederation.Tech]: "tech",
  [SpaceshipFederation.Terraform]: "3step",
  [SpaceshipFederation.Vp]: "12vp",
};

export function spaceshipFederationDisplayRewards(federation: SpaceshipFederation): Reward[] {
  return Reward.parse(displayRewards[federation]);
}
