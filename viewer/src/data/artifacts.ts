import { ArtifactToken, Condition as ConditionEnum, Planet, Reward, ResearchField } from "@gaia-project/engine";

/** Icon rows for the 13 artifact tokens, composed only of existing Resource/Condition icons. */
const artifactDisplaySpec: {
  [key in ArtifactToken]: { rewards: string; condition?: ConditionEnum; planet?: Planet; track?: ResearchField };
} = {
  [ArtifactToken.KnowledgeOre]: { rewards: "k,o" },
  [ArtifactToken.Credit]: { rewards: "3c,3o" },
  [ArtifactToken.KnowledgeQic]: { rewards: "3k,q" },
  [ArtifactToken.CreditLarge]: { rewards: "5c,2o" },
  [ArtifactToken.Power]: { rewards: "2t" },
  [ArtifactToken.Asteroid]: { rewards: "7vp", planet: Planet.Asteroid },
  [ArtifactToken.Protoplanet]: { rewards: "7vp", planet: Planet.Protoplanet },
  // Scales with the Science track specifically (move/artifacts.ts's applyArtifactToken()) - colored
  // with that track's own color so it doesn't look identical to the track-agnostic ResearchTracks token below.
  [ArtifactToken.ResearchLevel]: { rewards: "3vp", condition: ConditionEnum.AdvanceResearch, track: ResearchField.Science },
  [ArtifactToken.ResearchTracks]: { rewards: "3vp", condition: ConditionEnum.AdvanceResearch },
  [ArtifactToken.Federation]: { rewards: "fed" },
  [ArtifactToken.GaiaProject]: { rewards: "3vp", condition: ConditionEnum.GaiaFormer },
  [ArtifactToken.PlanetTypes]: { rewards: "3vp", condition: ConditionEnum.PlanetType },
  [ArtifactToken.DeepSpace]: { rewards: "3vp", condition: ConditionEnum.DeepSpaceSector },
};

export function artifactDisplay(
  artifact: ArtifactToken
): { rewards: Reward[]; condition?: ConditionEnum; planet?: Planet; track?: ResearchField } {
  const spec = artifactDisplaySpec[artifact];
  return { rewards: Reward.parse(spec.rewards), condition: spec.condition, planet: spec.planet, track: spec.track };
}
