<template>
  <div :class="compact ? undefined : 'container-fluid'">
    <div
      :class="['pool', 'pb-0', 'mb-1', 'row', 'no-gutters', { compact }]"
      v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']"
    >
      <Booster v-for="booster in boosters" :key="booster" :booster="booster" :class="itemSpacing" />
      <FederationTile
        v-for="([tile, numTiles], i) in federations"
        :key="`${tile}-${i}`"
        :federation="tile"
        :numTiles="numTiles"
        :class="itemSpacing"
        filter="url(#shadow-1)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import Booster from "./Booster.vue";
import FederationTile from "./FederationTile.vue";
import { Booster as BoosterEnum, Expansion } from "@gaia-project/engine";

@Component({
  computed: {
    boosters() {
      return BoosterEnum.values(this.$store.state.data.expansions).filter(
        (key) => this.$store.state.data.tiles.boosters[key]
      );
    },
    federations() {
      return Object.entries(this.$store.state.data.tiles.federations).filter(([key, value]) => value > 0);
    },
  },
  components: {
    Booster,
    FederationTile,
  },
})
export default class Pool extends Vue {
  // Used by LostFleetShips' sidebar placement (Game.vue): drops the Bootstrap container-fluid's
  // 15px side gutters (unaffordable in a ~150px-wide sidebar) and tightens the box's own padding a
  // touch, while keeping the exact same border/background styling (`.pool`'s own rules, untouched)
  // so the box still reads as the same component, just narrower.
  @Prop({ default: false, type: Boolean })
  compact: boolean;

  // Halved from the normal mb-2/mr-2 (8px) to mb-1/mr-1 (4px) in compact mode - the sidebar is only
  // wide enough for 2 boosters (60px each) per row with little to spare, and the full 8px gap was
  // enough to push a 2nd item onto its own row on some phone widths.
  get itemSpacing(): string {
    return this.compact ? "mb-1 mr-1" : "mb-2 mr-2";
  }
}
</script>

<style lang="scss" scoped>
.pool {
  margin-bottom: 1em;
  padding-bottom: 0.5em;
  padding-left: 0.5em;
  padding-top: 0.5em;
  border-radius: 5px;

  position: relative;
  border: 2px solid var(--ui-border-strong);
  background-color: var(--ui-surface);

  flex-wrap: wrap;

  &.compact {
    padding-left: 0.35em;
    padding-right: 0.35em;

    // Booster.vue is a fixed 60x120px SVG everywhere else it's used standalone, but on a player's
    // own board (PlayerInfo.vue) it's nested inside that board's own responsive SVG at a fixed
    // proportion of the board's width (measured: booster width is a rock-steady ~8.72% of
    // `.player-board`'s own rendered width across every breakpoint, from mobile up through desktop's
    // two-board-per-row layout) - so it renders far smaller there (~30-35px at typical phone widths)
    // than the pool's own native 60px. Owner-reported: this sidebar's boosters should match that
    // on-a-player-board size. `.player-board` doesn't share a common ancestor width with this sidebar
    // (different Bootstrap columns, no live measurement wired between them), so this targets the same
    // ~30-35px range with a `vw`-scaled width instead of a cross-component sync: 8vw lands at 30px at
    // a 375px phone and 34.4px at 430px, matching the measured player-board size within a pixel or
    // two across that range; the clamp keeps it from over/under-shooting well outside it.
    svg.booster {
      width: clamp(28px, 8vw, 34px);
      height: auto;
    }
  }
}
</style>
