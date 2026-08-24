<template>
  <b-modal id="ban-phase-info" size="lg" title="How the ban phase works" ok-only dialog-class="gaia-viewer-modal">
    <div class="ban-phase-info">
      <p>Before factions are chosen, each player bans one faction in turn order:</p>
      <ul>
        <li>Every player bans exactly one faction, one at a time, in turn order.</li>
        <li>A banned faction is out for the rest of the game - nobody can pick, bid on, or randomly receive it.</li>
        <li>The ban phase always happens first, before any faction pick or auction step.</li>
      </ul>
    </div>
  </b-modal>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class BanPhaseInfo extends Vue {}
</script>
