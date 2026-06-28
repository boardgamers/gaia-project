import { SpaceshipFederation } from "../enums";

// Effect text only - not yet wired to Reward/Event parsing. Execution lands with the
// live "Form a Federation" gameplay chunk. All 8 tokens have a green (Advanced-Tech-or-research)
// reverse side, same as every base-game Federation token except the base game's 12-VP token.
export const spaceshipFederationSpec: { [key in SpaceshipFederation]: string } = {
  [SpaceshipFederation.Credit]: "Immediately gain 8 VP and 8 credits.",
  [SpaceshipFederation.Knowledge]: "Immediately gain 4 VP and 4 knowledge.",
  [SpaceshipFederation.OreQic]: "Immediately gain 4 VP, 2 ore, and 1 Q.I.C.",
  [SpaceshipFederation.PowerTokens]: "Immediately gain 7 VP and 2 power tokens placed directly into Area III.",
  [SpaceshipFederation.Range]:
    "Once: receive a Build a Mine action of limitless range without paying the build cost; ore still pays for " +
    "terraforming, Q.I.C. still required for Gaia planets.",
  [SpaceshipFederation.Tech]: "Once: receive 1 Tech tile of choice (same rules as Upgrade Existing Structures).",
  [SpaceshipFederation.Terraform]:
    "Once: receive a Build a Mine action with up to 3 free terraforming steps without paying the build cost; " +
    "Q.I.C.s may still increase range.",
  [SpaceshipFederation.Vp]: "Immediately gain 12 VP.",
};
