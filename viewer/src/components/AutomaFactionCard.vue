<template>
  <g
    class="automa-faction-card"
    role="img"
    tabindex="0"
    :aria-label="ability"
    v-b-tooltip.nofade="tooltipConfig"
    :title="ability"
  >
    <rect width="116" height="104" rx="4" fill="#ffffff75" stroke="#222" stroke-width=".7" />
    <text x="58" y="15" class="card-label">Faction action</text>
    <g class="card-icons" :transform="`translate(0, ${bonus ? 41 : 54})`" aria-hidden="true">
      <AutomaActionIcon
        v-for="(icon, index) in action"
        :key="index"
        :icon="icon"
        :faction="player.faction"
        :flat="flat"
        :transform="`translate(${58 + (index - (action.length - 1) / 2) * 36}, 0)`"
      />
      <text v-if="['hadsch-hallas', 'firaks'].includes(player.faction)" x="40" y="3" class="card-label card-or"
        >or</text
      >
    </g>
    <g v-if="bonus" class="card-icons" transform="translate(0, 82)" aria-hidden="true">
      <line x1="10" x2="106" y1="-18" y2="-18" stroke="#222" stroke-opacity=".2" />
      <AutomaActionIcon
        :icon="bonus[0]"
        :faction="player.faction"
        :flat="flat"
        transform="translate(26, 0) scale(.8)"
      />
      <use xlink:href="#arrow" x="51" />
      <AutomaActionIcon
        :icon="bonus[1]"
        :faction="player.faction"
        :flat="flat"
        transform="translate(86, 0) scale(.8)"
      />
    </g>
  </g>
</template>

<script lang="ts">
import type { Player } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import type { AutomaIcon } from "../data/automa";
import { automaAbilities } from "../data/automa";
import { tooltipTriggerConfig } from "../logic/tooltip";
import AutomaActionIcon from "./AutomaActionIcon.vue";

@Component({ components: { AutomaActionIcon } })
export default class AutomaFactionCard extends Vue {
  @Prop() player: Player;
  @Prop({ type: Boolean, default: false }) flat: boolean;

  get ability() {
    return automaAbilities[this.player.faction];
  }

  get tooltipConfig() {
    return { trigger: `${tooltipTriggerConfig().trigger} focus` };
  }

  get action(): AutomaIcon[] {
    const mine = (range: number): AutomaIcon => ({ kind: "mine", count: range });
    const vp = (count: number): AutomaIcon => ({ kind: "vp", count });
    const block: AutomaIcon = { kind: "block" };
    const research: AutomaIcon = { kind: "research" };
    const upgrade: AutomaIcon = { kind: "upgrade" };
    const actions: Record<string, AutomaIcon[]> = {
      terrans: [{ kind: "gaia-research" }, mine(4), vp(2)],
      xenos: [mine(2), block, vp(2)],
      taklons: [mine(3), block, vp(2)],
      "hadsch-hallas": [upgrade, mine(3), vp(1)],
      geodens: [research, block, vp(1)],
      firaks: [upgrade, { kind: "down-lab" }, vp(2)],
      itars: [block, block, vp(4)],
    };
    return actions[this.player.faction];
  }

  get bonus(): AutomaIcon[] | null {
    const bonuses: Record<string, AutomaIcon[]> = {
      xenos: [{ kind: "board-action" }, { kind: "block", count: 2 }],
      "hadsch-hallas": [{ kind: "ts" }, { kind: "vp", count: 3 }],
      geodens: [{ kind: "newplanet" }, { kind: "vp", count: 2 }],
      firaks: [{ kind: "lab" }, { kind: "research" }],
    };
    return bonuses[this.player.faction] ?? null;
  }
}
</script>

<style scoped>
.automa-faction-card {
  cursor: help;
  color: #111;
}
.card-label {
  font-size: 8px;
  font-weight: 600;
  fill: #111;
  text-anchor: middle;
  pointer-events: none;
}
.card-or {
  font-size: 7px;
  font-weight: normal;
}
.card-icons {
  pointer-events: none;
}
</style>
