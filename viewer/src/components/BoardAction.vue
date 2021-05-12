<template>
  <svg width="56" height="56" viewBox="-28 -28 56 56" style="overflow: visible">
    <g
      :transform="transform"
      :class="['boardAction', kind, { highlighted, recent }]"
      v-b-tooltip.html
      :title="button.tooltip"
    >
      <SpecialAction
        :class="{ faded }"
        :planet="planet"
        :action="boardActions[action].income"
        :highlighted="highlighted"
        :recent="recent"
        :board="true"
        x="-20"
        y="-25"
        width="40"
        @click="onClick"
      />
      <g transform="translate(-15,-15)">
        <image v-if="kind === 'power'" xlink:href="../assets/resources/power-charge.svg" width="20" :height=133/345*20
        transform=" scale(-1,1) translate(-9, -12)" />
        <rect
          x="-8"
          y="-8"
          width="16"
          height="16"
          :rx="kind === 'power' ? 8 : 0"
          :ry="kind === 'power' ? 8 : 0"
          stroke="black"
          stroke-width="1"
          :fill="kind === 'power' ? '#984FF1' : 'green'"
          transform="scale(0.8)"
          v-if="costNumber > 1"
        />
        <text x="-3" y="3.5" v-if="costNumber > 1" fill="white" style="fill: white !important">
          {{ costNumber }}
        </text>
      </g>
      <g v-if="faded">
        <line y1="-11" y2="11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
        <line y1="11" y2="-11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
      </g>
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  BoardAction as BoardActionEnum,
  boardActions,
  Command,
  Planet,
  PlayerEnum,
} from "@gaia-project/engine";
import Resource from "./Resource.vue";
import SpecialAction from "./SpecialAction.vue";
import { factionPlanet } from "@gaia-project/engine/src/factions";
import { boardActionButton } from "../logic/commands";

@Component<BoardAction>({
  components: {
    Resource,
    SpecialAction,
  },
})
export default class BoardAction extends Vue {
  @Prop()
  action: BoardActionEnum;

  @Prop()
  transform: string

  onClick() {
    if (!this.highlighted) {
      return;
    }
    this.$store.dispatch("gaiaViewer/boardActionClick", this.action);
  }

  get highlighted(): boolean {
    return this.$store.state.gaiaViewer.context.highlighted.boardActions.has(this.action);
  }

  get recent(): boolean {
    const moves = this.$store.getters["gaiaViewer/recentCommands"];
    return moves.some((c) => c.command == Command.Action && c.args[0] as BoardActionEnum === this.action);
  }

  get button() {
    const player = this.$store.state.gaiaViewer.player?.index ?? this.gameData.currentPlayer;
    return boardActionButton(this.action, this.gameData.player(player));
  }

  get faded() {
    return this.player() != null;
  }

  get planet(): Planet {
    const player = this.player();
    if (player != null && player !== PlayerEnum.Player5) {
      // Player5 is for converted old games
      return factionPlanet(this.gameData.player(player).faction);
    }
    return null;
  }

  private player() {
    return this.gameData.boardActions[this.action];
  }

  get kind() {
    return this.action[0] === "p" ? "power" : "qic";
  }

  get gameData(): Engine {
    return this.$store.state.gaiaViewer.data;
  }

  get costNumber() {
    return this.button.conversion.from[0].count;
  }

  boardActions = boardActions;
}
</script>

<style lang="scss">
g {
  &.boardAction {
    & > polygon {
      stroke: #333;
      stroke-width: 0.02;
    }

    &.qic {
      & > polygon {
        fill: var(--res-qic);
      }
    }

    &.power {
      & > polygon {
        fill: var(--res-power);
      }
    }

    & > text {
      fill: white;
      text-anchor: middle;
      dominant-baseline: middle;
      font-size: 12px;
      pointer-events: none;
    }

    &.highlighted > polygon {
      stroke: var(--highlighted);
      cursor: pointer;
      stroke-width: 0.08;
    }
  }

  .faded {
    opacity: 0.8;
  }
}
</style>
