<template>
  <g :class="{ resource: true, 'no-tooltip': !tooltip }" v-b-tooltip.hover :title="tooltip">
    <template v-if="kind === 'q'">
      <Qic v-if="!flat" class="qic" :transform="`translate(-0.5,0)`" />
      <rect v-else class="qic" width="14" height="14" x="-7" y="-7" />
    </template>
    <!-- <rect v-if="kind=='q'" class="qic" width="14" height="14" x="-7" y="-7" /> -->
    <rect v-else-if="kind === 'o'" class="ore" width="14" height="14" x="-7" y="-7" />
    <rect v-else-if="kind === 'c'" class="credit" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect v-else-if="kind === 'tradeBonus'" class="trade-bonus" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect
      v-else-if="kind === 'tradeDiscount'"
      class="trade-discount"
      width="16"
      height="16"
      ry="8"
      rx="8"
      x="-8"
      y="-8"
    />
    <rect v-else-if="kind === 'tradeShip'" class="trade-ship" width="16" height="16" ry="8" rx="8" x="-8" y="-8" />
    <rect
      v-else-if="['tg', 't->tg', 'tg->t'].includes(kind)"
      class="gaia"
      width="16"
      height="16"
      ry="8"
      rx="8"
      x="-8"
      y="-8"
    />
    <rect
      v-else-if="['pw', 'pay-pw', 't', 'ta3', 'bowl-t', 'burn-token', 'brainstone'].includes(kind)"
      class="power"
      width="15"
      height="15"
      ry="7.5"
      rx="7.5"
      x="-7.5"
      y="-7.5"
    />
    <!-- Xenos's free action (1 ore -> 1 power token in bowl 3) otherwise renders identically to the
         base game's bowl-1 version - this badge is the only visual difference between them. -->
    <g v-if="kind === 'ta3'" class="token-area-badge">
      <circle cx="5.5" cy="-5.5" r="3.2" />
      <text x="5.5" y="-4.3">3</text>
    </g>
    <g v-else-if="kind === 'power-ring'" class="power-ring">
      <circle r="7" />
      <circle r="3.5" />
    </g>
    <polygon
      points="-7.5,3 -3,7.5 3,7.5 7.5,3 7.5,-3 3,-7.5 -3,-7.5 -7.5,-3"
      v-else-if="kind == 'k'"
      class="knowledge"
    />
    <g v-else-if="kind == 'vp'" transform="translate(-7.5,-7.5)" class="vp">
      <VictoryPoint width="15" height="15" />
    </g>
    <Building
      v-else-if="kind == 'gf' || kind == 'gf->t'"
      building="gf"
      transform="translate(0.5, 0) scale(2.5)"
      :flat="flat"
      :faction="faction"
    />
    <template v-else-if="kind == 'instant-gaiaforming'">
      <Building building="gf" transform="translate(-8, 0) scale(1.5)" :flat="flat" :faction="faction" />
      <line x1="-3" y1="0" x2="5" y2="0" stroke="black" stroke-width="1.2" />
      <polygon points="5,0 1,-3 1,3" fill="black" />
      <circle class="gaia" cx="9" cy="0" r="5.5" stroke="#111" stroke-width="0.9" />
    </template>
    <g v-else-if="kind == 'swap-PI'" transform="scale(-1,1)">
      <Building faction="ambas" building="m" transform="translate(-8.5, 0) scale(1.5)" :flat="flat" />
      <Building faction="ambas" building="PI" transform="translate(6, 0) scale(1.5)" :flat="flat" />
      <image xlink:href="../assets/resources/swap-arrow.svg" width=15 :height=129/343*15 x=-7.5 y=-14 />
    </g>
    <g v-else-if="kind == 'down-lab'" transform="scale(-1,1)">
      <Building faction="firaks" building="lab" transform="translate(-7.5, 0) scale(1.5)" :flat="flat" />
      <Building faction="firaks" building="ts" transform="translate(7.5, 0) scale(-1.5,1.5)" :flat="flat" />
      <image xlink:href="../assets/resources/arrow-charge.svg" width=15 :height=133/346*15 x=-7.5 y=-14 />
    </g>
    <Building
      v-else-if="kind == 'space-station'"
      building="sp"
      transform="translate(0.5, 0) scale(2.5)"
      faction="ivits"
      :flat="flat"
    />
    <template v-else-if="kind === 'step'">
      <image v-if="!flat" xlink:href="../assets/resources/dig-planet.svg" width="20" height="20" x="-10" y="-10" />
      <circle v-else r="10" :class="['planet-fill', 'dig']" />
      <template v-if="count === 1 || !count">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-11 y=-4 />
      </template>
      <template v-else-if="count === 2">
        <image xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-13 y=-7 /> <image
        xlink:href='../assets/resources/dig-arrow.svg' width=14 :height=325/308*14 x=-9 y=-2 />
      </template>
    </template>
    <template v-else-if="kind === 'd'">
      <g transform="translate(3,0)">
        <image v-if="!flat" xlink:href="../assets/resources/dig-planet.svg" width="20" height="20" x="-10" y="-10" />
        <circle v-else r="10" :class="['planet-fill', 'dig']" />
        <image xlink:href='../assets/resources/dig-arrow.svg' :height=325/308*14 width=14 x=-11 y=-4 />
      </g>
      <g transform="translate(-7,-7)">
        <rect class="ore" width="12" height="12" x="-6" y="-6" />
        <text x="0" y="0">{{ 3 - count }}</text>
      </g>
    </template>
    <image v-else-if="kind === 'tech'" xlink:href='../assets/resources/tech.svg' :height=155/211*22 width=22 x=-11 y=-8
    />
    <Federation v-else-if="kind === 'fed'" width="22" x="-11" y="-26.5" :used="true" />
    <template v-else-if="kind === 'range'">
      <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=15 y=-9 x=-2 /> <image
      xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 y=3 x=-10 /> <image
      xlink:href="../assets/resources/range-arrow.svg" :height=285/164*9 width=9 y=-8 x=-2 transform="rotate(5)" />
      <text
        v-if="count > 1"
        x="-7"
        y="-2.5"
        stroke="black"
        stroke-width="0.3"
        style="font-weight: bold; font-size: 15px; stroke-width: 0.7px"
      >
        {{ count }}
      </text>
    </template>
    <template v-else-if="kind === 'r'">
      <g transform="scale(1) translate(-13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 x=-10 y=-4 />
      </g>
      <g transform="scale(1) translate(13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 x=-10 y=-4 />
      </g>
      <g transform="translate(1,0) rotate(70)">
        <image xlink:href="../assets/resources/range-arrow.svg" :height=285/164*9 width=10 x=-5 y=-8 />
      </g>
      <text v-if="count >= 1" x="13" y="1.2" stroke-width="0.3" style="font-weight: bold; font-size: 10px">
        {{ count }}
      </text>
    </template>
    <template v-else-if="kind === 'ship-range'">
      <g transform="scale(1) translate(-13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 x=-10 y=-4 />
      </g>
      <g transform="scale(1) translate(13,0)">
        <image xlink:href="../assets/resources/flat-hex.svg" :height=162/328*20 width=20 x=-10 y=-4 />
      </g>
      <g transform="translate(1,0) rotate(70)">
        <image xlink:href="../assets/resources/range-arrow.svg" :height=285/164*9 width=10 x=-5 y=-8 />
      </g>
      <text v-if="count >= 1" x="13" y="1.2" stroke-width="0.3" style="font-weight: bold; font-size: 10px">
        {{ count }}
      </text>
      <text v-if="count >= 1" x="-13" y="1.2" stroke-width="0.3" style="font-weight: bold; font-size: 10px"> S </text>
    </template>
    <template v-else-if="kind === 'up-lowest'">
      <Condition condition="a" transform="scale(0.75)" />
      <Token faction="bescods" transform="scale(0.15) translate(50,-24)" />
      <Token faction="bescods" transform="scale(0.15) translate(-5,26)" />
    </template>
    <image v-if="kind === 'pw'" xlink:href='../assets/resources/power-charge.svg' :height=133/346*20 width=20
    transform="translate(-9.5, -13.5)" /> <image v-if="kind === 'pay-pw'"
    xlink:href='../assets/resources/power-charge.svg' :height=133/346*20 width=20 transform="translate(9.5, -13.5)
    scale(-1,1) " />
    <text
      x="0"
      y="0"
      v-if="
        (count != null &&
          [
            'o',
            'c',
            'k',
            'pw',
            'pay-pw',
            't',
            'ta3',
            'bowl-t',
            'burn-token',
            'tg',
            't->tg',
            'tg->t',
            'vp',
            'q',
            'gf',
            'gf->t',
            'tradeShip',
          ].includes(kind)) ||
        count === '+' ||
        kind === 'tradeBonus' ||
        kind === 'tradeDiscount'
      "
      :class="{ plus: count === '+' }"
      :text-decoration="kind === 'burn-token' ? 'line-through' : ''"
      >{{ (kind === "t" || kind === "ta3") && count > 0 ? "+" : "" }}{{ count }}</text
    >
    <text x="0" y="0" v-if="kind == 'brainstone'">B</text>
  </g>
</template>

<script lang="ts">
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Faction, Resource as ResourceEnum } from "@gaia-project/engine";
import Building from "./Building.vue";
import Qic from "./Resources/Qic.vue";
import VictoryPoint from "./Resources/VictoryPoint.vue";
import Federation from "./FederationTile.vue";
import Token from "./Token.vue";

@Component({
  components: {
    Building,
    Federation,
    Qic,
    Token,
    VictoryPoint,
  },
})
export default class Resource extends Vue {
  @Prop()
  kind: ResourceEnum;

  @Prop()
  count: number;

  @Prop({ default: false })
  centerLeft: boolean;

  @Prop({ default: "gen" })
  faction: Faction;

  @Prop()
  tooltip: string;

  /** Show a "+" before the count (kind "r" only) - true when this icon represents a gain, not a raw total. */
  @Prop({ default: false })
  plus: boolean;

  get flat() {
    return this.$store.state.preferences.flatBuildings;
  }
}
</script>

<style lang="scss">
g.resource {
  &.no-tooltip {
    pointer-events: none;
  }

  rect,
  .knowledge {
    stroke: #111;
    stroke-width: 0.9px;
    fill: var(--res-knowledge);
  }

  .qic {
    fill: var(--res-qic);
  }

  .ore {
    fill: var(--res-ore);
  }

  .credit {
    fill: var(--res-credit);
  }

  .power {
    fill: var(--res-power);
  }

  .token-area-badge {
    pointer-events: none;

    circle {
      fill: white;
      stroke: #333;
      stroke-width: 0.5;
    }

    text {
      font-size: 5px;
      font-weight: bold;
      fill: #333;
      text-anchor: middle;
    }
  }

  .power-ring {
    fill: none;
    stroke: var(--protoplanet);
    stroke-width: 2.2px;
  }

  .gaia {
    fill: var(--gaia);
  }

  .trade-bonus {
    fill: var(--current-round);
  }

  .trade-discount {
    fill: var(--oxide);
  }

  .trade-ship {
    fill: var(--volcanic);
  }

  .ore,
  .credit,
  .building.r {
    & + text {
      fill: black;
    }
  }

  text {
    font-size: 10px;
    fill: white;
    font-weight: 600;
    dominant-baseline: central;
    text-anchor: middle;

    &.plus {
      font-size: 22px;

      stroke: #111;
      fill: white;
    }
  }
}
</style>
