import { ArtifactToken, Condition as ConditionEnum, Planet, ResearchField, Reward } from "@gaia-project/engine";

/** Icon rows for the 13 artifact tokens, composed only of existing Resource/Condition icons. */
const artifactDisplaySpec: {
  [key in ArtifactToken]: {
    rewards: string;
    condition?: ConditionEnum;
    planet?: Planet;
    track?: ResearchField;
    ongoingIncome?: boolean;
    // Minimum research-track level this token scores from (only ResearchTracks: "3 VP for each
    // Research Area at level 3 or higher"). Rendered as a small "3" badge beside the track icon.
    minLevel?: number;
  };
} = {
  // The only one of the 13 artifact tokens that's an ongoing (per income phase) gain rather than
  // an immediate one-time effect (RULES_CLARIFICATIONS.md §G6) - matches the "+" income marker used
  // by the standard tech tiles' own ongoing-income tiles (e.g. Tech6's "+k,c", TechContent.vue).
  [ArtifactToken.KnowledgeOre]: { rewards: "k,o", ongoingIncome: true },
  [ArtifactToken.Credit]: { rewards: "3c,3o" },
  [ArtifactToken.KnowledgeQic]: { rewards: "3k,q" },
  [ArtifactToken.CreditLarge]: { rewards: "5c,2o" },
  // Ongoing (per income phase) like KnowledgeOre above, and "ta3" (not the plain "t" bowl-1 power
  // token) so Resource.vue's bowl-3 badge shows it goes straight into Area 3, same as Xenos's free
  // action.
  [ArtifactToken.Power]: { rewards: "2ta3", ongoingIncome: true },
  [ArtifactToken.Asteroid]: { rewards: "7vp", planet: Planet.Asteroid },
  [ArtifactToken.Protoplanet]: { rewards: "7vp", planet: Planet.Protoplanet },
  // Scales with the Science track specifically (move/artifacts.ts's applyArtifactToken()) - colored
  // with that track's own color so it doesn't look identical to the track-agnostic ResearchTracks token below.
  [ArtifactToken.ResearchLevel]: {
    rewards: "3vp",
    condition: ConditionEnum.AdvanceResearch,
    track: ResearchField.Science,
  },
  [ArtifactToken.ResearchTracks]: { rewards: "3vp", condition: ConditionEnum.AdvanceResearch, minLevel: 3 },
  [ArtifactToken.Federation]: { rewards: "fed" },
  // Mimics ResearchLevel above (advance-a-track icon, colored by that track) instead of the
  // GaiaFormer resource icon - a gaiaformer token doesn't communicate "level up this track" any
  // more clearly than the "gf" piece art itself does, and it also looked identical to actually
  // gaining a gaiaformer resource.
  [ArtifactToken.GaiaProject]: {
    rewards: "3vp",
    condition: ConditionEnum.AdvanceResearch,
    track: ResearchField.GaiaProject,
  },
  // Two reward badges (3 + 1), matching the flat-plus-per-type layout of Eclipse's ship-board "2vp,
  // pt > vp" action (spaceships.ts) for the same "flat VP + 1 VP per planet type" effect - a single
  // "3" reward with the planet-type wheel below read as just "3 VP", not "3 VP + 1 per type".
  [ArtifactToken.PlanetTypes]: { rewards: "3vp,1vp", condition: ConditionEnum.PlanetType },
  [ArtifactToken.DeepSpace]: { rewards: "3vp", condition: ConditionEnum.DeepSpaceSector },
};

export function artifactDisplay(artifact: ArtifactToken): {
  rewards: Reward[];
  condition?: ConditionEnum;
  planet?: Planet;
  track?: ResearchField;
  ongoingIncome?: boolean;
  minLevel?: number;
} {
  const spec = artifactDisplaySpec[artifact];
  return {
    rewards: Reward.parse(spec.rewards),
    condition: spec.condition,
    planet: spec.planet,
    track: spec.track,
    ongoingIncome: spec.ongoingIncome,
    minLevel: spec.minLevel,
  };
}
