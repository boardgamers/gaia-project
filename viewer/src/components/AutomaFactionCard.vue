<template>
  <g
    class="automa-faction-card"
    role="img"
    tabindex="0"
    :aria-label="ability"
    v-b-tooltip.nofade="tooltipConfig"
    :title="ability"
  >
    <g :class="['specialAction', { recent: lastWasFaction, disabled: passed }]">
      <polygon points="20,22 42,0 74,0 96,22 96,54 74,76 42,76 20,54" />
      <g class="card-icons" aria-hidden="true">
        <AutomaActionIcon
          v-for="(icon, index) in action"
          :key="index"
          :icon="icon"
          :faction="player.faction"
          :flat="flat"
          :transform="index === 2 ? 'translate(58, 56)' : `translate(${41 + index * 34}, 25) scale(.9)`"
        />
        <path v-if="['hadsch-hallas', 'firaks'].includes(player.faction)" d="M56 30l4-10" fill="none" stroke="#111" />
      </g>
    </g>
    <g v-if="bonus" class="card-icons" transform="translate(0, 99)" aria-hidden="true">
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
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import type { AutomaIcon } from "../data/automa";
import { automaAbilities } from "../data/automa";
import { tooltipTriggerConfig } from "../logic/tooltip";
import AutomaActionIcon from "./AutomaActionIcon.vue";

@Component({ components: { AutomaActionIcon } })
export default class AutomaFactionCard extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  @Prop({ type: Boolean, default: false }) flat: boolean;

  get ability() {
    return `${automaAbilities[this.player.faction]} Triggered by decision cards; it can happen more than once per round.`;
  }

  get passed() {
    return this.engine.ended || (this.engine.passedPlayers ?? []).includes(this.player.player);
  }

  get lastWasFaction() {
    return !this.passed && cards.find((c) => c.id === this.engine.automa?.action)?.action === "faction";
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
.card-icons {
  pointer-events: none;
}
</style>
