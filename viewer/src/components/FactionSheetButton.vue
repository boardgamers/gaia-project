<template>
  <!-- A faction button that only opens that faction's sheet - no command behind it, and the modal's
       one footer button is Close, so there is nothing to accidentally commit. Used both by
       FactionBrowser.vue (off-turn ban/pick browsing) and by Commands.vue's Silent Auction bid form,
       where the factions being bid on are otherwise unreadable plain text. -->
  <span class="faction-sheet-button">
    <b-btn class="faction-sheet-button__btn" :aria-label="ariaLabel" @click="open = true">
      {{ label }}
      <i :class="`planet ${planet}`" :style="{ color: color }"></i>
      <!-- Who currently holds this faction, for the browser's "already picked" row. Kept inside the
           button so the name travels with the faction on a wrapped, multi-column row. -->
      <small v-if="note" class="faction-sheet-button__note">{{ note }}</small>
    </b-btn>
    <b-modal
      :id="`faction-sheet-${faction}`"
      v-model="open"
      :title="label"
      ok-only
      ok-title="Close"
      size="lg"
      dialog-class="gaia-viewer-modal"
    >
      <FactionInfoCard :faction="faction" :variant="variant" :expansion="expansions" />
    </b-modal>
  </span>
</template>

<script lang="ts">
import Engine, { Expansion, Faction, factionPlanet } from "@gaia-project/engine";
import { factionVariantBoard } from "@gaia-project/engine/src/faction-boards";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";
import FactionInfoCard from "./FactionInfoCard.vue";

@Component({ components: { FactionInfoCard } })
export default class FactionSheetButton extends Vue {
  @Prop()
  faction: Faction;

  /** Optional trailing caption, e.g. the player holding this faction. Purely informational. */
  @Prop()
  note: string;

  open = false;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  get label(): string {
    return factionName(this.faction);
  }

  get ariaLabel(): string {
    return this.note
      ? `${this.label} (${this.note}) - read its faction sheet`
      : `${this.label} - read its faction sheet`;
  }

  get planet() {
    return factionPlanet(this.faction);
  }

  get color(): string {
    return factionColor(this.faction);
  }

  get variant() {
    return factionVariantBoard(this.gameData.factionCustomization, this.faction)?.board;
  }

  get expansions(): Expansion {
    return this.gameData.expansions;
  }
}
</script>

<style lang="scss" scoped>
// Mirrors Commands.vue's `.faction-picker-buttons` styling, so a sheet button is visibly the same
// control as the real picker - minus the ability to commit anything.
.faction-sheet-button__btn {
  width: 100%;
  border-radius: 12px;
  border-color: var(--ui-border-strong);
  background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
  color: var(--ui-secondary-text);
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
  font-weight: 600;
}

// `content` is repeated here (Commands.vue's global style also sets it) so the button doesn't
// depend on another component's stylesheet being present.
.faction-sheet-button__btn i.planet::before {
  content: "\25cf";
  font-size: 18px;
}

.faction-sheet-button__note {
  display: block;
  font-weight: 400;
  font-size: 11px;
  line-height: 1.1;
  opacity: 0.75;
}
</style>
