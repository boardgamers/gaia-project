import { ArtifactToken } from "../enums";

// Effect text only - source RULES_CLARIFICATIONS.md §G6. Tokens are seeded face up
// (nbPlayers of the 13 distinct tokens, chosen at random by setup.ts) on Twilight's
// artifact slots, then claimed one at a time via the "Examine Artifact" action.
export const artifactTokenSpec: { [key in ArtifactToken]: string } = {
  [ArtifactToken.KnowledgeOre]: "Ongoing: gain an extra 1 knowledge + 1 ore every income phase.",
  [ArtifactToken.Credit]: "Immediately gain 3 credits + 3 ore.",
  [ArtifactToken.KnowledgeQic]: "Immediately gain 3 knowledge + 1 Q.I.C.",
  [ArtifactToken.CreditLarge]: "Immediately gain 5 credits + 2 ore.",
  [ArtifactToken.Power]: "Ongoing: gain an extra 2 power every income phase, placed directly in Area III.",
  [ArtifactToken.Asteroid]:
    "Immediately and only once gain 7 VP; counts as building a mine and colonizing an Asteroid " +
    "(no sector allocation, no mine physically placed).",
  [ArtifactToken.Protoplanet]:
    "Immediately and only once gain 7 VP; counts as building a mine and colonizing a Protoplanet " +
    "(no sector allocation, no 6 VP protoplanet bonus, no mine physically placed).",
  [ArtifactToken.ResearchLevel]:
    // VERIFY: rules text's owner-comment on which Research Area this token uses was cut off mid-sentence
    // (RULES_CLARIFICATIONS.md §G6); assuming ResearchField.Science as the closest match to "Knowledge-themed".
    "Immediately and only once gain 3 VP per level reached in the matching Research Area.",
  [ArtifactToken.ResearchTracks]: "Immediately and only once gain 3 VP for each Research Area at level 3 or higher.",
  [ArtifactToken.Federation]: "Re-score (re-trigger) a Federation token you already own.",
  [ArtifactToken.GaiaProject]: "Immediately and only once gain 3 VP per step up the Gaiaforming track.",
  [ArtifactToken.PlanetTypes]: "Immediately and only once gain 3 VP + 1 VP per planet type colonized.",
  [ArtifactToken.DeepSpace]: "Immediately and only once gain 3 VP per Deep Space sector colonized.",
};

/**
 * Reward.parse-compatible strings for the tokens whose effect is a plain resource grant.
 * The remaining 7 tokens (Asteroid, Protoplanet, ResearchLevel, ResearchTracks, GaiaProject,
 * PlanetTypes, DeepSpace) need bespoke logic and are handled directly in move/artifacts.ts's
 * applyArtifactToken().
 */
export const artifactTokenRewards: Partial<{ [key in ArtifactToken]: string }> = {
  [ArtifactToken.KnowledgeOre]: "+k,o",
  [ArtifactToken.Credit]: "3c,3o",
  [ArtifactToken.KnowledgeQic]: "3k,q",
  [ArtifactToken.CreditLarge]: "5c,2o",
  // Income (every round), straight into Area 3 - same primitive Xenos's free action uses
  // (actions.ts's OreToPowerTokenArea3, "1ta3"), just as a recurring Income-operator reward
  // instead of a one-time grant.
  [ArtifactToken.Power]: "+2ta3",
  [ArtifactToken.Federation]: ">fed",
};
