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
      <b-btn v-for="faction in factions" :key="faction" class="mr-2 mb-2" @click="open(faction)">
        {{ factionName(faction) }}
        <i :class="`planet ${factionPlanet(faction)}`" :style="{ color: factionColor(faction) }"></i>
      </b-btn>
    </div>
    <b-modal v-model="modalOpen" :title="selected ? factionName(selected) : ''" ok-only ok-title="Close" size="lg">
      <FactionInfoCard v-if="selected" :faction="selected" :variant="variantFor(selected)" :expansion="expansions" />
    </b-modal>
  </div>
</template>

<script lang="ts">
import Engine, { Command, Expansion, Faction, factionPlanet, Phase } from "@gaia-project/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { Component, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";
import FactionInfoCard from "./FactionInfoCard.vue";

@Component({ components: { FactionInfoCard } })
export default class FactionBrowser extends Vue {
  selected: Faction | null = null;
  modalOpen = false;

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

  get expansions(): Expansion {
    return this.gameData.expansions;
  }

  variantFor(faction: Faction) {
    return factionVariantBoard(this.gameData.factionCustomization, faction)?.board;
  }

  factionName(faction: Faction): string {
    return factionName(faction);
  }

  factionPlanet(faction: Faction) {
    return factionPlanet(faction);
  }

  factionColor(faction: Faction): string {
    return factionColor(faction);
  }

  open(faction: Faction) {
    this.selected = faction;
    this.modalOpen = true;
  }
}
</script>

<style lang="scss" scoped>
// Mirrors Commands.vue's `.faction-picker-buttons` styling so the browsable buttons are visibly the
// same control as the real picker, minus the ability to commit anything.
.faction-browser__buttons .btn {
  border-radius: 12px;
  border-color: var(--ui-border-strong);
  background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
  color: var(--ui-secondary-text);
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
  font-weight: 600;
}

// `content` is repeated here (Commands.vue's global style also sets it) so the browser doesn't
// depend on another component's stylesheet being present.
.faction-browser__buttons i.planet::before {
  content: "\25cf";
  font-size: 18px;
}
</style>
