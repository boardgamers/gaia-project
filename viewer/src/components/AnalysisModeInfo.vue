<template>
  <!-- Everything analysis mode used to explain on screen at all times (ANALYSIS_MODE_PLAN.md §12).
       Same pattern as SilentAuctionInfo/BanPhaseInfo: read once from the header's info button, then
       out of the way. Rendered exactly ONCE per page, by Commands.vue, and deliberately not inside
       AnalysisHeaderControls.vue - that component is rendered twice (desktop title and mobile sticky
       bar), and two copies of one b-modal id make the button open whichever Bootstrap-Vue registered
       first, which is the bug SetupStatus.vue's own comment warns about. -->
  <b-modal id="analysis-mode-info" size="lg" title="How analysis mode works" ok-only dialog-class="gaia-viewer-modal">
    <p>
      The board is yours to play with. Nothing here is saved and nobody else can see it — leave with the button at the
      bottom right of the map and the real game is exactly as you left it.
    </p>
    <p>
      You are not limited to what you can afford. Spend past your resources and the player board shows the shortfall as
      a negative number, which is the answer to "can I actually do this?". Power is the exception: its bowls hold tokens
      rather than a balance, so a power cost you cannot cover is topped up and counted in the header as assumed power.
    </p>
    <p>
      Every move is added to the line as soon as it is complete — there is no confirmation step. Undo removes the last
      one, Reset clears them all.
    </p>
    <p>
      Opponents never move, apart from the starting mines you place for them yourself during setup, and any power they
      would be offered is declined automatically.
    </p>
    <p>
      A line runs to the end of the round after the one it started in. Board actions, tech tiles, boosters and
      federation tiles are all shown as available, so a line assumes nobody beats you to any of them.
    </p>
    <p class="mb-0">
      Commit plays the line for real: the first move goes live and the rest queue as premoves. It is offered only while
      every move in the line is affordable without overspending and belongs to your own seat.
    </p>
  </b-modal>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({ name: "AnalysisModeInfo" });
</script>
