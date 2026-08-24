import { SpaceshipTechTile } from "../enums";

// Effect text only, for display. Range's actual effect is wired in player-data.ts's
// effectiveRange(), which checks tiles.techs for this tile's enabled flag directly (a passive,
// continuously-conditional modifier, doesn't fit the declarative Reward/Event grammar). Resource
// IS wired through that grammar (techs.ts's techTileEvents special-cases it to a plain
// Operator.Once "o,3k" reward - it's a flat one-time grant, so it fits fine). Terraform's
// chained Build-a-Mine prompt is triggered from moveChooseTechTile before the follow-up
// tech-track bump.
export const spaceshipTechSpec: { [key in SpaceshipTechTile]: string } = {
  [SpaceshipTechTile.Range]:
    "Your basic range increases by 1 for the rest of the game, as long as the tile is not covered by an Advanced Tech tile.",
  [SpaceshipTechTile.Terraform]:
    "Once: receive a Build a Mine action with up to 2 free terraforming steps and without paying the cost for " +
    "that mine. You may spend additional ore for a 3rd terraforming step, and Q.I.C.s to increase range.",
  [SpaceshipTechTile.Resource]: "Gain 1 ore and 3 knowledge immediately.",
};
