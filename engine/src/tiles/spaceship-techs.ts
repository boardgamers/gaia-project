import { SpaceshipTechTile } from "../enums";

// Effect text only - none of these 3 tiles' effects fit the declarative Reward/Event grammar
// (Range is a passive, continuously-conditional modifier; Terraform/Resource are one-time
// bespoke effects). Range's actual effect IS wired despite that - see player-data.ts's
// effectiveRange(), which checks tiles.techs for this tile's enabled flag directly rather than
// going through Reward parsing. Terraform's chained Build-a-Mine is wired in
// move/research.ts (moveChooseTechTile) via SubPhase.SpaceshipTechTileBuildMine. Resource still
// has no execution wired anywhere.
export const spaceshipTechSpec: { [key in SpaceshipTechTile]: string } = {
  [SpaceshipTechTile.Range]:
    "Your basic range increases by 1 for the rest of the game, as long as the tile is not covered by an Advanced Tech tile.",
  [SpaceshipTechTile.Terraform]:
    "Once: receive a Build a Mine action with up to 2 free terraforming steps and without paying the cost for " +
    "that mine. You may spend additional ore for a 3rd terraforming step, and Q.I.C.s to increase range.",
  [SpaceshipTechTile.Resource]: "Gain 1 ore and 3 knowledge immediately.",
};
