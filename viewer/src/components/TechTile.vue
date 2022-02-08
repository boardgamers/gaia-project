<template>
  <svg
    :class="['techTile', pos, { highlighted, covered, advanced: isAdvanced }]"
    v-if="this.count"
    v-b-tooltip.html
    :title="tooltip"
    @click="onClick"
    width="60"
    height="60"
    viewBox="-32 -32 64 64"
  >
    <g :transform="`scale(${isAdvanced ? 0.9 : 1})`">
      <rect
        x="-30"
        y="-30"
        width="60"
        height="60"
        rx="3"
        ry="3"
        stroke="black"
        stroke-width="1"
        class="tech-border"
        filter="url(#shadow-1)"
      />
      <!--<text class="title" x="-25" y="-18">{{title}}</text>-->
      <TechContent :event="this.event" style="pointer-events: none" />
    </g>
  </svg>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Event,
  PlayerEnum,
  TechTile as TechTileEnum,
  TechTilePos,
} from "@gaia-project/engine";
import { eventDesc } from "../data/event";
import TechContent from "./TechContent.vue";
import { ButtonData } from "../data";
import { prependShortcut } from "../logic/buttons/shortcuts";
import { techTileData } from "../data/tech-tiles";
import { techTileEventWithSource } from "@gaia-project/engine/src/tiles/techs";

@Component({
  components: {
    TechContent,
  },
})
export default class TechTile extends Vue {
  @Prop()
  pos: TechTilePos | AdvTechTilePos;

  @Prop()
  player: PlayerEnum;

  @Prop()
  countOverride?: number;

  @Prop()
  shortcut?: boolean;

  @Prop()
  disableTooltip?: boolean;

  @Prop()
  tileOverride: TechTileEnum | AdvTechTile;

  @Prop()
  commandOverride: string;

  @Prop()
  covered: boolean;

  onClick() {
    if (this.commandOverride) {
      this.$store.dispatch("techClick", { command: this.commandOverride } as ButtonData);
    } else if (this.highlighted) {
      this.$store.dispatch("techClick", { command: this.pos } as ButtonData);
    }
  }

  get highlighted() {
    return this.$store.state.context.highlighted.techs.has(this.pos) || this.commandOverride;
  }

  get tileObject() {
    return this.engine.tiles.techs[this.pos];
  }

  get tile(): TechTileEnum | AdvTechTile {
    return this.tileOverride ?? this.tileObject.tile;
  }

  get event(): Event {
    return techTileEventWithSource(this.tile, null)[0];
  }

  get count() {
    if (this.countOverride !== undefined) {
      return this.countOverride;
    }
    if (this.player !== undefined) {
      return 1;
    }
    return this.tileObject?.count;
  }

  get isAdvanced() {
    return this.tile.startsWith("adv");
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get tooltip() {
    if (this.disableTooltip) {
      return null;
    }
    const desc = eventDesc(this.event, this.engine.expansions);
    const s = techTileData(this.tile).shortcut;
    return this.shortcut && s.length == 1 ? prependShortcut(s, desc) : desc;
  }
}
</script>

<style lang="scss">
svg {
  &.techTile {
    overflow: visible;
    .title {
      font-size: 10px;
      font-weight: bold;
      pointer-events: none;
      fill: white;
    }
    .content {
      font-size: 11px;
      pointer-events: none;
      fill: white;

      &.smaller {
        font-size: 9px;
      }
    }

    .tech-border {
      fill: var(--tech-tile);
    }

    &.advanced .tech-border {
      fill: var(--adv-tech-tile);
    }

    &.eco .tech-border {
      fill: var(--rt-eco);
    }
    &.sci .tech-border {
      fill: var(--rt-sci);
    }
    &.dip .tech-border {
      fill: var(--rt-dip);
    }
    &.terra .tech-border {
      fill: var(--rt-terra);
    }
    &.nav .tech-border {
      fill: var(--rt-nav);
    }
    &.gaia .tech-border {
      fill: var(--rt-gaia);
    }
    &.int .tech-border {
      fill: var(--rt-int);
    }

    &.highlighted .tech-border {
      stroke: var(--highlighted);
      cursor: pointer;
      stroke-width: 2px;
    }

    &.covered {
      opacity: 0.5;
    }
  }
}
</style>
