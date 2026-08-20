<template>
  <!-- Everything analysis mode used to explain on screen at all times (ANALYSIS_MODE_PLAN.md §12).
       Same pattern as SilentAuctionInfo/BanPhaseInfo: read once from the header's info button, then
       out of the way. Rendered exactly ONCE per page, by Commands.vue, and deliberately not inside
       AnalysisHeaderControls.vue - that component is rendered twice (desktop title and mobile sticky
       bar), and two copies of one b-modal id make the button open whichever Bootstrap-Vue registered
       first, which is the bug SetupStatus.vue's own comment warns about. -->
  <b-modal id="analysis-mode-info" size="lg" title="How sandbox mode works" ok-only dialog-class="gaia-viewer-modal">
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
      Charge 1 hands you one charged power, as many times as you like, for the leech an opponent would realistically
      have offered you. The header keeps a running total of what you have charged that way, because once a later move
      spends it the bowls can read exactly as they did before. Undo Charge takes the last one back.
    </p>
    <p>
      Every move is added to the line as soon as it is complete — there is no confirmation step. Undo removes the last
      one, Reset clears them all.
    </p>
    <p>
      The tabs along the top of this header are your lines. Line 1 is there from the start; <strong>+</strong> starts
      another one from the same board, and clicking a tab opens that line to carry on, undo or reset exactly as you
      would any other. Nothing needs saving — each line is kept as you play it, and is still there when you come back.
      Each tab carries its own result, so you can read what a line came to without opening it: how many points ahead of
      where the sandbox started it ends, a red <strong>!</strong> if it spends more than you have, and a
      <strong>~</strong> if the board has since moved on and part of that line no longer applies.
    </p>
    <p>
      Opponents never move, apart from the starting mines you place for them yourself during setup. Their round boosters
      are picked for them, and any power they would be offered is declined automatically, so a build never pauses on
      somebody else's decision. If someone takes their turn in the real game while you are in here, your line is
      replayed against the new board rather than thrown away — you are only told about it if part of it stops working.
    </p>
    <p>
      A line runs to the end of the round after the one it started in. Board actions, tech tiles, boosters and
      federation tiles are all shown as available, so a line assumes nobody beats you to any of them.
    </p>
    <p class="mb-0">
      Commit plays the line for real: the first move goes live and the rest queue as premoves, up to four moves in all
      (one live plus the premove queue's three rows). It asks first, listing exactly what will be played and what will
      be left behind — nothing leaves the sandbox until you confirm. Only moves that are your own and affordable without
      overspending are offered, so a move that needed assumed power ends the list there. Committing clears every line,
      not just the one it played: the others were alternatives to the move you have now actually made.
    </p>
  </b-modal>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({ name: "AnalysisModeInfo" });
</script>
