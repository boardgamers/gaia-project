<template>
  <!-- Read-only faction sheets for a player who isn't on turn during the ban/pick phases. Commands
       .vue's own picker (the one that actually bans/picks) only renders for the player on turn, so
       without this everyone else has to sit through setup with no way to look a faction up. Same
       buttons, same FactionInfoCard - just no move attached to them. -->
  <div v-if="visible" class="faction-browser">
    <p class="faction-browser__hint text-muted small mb-2">
      Not your turn to {{ verb }} &mdash; tap a faction to read its sheet.
    </p>
    <div class="d-flex flex-wrap align-content-stretch faction-browser__buttons">
      <FactionSheetButton v-for="faction in factions" :key="faction" :faction="faction" class="mr-2 mb-2" />
    </div>
  </div>
</template>

<script lang="ts">
import Engine, { Command, Faction, Phase } from "@gaia-project/engine";
import { Component, Vue } from "vue-property-decorator";
import FactionSheetButton from "./FactionSheetButton.vue";

@Component({ components: { FactionSheetButton } })
export default class FactionBrowser extends Vue {
  get gameData(): Engine {
    return this.$store.state.data;
  }

  /** The ban/pick list the player on turn is being offered. It's the same list for everyone (all
   * unbanned factions, or all unpicked ones) - only the right to act on it differs. */
  get factions(): Faction[] {
    const command = this.gameData?.availableCommands?.find(
      (c) => c.name === Command.BanFaction || c.name === Command.ChooseFaction
    );
    return (command?.data as Faction[]) ?? [];
  }

  get visible(): boolean {
    const phase = this.gameData?.phase;
    return (phase === Phase.SetupFactionBan || phase === Phase.SetupFaction) && this.factions.length > 0;
  }

  get verb(): string {
    return this.gameData?.phase === Phase.SetupFactionBan ? "ban" : "pick";
  }
}
</script>

<style lang="scss" scoped>
.faction-browser__buttons ::v-deep(.faction-sheet-button__btn) {
  width: auto;
}
</style>
