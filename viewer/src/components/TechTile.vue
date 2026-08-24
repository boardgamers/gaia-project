<template>
  <svg
    :class="['techTile', pos, { highlighted, covered, advanced: isAdvanced, 'last-move': lastMove }]"
    v-if="this.count"
    v-b-tooltip.nofade.html="tooltipTriggerConfig()"
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
      <g v-if="isRangeTile" class="range-tile-text" style="pointer-events: none">
        <text class="range-shift" x="0" y="-2" text-anchor="middle">+1</text>
        <text class="range-word" x="0" y="18" text-anchor="middle">range</text>
      </g>
      <g v-else-if="isTerraformMineTile" style="pointer-events: none">
        <Building building="m" outline-white :flat="flat" faction="gen" transform="translate(-11, 0) scale(2.2)" />
        <Resource kind="step" :count="2" transform="translate(8, 0) scale(1.3)" />
      </g>
      <TechContent
        v-else-if="this.event"
        :event="this.event"
        :disabled="specialActionUsed"
        style="pointer-events: none"
      />
    </g>
  </svg>
</template>

<script lang="ts">
import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Event,
  Expansion,
  Operator,
  PlayerEnum,
  Spaceship,
  SpaceshipTechTile,
  TechTile as TechTileEnum,
  TechTilePos,
} from "@gaia-project/engine";
import { spaceshipTechSpec } from "@gaia-project/engine/src/tiles/spaceship-techs";
import { techTileEventSource, techTileEventWithSource } from "@gaia-project/engine/src/tiles/techs";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { ButtonData } from "../data";
import { eventDesc } from "../data/event";
import { spaceshipTechDisplayEvent, techTileData } from "../data/tech-tiles";
import { prependShortcut } from "../logic/buttons/shortcuts";
import { tooltipTriggerConfig } from "../logic/tooltip";
import Building from "./Building.vue";
import Resource from "./Resource.vue";
import TechContent from "./TechContent.vue";

@Component({
  components: {
    TechContent,
    Building,
    Resource,
  },
})
export default class TechTile extends Vue {
  @Prop()
  pos: TechTilePos | AdvTechTilePos | Spaceship;

  @Prop()
  player: PlayerEnum;

  @Prop()
  countOverride?: number;

  @Prop()
  shortcut?: boolean;

  @Prop()
  disableTooltip?: boolean;

  @Prop()
  tileOverride: TechTileEnum | AdvTechTile | SpaceshipTechTile;

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

  /**
   * An opponent claimed this tile since the viewer's last turn. Marked on every copy of it: the pool
   * position on the research board (or a ship's Standard Tech slot), which has no owner and so marks
   * for any taker, and the copy on the taker's own player board, which marks only for them.
   */
  get lastMove(): boolean {
    // An override means this is an inline icon inside a button or a log line (RichTextView), not a
    // tile sitting on a board.
    if (this.commandOverride || this.tileOverride) {
      return false;
    }
    const takers = this.$store.getters.recentOpponentTechTiles?.get(this.pos as string);
    if (!takers) {
      return false;
    }
    return this.player === undefined || takers.has(this.engine.players[this.player]?.faction);
  }

  get tileObject() {
    if (this.isSpaceshipPos(this.pos)) {
      return this.engine.tiles.spaceshipTechs[this.pos];
    }
    return this.engine.tiles.techs[this.pos];
  }

  get tile(): TechTileEnum | AdvTechTile | SpaceshipTechTile | undefined {
    if (this.tileOverride) {
      return this.tileOverride;
    }

    if (this.player !== undefined && this.isSpaceshipPos(this.pos)) {
      return this.engine.players[this.player]?.data.tiles.techs.find((tech) => tech.pos === this.pos)?.tile;
    }

    return this.tileObject?.tile;
  }

  get event(): Event | null {
    if (this.tile == null) {
      return null;
    }

    if (this.isSpaceshipTile(this.tile)) {
      // display-only event - the ship tiles have no engine Event grammar yet
      return spaceshipTechDisplayEvent(this.tile);
    }

    return techTileEventWithSource(this.tile, null)[0];
  }

  // The Range tile reads clearer as plain text than as an icon at this size - owner request.
  get isRangeTile(): boolean {
    return this.tile === SpaceshipTechTile.Range;
  }

  // Needs its own mine icon so it isn't confused with the base game's plain "2 free terraforming
  // steps" board action (Power2) - this tile also waives the mine's build cost, that one doesn't.
  get isTerraformMineTile(): boolean {
    return this.tile === SpaceshipTechTile.Terraform;
  }

  get flat(): boolean {
    return this.$store.state.preferences.flatBuildings;
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
    return typeof this.tile === "string" && this.tile.startsWith("adv");
  }

  /** Mirrors Booster.vue's specialActionUsed: the same X-overlay for a claimed tech tile's own
   * repeatable special action, once it's been used this round. */
  get specialActionUsed(): boolean {
    if (this.player === undefined || this.isSpaceshipPos(this.pos)) {
      return false;
    }
    const source = techTileEventSource(this.pos as TechTilePos | AdvTechTilePos);
    return this.engine.player(this.player).events[Operator.Activate].some((e) => e.source === source && e.activated);
  }

  get engine(): Engine {
    return this.$store.state.data;
  }

  get tooltip() {
    if (this.disableTooltip) {
      return null;
    }

    if (this.tile == null) {
      return null;
    }

    const desc = this.isSpaceshipTile(this.tile)
      ? spaceshipTechSpec[this.tile]
      : eventDesc(this.event, this.engine.expansions);
    const s = techTileData(this.tile).shortcut;
    return this.shortcut && s.length == 1 ? prependShortcut(s, desc) : desc;
  }

  isSpaceshipPos(pos: TechTilePos | AdvTechTilePos | Spaceship): pos is Spaceship {
    return Spaceship.values(Expansion.LostFleet).includes(pos as Spaceship);
  }

  isSpaceshipTile(tile: TechTileEnum | AdvTechTile | SpaceshipTechTile): tile is SpaceshipTechTile {
    return Object.values(SpaceshipTechTile).includes(tile as SpaceshipTechTile);
  }

  tooltipTriggerConfig = tooltipTriggerConfig;
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
      text-anchor: middle;
    }
    .content {
      font-size: 11px;
      pointer-events: none;
      // the (non-advanced) tech tile background is a light gray (#e5e5ea), so keep the
      // label dark for readability both on light pages and under a dark-mode host
      fill: #212529;

      &.smaller {
        font-size: 9px;
      }
    }

    .range-tile-text text {
      fill: black;
      font-weight: bold;
      pointer-events: none;
    }
    .range-tile-text .range-shift {
      font-size: 20px;
    }
    .range-tile-text .range-word {
      font-size: 13px;
    }

    .tech-border {
      fill: var(--tech-tile);
    }

    &.advanced {
      .tech-border {
        fill: var(--adv-tech-tile);
      }
      // advanced tiles are a darker blue (#6888fa), so their labels stay light
      .content {
        fill: white;
      }
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

    // Claimed by an opponent since the viewer's last turn, or (set from the player board) used for
    // their special action, whose octagon lives inside the tile art. The border alone is not enough:
    // the Economy track's own color is gold, so a gold border on it is invisible - the halo outside
    // the tile is what always reads. The halo goes on the <svg>, leaving the border rect's own
    // `url(#shadow-1)` filter attribute alone.
    &.last-move {
      filter: drop-shadow(0 0 2px var(--recent)) drop-shadow(0 0 3px var(--recent));

      .tech-border {
        stroke: var(--recent);
        stroke-width: 3px;
      }
    }

    &.covered {
      opacity: 0.5;
    }
  }
}
</style>
