<template>
  <span class="old-artifact" v-b-tooltip :title="tooltip">{{ notation }}</span>
</template>
<script lang="ts">
import { ArtifactToken } from "@gaia-project/engine";
import { Component } from "vue-property-decorator";
import CurrentArtifact from "../../../viewer/src/components/ArtifactIcon.vue";
@Component
export default class ArtifactIcon extends CurrentArtifact {
  get notation(): string {
    return {
      [ArtifactToken.KnowledgeOre]: "+k,o",
      [ArtifactToken.Credit]: "3c,3o",
      [ArtifactToken.KnowledgeQic]: "3k,q",
      [ArtifactToken.CreditLarge]: "5c,2o",
      [ArtifactToken.Power]: "+2ta3",
      [ArtifactToken.Asteroid]: "asteroid: 7vp",
      [ArtifactToken.Protoplanet]: "protoplanet: 7vp",
      [ArtifactToken.ResearchLevel]: "sci > 3vp",
      [ArtifactToken.ResearchTracks]: "tracks ≥3 > 3vp",
      [ArtifactToken.Federation]: ">fed",
      [ArtifactToken.GaiaProject]: "gaia > 3vp",
      [ArtifactToken.PlanetTypes]: "3vp,pt > vp",
      [ArtifactToken.DeepSpace]: "ds > 3vp",
    }[this.artifact];
  }
}
</script>
<style scoped>
.old-artifact {
  display: inline-block;
  max-width: 150px;
  border: 1px solid #444;
  padding: 4px;
  background: #fff;
  color: #212529;
  font-size: 11px;
  line-height: 1.3;
}
</style>
