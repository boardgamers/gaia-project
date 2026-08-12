<template>
  <!-- Read-only faction sheets during the round-0 faction phases. Two rows, either of which can be
       on its own:

       - the factions still on offer, for a player who isn't on turn during ban/pick. Commands.vue's
         own picker (the one that actually bans/picks) only renders for the player on turn, so
         without this everyone else has to sit through setup with no way to look a faction up.
       - the factions already picked, for everyone including the player on turn. A picked faction
         leaves the picker immediately, so from that moment nothing on screen could open its sheet -
         not even for the player who just picked it, and not while the auction variants then spend a
         whole phase bidding on exactly those factions.

       Same buttons, same FactionInfoCard - just no move attached to them. -->
  <div v-if="visible" class="faction-browser">
    <template v-if="showOffered">
      <p class="faction-browser__hint text-muted small mb-2">
        Not your turn to {{ verb }} &mdash; tap a faction to read its sheet.
      </p>
      <div class="d-flex flex-wrap align-content-stretch faction-browser__buttons">
        <FactionSheetButton v-for="faction in factions" :key="faction" :faction="faction" class="mr-2 mb-2" />
      </div>
    </template>
    <div v-if="taken.length > 0" class="faction-browser__taken">
      <p class="faction-browser__hint text-muted small mb-2">{{ takenLabel }}</p>
      <div class="d-flex flex-wrap align-content-stretch faction-browser__buttons">
        <FactionSheetButton
          v-for="row in taken"
          :key="row.faction"
          :faction="row.faction"
          :note="row.holder"
          class="mr-2 mb-2"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Engine, { AuctionVariant, Command, Faction, Phase, PlayerEnum } from "@gaia-project/engine";
import { Component, Prop, Vue } from "vue-property-decorator";
import FactionSheetButton from "./FactionSheetButton.vue";

/** The round-0 phases where a faction sheet is otherwise unreachable. `SetupPreferenceBid` is
 * deliberately absent: PreferenceSplitBid.vue renders the same sheet buttons for every seat there,
 * so a second copy of them would just be a duplicate row above its bid form. */
const browsePhases: Phase[] = [Phase.SetupFactionBan, Phase.SetupFaction, Phase.SetupAuction, Phase.SetupSilentBid];

@Component({ components: { FactionSheetButton } })
export default class FactionBrowser extends Vue {
  /** Whether the viewer is the player currently on turn - i.e. whether the real picker/bid form is
   * on screen right next to this. Only the already-picked row is added in that case. */
  @Prop({ default: false })
  onTurn: boolean;

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

  /** Every faction picked so far, in pick order (`engine.setup`), with whoever holds it right now.
   * The holder is empty while nobody does - Choose-Then-Bid assigns a faction only once it has been
   * bid on, and the Silent Auction reassigns all of them when it resolves. */
  get taken(): { faction: Faction; holder: string }[] {
    return (this.gameData?.setup ?? []).map((faction) => ({ faction, holder: this.holderName(faction) }));
  }

  private holderName(faction: Faction): string {
    const player = this.gameData?.players?.find((pl) => pl.faction === faction);
    if (!player) {
      return "";
    }
    const name = player.name || `Player ${(player.player as PlayerEnum as number) + 1}`;
    // In the two turn-by-turn auctions holding a faction only means holding the highest bid on it
    // so far - anyone can still be outbid - so don't write it as if they had picked it.
    return this.bidding ? `${name} leads` : name;
  }

  /** The auction variants where a faction is bid on repeatedly rather than simply picked. */
  private get bidding(): boolean {
    const auction = this.gameData?.options?.auction;
    return auction === AuctionVariant.BidWhileChoosing || auction === AuctionVariant.ChooseBid;
  }

  get visible(): boolean {
    const phase = this.gameData?.phase;
    if (!browsePhases.includes(phase)) {
      return false;
    }
    // The Silent Auction's own bid form (Commands.vue) already carries a sheet button per picked
    // faction, so for the player on turn there this row would be the same buttons twice.
    if (this.onTurn && phase === Phase.SetupSilentBid) {
      return false;
    }
    return this.showOffered || this.taken.length > 0;
  }

  get showOffered(): boolean {
    return !this.onTurn && this.factions.length > 0;
  }

  get takenLabel(): string {
    const phase = this.gameData?.phase;
    const auctioned = this.bidding || phase === Phase.SetupAuction || phase === Phase.SetupSilentBid;
    return auctioned
      ? "Up for auction — tap a faction to read its sheet."
      : "Already picked — tap a faction to read its sheet.";
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

// Only when both rows are on screen at once (off-turn pick phase, after the first pick).
.faction-browser__taken:not(:first-child) {
  margin-top: 0.25rem;
}
</style>
