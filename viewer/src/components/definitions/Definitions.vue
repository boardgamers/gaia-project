<template>
  <defs>
    <filters />
    <space-hex />
    <buildings />
    <FederationGradients />
    <path
      id="info"
      d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"
    />
    <polygon
      id="arrow"
      points="0 0, 10 3.5, 0 7"
      fill="white"
      stroke="black"
      transform="scale(.7) translate(4, -3.5)"
    />
    <!-- Sandbox mode's map-corner button (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §5.4) - a calculator
         (owner instruction; it was a magnifying glass), drawn in the same artwork style as the stats
         button diagonally opposite it on the map: one solid filled silhouette, screen and keys cut
         out of the body as holes via `fill-rule="evenodd"` rather than painted in a background
         colour, so it renders identically over the neutral badge and the warning-coloured active one.
         Geometry rather than an external asset, so the fill follows `currentColor` - SpaceMap.vue's
         CSS is what sets that per offered/active state. Drawn on the same ~17.5-unit box the
         magnifier used, so the `translate(-8.75, -8.75)` that centres it in the badge is unchanged. -->
    <g id="analysis-calculator">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M4.5 1 H13 A1.5 1.5 0 0 1 14.5 2.5 V15 A1.5 1.5 0 0 1 13 16.5 H4.5 A1.5 1.5 0 0 1 3 15 V2.5 A1.5 1.5 0 0 1 4.5 1 Z
           M4.5 2.5 H13 V5.5 H4.5 Z
           M4.5 6.5 H6.8 V8.8 H4.5 Z M7.6 6.5 H9.9 V8.8 H7.6 Z M10.7 6.5 H13 V8.8 H10.7 Z
           M4.5 9.6 H6.8 V11.9 H4.5 Z M7.6 9.6 H9.9 V11.9 H7.6 Z M10.7 9.6 H13 V11.9 H10.7 Z
           M4.5 12.7 H6.8 V15 H4.5 Z M7.6 12.7 H9.9 V15 H7.6 Z M10.7 12.7 H13 V15 H10.7 Z"
      />
    </g>
    <!-- Sandbox mode's two line controls, sitting beside the calculator in the map's bottom-right
         corner (SpaceMap.vue). Same 17.5-unit box and `currentColor` fill as the calculator above,
         so the shared `translate(-8.75, -8.75)` centres all three in the same badge and one CSS rule
         colours them. Undo is a single step back (the arc's arrowhead is the tail, so it reads as
         "one move", not "restart"); Reset empties the whole line, hence a bin rather than a second
         arrow - two curved arrows at 22px are not tellable apart. -->
    <g id="analysis-undo">
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        d="M 3.75 8 A 5 5 0 1 1 12.58 11.21"
      />
      <polygon fill="currentColor" points="3.75,14 0.35,7.6 7.15,7.6" />
    </g>
    <g id="analysis-reset">
      <path
        fill="currentColor"
        fill-rule="evenodd"
        d="M6.6 1.4 H10.9 V3.4 H14.6 V5.4 H2.9 V3.4 H6.6 Z
           M4.3 6.6 H13.2 L12.4 15.7 A1.1 1.1 0 0 1 11.3 16.7 H6.2 A1.1 1.1 0 0 1 5.1 15.7 Z
           M6.9 8.4 H8.1 V14.8 H6.9 Z
           M9.4 8.4 H10.6 V14.8 H9.4 Z"
      />
    </g>
  </defs>
</template>
<script lang="ts">
import Buildings from "./Buildings.vue";
import FederationGradients from "./FederationGradients.vue";
import Filters from "./Filters.vue";
import SpaceHex from "./SpaceHex.vue";

export default {
  components: {
    Buildings,
    Filters,
    SpaceHex,
    FederationGradients,
  },
};
</script>
