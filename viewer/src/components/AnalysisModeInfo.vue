<template>
  <!-- Everything analysis mode used to explain on screen at all times (ANALYSIS_MODE_PLAN.md §12).
       Same pattern as SilentAuctionInfo/BanPhaseInfo: read once from the header's info button, then
       out of the way. Rendered exactly ONCE per page, by Commands.vue, and deliberately not inside
       AnalysisHeaderControls.vue - that component is rendered twice (desktop title and mobile sticky
       bar), and two copies of one b-modal id make the button open whichever Bootstrap-Vue registered
       first, which is the bug SetupStatus.vue's own comment warns about. -->
  <b-modal id="analysis-mode-info" size="lg" title="How planning works" ok-only dialog-class="gaia-viewer-modal">
    <p>
      Try moves using the normal game controls. This is a private simulation: nothing is played in the real game until
      you confirm.
    </p>
    <h6>Compare plans</h6>
    <p>
      Each tab is an alternative plan: <strong>Plan A</strong>, <strong>Plan B</strong>, and so on. Use
      <strong>+</strong> to copy the current plan and try a variation. The selected plan shows its resource and VP
      changes together. Undo removes the last move; Clear starts that plan again. Drafts are saved in this browser.
      Saving a queue keeps all your plans. When you play a matching move, manually or by premove, it is removed from
      each plan so you can continue with the remaining moves.
    </p>
    <h6>Try future possibilities</h6>
    <p>
      Each move must be affordable with the resources shown on your faction board. Income and conversions update the
      available choices.
      <strong>Simulate charge +1</strong> previews receiving a power charge. This is not a game action and does not add
      a condition to your premoves. Simulated resources never change the real game.
    </p>
    <p>
      <strong>Simulate neighbour</strong> previews the lower Trading Station price. Queuing it keeps a 3-credit limit,
      plus ore. If that price is unavailable on your turn, the premoves stop instead of spending 6 credits.
    </p>
    <p>
      Other players stay still in the simulation. A plan can continue across rounds and assumes nobody takes the actions
      or tiles you need. Live opponent moves and auto-charge update the position underneath your plan.
    </p>
    <h6>Save premoves</h6>
    <p class="mb-0">
      Finish a simulated turn, then choose <strong>Queue moves</strong>. Only the selected plan is submitted, with up to
      three complete turns. If it is your turn, <strong>Play moves</strong> plays the first immediately. The rest run on
      your following turns, even with the browser closed. Moves for later rounds wait for their round and phase. You can
      view or cancel them at any time. If a move cannot be played with your actual resources when your turn arrives, the
      queue stops. It does not wait for a charge or another player's move.
    </p>
  </b-modal>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({ name: "AnalysisModeInfo" });
</script>
