import { SpaceshipTechTile } from "../enums";

// Effect text only - not yet wired to Reward/Event parsing. Execution lands with the
// live "Explore"/"Upgrade Existing Structures" gameplay chunk.
export const spaceshipTechSpec: { [key in SpaceshipTechTile]: string } = {
  [SpaceshipTechTile.Range]:
    "Your basic range increases by 1 for the rest of the game, as long as the tile is not covered by an Advanced Tech tile.",
  [SpaceshipTechTile.Terraform]:
    "Once: receive a Build a Mine action with up to 2 free terraforming steps and without paying the cost for " +
    "that mine. You may spend additional ore for a 3rd terraforming step, and Q.I.C.s to increase range.",
  [SpaceshipTechTile.Resource]: "Gain 1 ore and 3 knowledge immediately.",
};
