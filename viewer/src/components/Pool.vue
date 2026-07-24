<template>
  <div :class="compact ? undefined : 'container-fluid'">
    <template v-if="$store.state.data.tiles && $store.state.data.tiles.techs['gaia']">
      <!-- Compact (sidebar) mode: boosters all on one row, sized as big as the row's width allows -
           flex divides it evenly by however many are present (`.pool-boosters`, owner request: "as big
           as possible while still being on just 1 row"). Federation tokens sit in a grid sized to
           exactly 2 rows, also as big as that constraint allows - `federationColumns` computes just
           enough columns from the live count so ceil(count / columns) never exceeds 2 (owner request).
           Both leave breathing room for their own drop-shadow filter's bleed (see the CSS below) so
           tokens never spill past the box's border. -->
      <div v-if="compact" class="pool compact mb-1">
        <div class="pool-boosters">
          <Booster v-for="booster in boosters" :key="booster" :booster="booster" />
        </div>
        <div class="pool-federations" :style="{ gridTemplateColumns: `repeat(${federationColumns}, 1fr)` }">
          <FederationTile
            v-for="([tile, numTiles], i) in federations"
            :key="`${tile}-${i}`"
            :federation="tile"
            :numTiles="numTiles"
            filter="url(#shadow-1)"
          />
        </div>
      </div>
      <!-- Non-compact (base game): the original single interleaved flex-wrap row, unchanged - both
           tile types share the same row, wrapping at their native fixed size. -->
      <div v-else class="pool pb-0 mb-1 row no-gutters">
        <Booster v-for="booster in boosters" :key="booster" :booster="booster" class="mb-2 mr-2" />
        <FederationTile
          v-for="([tile, numTiles], i) in federations"
          :key="`${tile}-${i}`"
          :federation="tile"
          :numTiles="numTiles"
          class="mb-2 mr-2"
          filter="url(#shadow-1)"
        />
      </div>
    </template>
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
  // Used by LostFleetShips' sidebar placement (Game.vue): switches to the flex/grid layout below
  // (sized to the sidebar's own narrow width) instead of the base game's fixed-size flex-wrap row.
  @Prop({ default: false, type: Boolean })
  compact: boolean;

  boosters!: string[];
  federations!: [string, number][];

  // The smallest column count that still keeps every federation token within 2 rows - e.g. 5 tokens
  // needs 3 columns (ceil(5/3)=2 rows), not 5 (which would fit 1 row but leave them tiny) or 2 (which
  // would need 3 rows). Floored at 1 so an empty/near-empty pool doesn't divide by 0.
  get federationColumns(): number {
    return Math.max(1, Math.ceil(this.federations.length / 2));
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
    // Both Booster.vue and FederationTile.vue draw their own drop-shadow via the shared `shadow-1`
    // filter, whose region extends 20% beyond the tile's own bounding box on every side (see
    // Filters.vue) - and both SVGs render with `overflow: visible`, so that bleed is NOT clipped to
    // the tile's own box. Sizing tiles to fill their row/grid with zero breathing room would let that
    // shadow spill past `.pool`'s own border (owner request: "don't let fed tokens bleed over the
    // border"). GAP reserves comfortably more than the 20% bleed needs at any tile size these grids
    // realistically produce, on every side (row/grid gap between tiles, plus the container's own
    // GAP-sized padding so the outermost tiles' bleed clears the border too).
    $gap: 6px;
    padding: $gap;

    .pool-boosters {
      display: flex;
      gap: $gap;
      width: 100%;

      // Owner request: "as big as possible while still being on just 1 row" - flex-grow with a 0
      // basis divides the row's width evenly across however many boosters are currently in the pool,
      // instead of a fixed size that would either waste space (few boosters) or wrap (many).
      svg.booster {
        flex: 1 1 0;
        min-width: 0;
        height: auto;
      }
    }

    .pool-federations {
      display: grid;
      gap: $gap;
      margin-top: $gap;
      width: 100%;

      // Owner request: "adjust the size so it's as big as possible but only 2 rows" - each cell (a
      // 1fr grid column, height following width via the SVG's own square viewBox aspect ratio) is as
      // big as `federationColumns` (computed from the live count) allows while keeping every token
      // within 2 rows.
      > svg {
        width: 100%;
        height: auto;
      }
    }
  }
}
</style>
