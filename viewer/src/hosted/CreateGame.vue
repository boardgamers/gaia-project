<template>
  <div class="container py-3 py-md-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1 class="h3 mb-0">{{ offline ? "New offline game" : "New game" }}</h1>
      <a :href="offline ? '?offline=1' : '?lobby=1'" class="btn btn-outline-secondary btn-sm">Back to lobby</a>
    </div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-form @submit.prevent="createGame">
      <div class="create-game-grid">
        <section class="create-game-section">
          <div class="create-game-section__label">Players</div>
          <p class="create-game-help mb-2">
            {{
              offline
                ? "Every seat plays on this device."
                : "Pick seat count, then switch on hot-seat test mode if needed."
            }}
          </p>
          <div class="create-game-count-row">
            <b-button-group class="create-game-count-buttons">
              <b-button
                v-for="count in [2, 3, 4]"
                :key="count"
                :variant="form.playerCount === count ? 'primary' : 'outline-secondary'"
                @click="setPlayerCount(count)"
              >
                {{ count }}
              </b-button>
            </b-button-group>
            <b-form-checkbox v-if="!offline" v-model="form.testGame" class="create-game-inline-check mb-0">
              Test game
            </b-form-checkbox>
          </div>
        </section>

        <section class="create-game-section">
          <div class="create-game-section__label">Faction Selection</div>
          <p class="create-game-help mb-2">Choose how factions get assigned before setup begins.</p>
          <div class="create-game-variant-grid">
            <div
              v-for="option in auctionVariantOptions"
              :key="option.value"
              class="create-game-variant"
              :class="{ 'create-game-variant--active': form.auctionVariant === option.value }"
            >
              <button
                type="button"
                class="create-game-variant__select"
                :aria-pressed="form.auctionVariant === option.value ? 'true' : 'false'"
                @click="form.auctionVariant = option.value"
              >
                <strong class="create-game-variant__title">{{ option.label }}</strong>
                <span class="create-game-variant__summary">{{ option.summary }}</span>
              </button>
              <button
                type="button"
                class="create-game-info-dot create-game-variant__info"
                :aria-label="`About ${option.label}`"
                @click="showInfo(option.label, option.description)"
              >
                i
              </button>
            </div>
          </div>
          <div class="create-game-ban-phase">
            <b-form-checkbox v-model="form.banPhase" class="create-game-inline-check mb-0">Ban phase</b-form-checkbox>
            <button
              type="button"
              class="create-game-info-dot"
              aria-label="About the ban phase"
              @click="showInfo('Ban phase', banPhaseInfo)"
            >
              i
            </button>
          </div>
        </section>

        <section v-if="!offline && !form.testGame" class="create-game-section create-game-section--full">
          <div class="create-game-section__label mb-1">Invites</div>
          <b-button-group class="mb-2">
            <b-button
              size="sm"
              :variant="inviteMode === 'open' ? 'primary' : 'outline-secondary'"
              @click="inviteMode = 'open'"
            >
              Open lobby
            </b-button>
            <b-button
              size="sm"
              :variant="inviteMode === 'direct' ? 'primary' : 'outline-secondary'"
              @click="inviteMode = 'direct'"
            >
              Direct invite
            </b-button>
          </b-button-group>

          <p v-if="inviteMode === 'open'" class="create-game-help mb-0">
            You take seat 1 immediately. The other {{ form.playerCount - 1 }} seat<span v-if="form.playerCount > 2"
              >s</span
            >
            stay open in the lobby for anyone to join, and the game starts automatically once the table is full.
          </p>

          <div v-else>
            <p class="create-game-help mb-2">
              Pick {{ form.playerCount - 1 }} player<span v-if="form.playerCount > 2">s</span> to invite (seat 1 is
              you). {{ selectedInvitees.length }}/{{ form.playerCount - 1 }} selected.
            </p>
            <div class="create-game-invite-list">
              <button
                v-for="player in invitablePlayers"
                :key="player.user_id"
                type="button"
                class="create-game-invite-row"
                :class="{ 'create-game-invite-row--active': isInvited(player.user_id) }"
                :disabled="!isInvited(player.user_id) && selectedInvitees.length >= form.playerCount - 1"
                @click="toggleInvitee(player.user_id)"
              >
                {{ player.nickname }}
              </button>
              <div v-if="invitablePlayers.length === 0" class="text-muted small p-2">No other players yet.</div>
            </div>
          </div>
        </section>

        <section class="create-game-section create-game-section--full create-game-section--preview">
          <div class="d-flex align-items-start justify-content-between flex-wrap mb-2" style="gap: 0.5rem">
            <div>
              <div class="create-game-section__label mb-1">Setup Preview</div>
              <p class="create-game-help mb-0">
                Tap sectors to rotate them. Seed tools stay tucked away unless you need them.
              </p>
            </div>
          </div>
          <div class="create-game-ban-phase mb-2">
            <b-form-checkbox v-model="form.officialCenterSectors" class="create-game-inline-check mb-0">
              Official center-sector rule (1-4)
            </b-form-checkbox>
            <button
              type="button"
              class="create-game-info-dot"
              aria-label="About the official center-sector rule"
              @click="showInfo('Official center-sector rule', centerSectorInfo)"
            >
              i
            </button>
          </div>
          <SetupPreview
            ref="setupPreview"
            :player-count="form.playerCount"
            :official-center-sectors="form.officialCenterSectors"
            @update="onSetupUpdate"
          />
        </section>
      </div>

      <div class="create-game-sticky-bar">
        <div class="create-game-sticky-bar__content">
          <div v-if="!canCreate" class="text-muted small create-game-sticky-bar__reason">{{ blockedReason }}</div>
          <div class="create-game-sticky-bar__buttons">
            <b-button type="button" variant="secondary" class="create-game-sticky-button" @click="rerollSetup"
              >Reroll setup</b-button
            >
            <b-button
              type="submit"
              variant="primary"
              class="create-game-sticky-button"
              :disabled="creating || !canCreate"
            >
              Create game
            </b-button>
          </div>
        </div>
      </div>
    </b-form>

    <InfoModal :open="!!activeInfo" :title="activeInfo ? activeInfo.title : ''" @close="activeInfo = null">
      {{ activeInfo ? activeInfo.description : "" }}
    </InfoModal>
  </div>
</template>

<script lang="ts">
import Engine from "@gaia-project/engine";
import Vue from "vue";
import InfoModal from "./InfoModal.vue";
import { AUCTION_VARIANT_OPTIONS, buildCreateGameParams } from "./new-game";
import { createStoredOfflineGame } from "../offline-game";
import { fetchMyNickname } from "./profile";
import SetupPreview from "./SetupPreview.vue";

const BAN_PHASE_INFO =
  "Each player bans one faction, in turn order, before factions are picked or auctioned. Banned factions " +
  "can't be picked, bid on, or randomly assigned to anyone for the rest of the game. This happens first, " +
  "regardless of which Faction Selection option is chosen.";

const CENTER_SECTOR_INFO =
  "Restricts the map's center sector to the 4 original numbered sectors (1-4). When off, the center can be " +
  "any sector in play.";

export default Vue.extend({
  name: "HostedCreateGame",
  components: { SetupPreview, InfoModal },
  props: {
    client: { type: Object, default: null },
    session: { type: Object, default: null },
    offline: { type: Boolean, default: false },
  },
  data() {
    const offline = !!(this as any).offline;
    return {
      creating: false,
      message: "",
      myNickname: "" as string,
      activeInfo: null as null | { title: string; description: string },
      currentSeed: "" as string,
      currentRotateMove: "" as string,
      setupValid: false,
      inviteMode: "open" as "open" | "direct",
      invitablePlayers: [] as { user_id: string; nickname: string }[],
      selectedInvitees: [] as string[],
      form: {
        playerCount: 2,
        testGame: false,
        auctionVariant: (offline ? "silent" : "none") as import("./new-game").AuctionVariantOption,
        banPhase: offline,
        officialCenterSectors: true,
      },
    };
  },
  created() {
    if (this.offline) {
      return;
    }
    fetchMyNickname(this.client as any, this.myUserId).then((nickname) => {
      this.myNickname = nickname;
    });
    (this.client as any).rpc("list_invitable_players").then(({ data, error }: any) => {
      if (!error) {
        this.invitablePlayers = (data ?? []).filter((p: any) => p.user_id !== this.myUserId);
      }
    });
  },
  computed: {
    auctionVariantOptions() {
      return AUCTION_VARIANT_OPTIONS;
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    myDisplayName(): string {
      return this.myNickname || "Host";
    },
    canCreate(): boolean {
      if (!this.currentSeed || !this.setupValid) {
        return false;
      }
      if (!this.offline && !this.form.testGame && this.inviteMode === "direct") {
        return this.selectedInvitees.length === this.form.playerCount - 1;
      }
      return true;
    },
    blockedReason(): string {
      if (
        !this.offline &&
        !this.form.testGame &&
        this.inviteMode === "direct" &&
        this.selectedInvitees.length !== this.form.playerCount - 1
      ) {
        return `Pick ${this.form.playerCount - 1} player(s) to invite first`;
      }
      return "Fix the invalid setup first";
    },
    banPhaseInfo(): string {
      return BAN_PHASE_INFO;
    },
    centerSectorInfo(): string {
      return CENTER_SECTOR_INFO;
    },
  },
  methods: {
    setPlayerCount(count: number) {
      this.form.playerCount = count;
      this.selectedInvitees = this.selectedInvitees.slice(0, count - 1);
    },
    isInvited(userId: string): boolean {
      return this.selectedInvitees.includes(userId);
    },
    toggleInvitee(userId: string) {
      if (this.isInvited(userId)) {
        this.selectedInvitees = this.selectedInvitees.filter((id) => id !== userId);
      } else if (this.selectedInvitees.length < this.form.playerCount - 1) {
        this.selectedInvitees = [...this.selectedInvitees, userId];
      }
    },
    nicknameFor(userId: string): string {
      return this.invitablePlayers.find((p) => p.user_id === userId)?.nickname ?? "";
    },
    showInfo(title: string, description: string) {
      this.activeInfo = { title, description };
    },
    onSetupUpdate(payload: { seed: string; rotateMove: string; valid: boolean }) {
      this.currentSeed = payload.seed;
      this.currentRotateMove = payload.rotateMove;
      this.setupValid = payload.valid;
    },
    rerollSetup() {
      (this.$refs.setupPreview as any)?.reroll?.();
    },
    async createGame() {
      if (!this.canCreate) {
        return;
      }
      this.creating = true;
      this.message = "";
      try {
        const directInvite = !this.offline && !this.form.testGame && this.inviteMode === "direct";
        const seats = this.offline
          ? Array.from({ length: this.form.playerCount }, (_, i) => ({ userId: null, name: `Player ${i + 1}` }))
          : this.form.testGame
          ? Array.from({ length: this.form.playerCount }, (_, i) => ({
              userId: this.myUserId,
              name: `Player ${i + 1}`,
            }))
          : directInvite
          ? [
              { userId: this.myUserId, name: this.myDisplayName },
              ...this.selectedInvitees.map((id) => ({ userId: id, name: this.nicknameFor(id) })),
            ]
          : Array.from({ length: this.form.playerCount }, (_, i) =>
              i === 0 ? { userId: this.myUserId, name: this.myDisplayName } : { userId: null, name: "" }
            );
        const params = buildCreateGameParams(
          {
            playerCount: this.form.playerCount,
            seats,
            auctionVariant: this.form.auctionVariant,
            banPhase: this.form.banPhase,
            officialCenterSectors: this.form.officialCenterSectors,
            openLobby: !this.offline && !this.form.testGame && !directInvite,
          },
          this.currentSeed,
          this.currentRotateMove
        );
        if (this.offline) {
          const engine = new Engine(
            [`init ${params.p_player_count} ${params.p_seed}`, params.p_setup_move],
            params.p_options
          );
          engine.generateAvailableCommandsIfNeeded();
          const stored = createStoredOfflineGame(engine, params.p_name);
          if (!stored.save) {
            throw new Error(stored.error ?? "The game could not be stored on this device.");
          }
          window.location.search = `?offline=1&game=${encodeURIComponent(stored.save.id)}`;
          return;
        }
        const { data, error } = await (this.client as any).rpc("create_game", params);
        if (error) {
          throw new Error(error.message);
        }
        window.location.search = this.form.testGame || directInvite ? `?game=${data}` : `?preview=${data}`;
      } catch (err) {
        this.message = `Could not create the game: ${err instanceof Error ? err.message : err}`;
        this.creating = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.create-game-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem 1rem;
}

.create-game-section {
  min-width: 0;
  padding-bottom: 0.15rem;
}

.create-game-section--full {
  grid-column: 1 / -1;
}

.create-game-section--preview {
  border-top: 1px solid var(--ui-border);
  padding-top: 0.8rem;
  margin-bottom: 6rem;
}

.create-game-section__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
}

.create-game-help {
  font-size: 0.82rem;
  line-height: 1.25;
  color: var(--ui-text-muted);
}

.create-game-count-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
}

.create-game-count-buttons .btn {
  min-width: 2.6rem;
}

.create-game-inline-check {
  font-size: 0.9rem;
}

.create-game-variant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.create-game-variant {
  position: relative;
  width: 100%;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  padding: 0;
  background: var(--ui-surface);
  color: var(--ui-text);

  &--active {
    border-color: var(--ui-link);
    background: var(--ui-surface-active);
    box-shadow: 0 0 0 1px var(--ui-accent-soft);
  }
}

.create-game-variant__select {
  display: block;
  width: 100%;
  min-height: 100%;
  padding: 0.65rem 3rem 0.65rem 0.65rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  text-align: left;
}

.create-game-variant__title {
  display: block;
  margin-bottom: 0.25rem;
}

.create-game-variant__summary {
  display: block;
  font-size: 0.82rem;
  line-height: 1.25;
  color: var(--ui-text-muted);
}

.create-game-variant__info {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
}

.create-game-invite-list {
  display: flex;
  flex-direction: column;
  max-height: 12.5rem;
  overflow-y: auto;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--ui-surface);
}

.create-game-invite-row {
  width: 100%;
  text-align: left;
  border: 0;
  border-bottom: 1px solid var(--ui-border);
  padding: 0.5rem 0.7rem;
  background: transparent;
  color: var(--ui-text);
  font-size: 0.88rem;

  &:last-child {
    border-bottom: 0;
  }

  &:disabled {
    color: var(--ui-text-subtle);
  }

  &--active {
    background: var(--ui-surface-active);
    color: var(--ui-link);
    font-weight: 700;
  }
}

.create-game-ban-phase {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.create-game-info-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--ui-border-strong);
  border-radius: 999px;
  background: var(--ui-surface-raised);
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  flex: 0 0 auto;
}

.create-game-sticky-bar {
  position: sticky;
  bottom: 0.5rem;
  z-index: 5;
  margin-top: -5.1rem;
}

.create-game-sticky-bar__content {
  border: 1px solid var(--ui-border);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--ui-panel-gradient-start) 0%, var(--ui-panel-gradient-end) 100%);
  box-shadow: 0 -12px 28px var(--ui-shadow), 0 -1px 0 var(--ui-divider-highlight);
  padding: 0.7rem 0.7rem calc(0.68rem + env(safe-area-inset-bottom) + 8px);
}

.create-game-sticky-bar__reason {
  margin-bottom: 0.45rem;
}

.create-game-sticky-bar__buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.create-game-sticky-button {
  border-radius: 10px;
  box-shadow: 0 1px 2px var(--ui-shadow-soft);
}

.btn-secondary.create-game-sticky-button {
  border-color: var(--ui-border-strong);
  background: linear-gradient(180deg, var(--ui-keycap-gradient-start) 0%, var(--ui-keycap-gradient-end) 100%);
  color: var(--ui-secondary-text);
}

@media (max-width: 767px) {
  .create-game-grid {
    grid-template-columns: 1fr;
  }

  .create-game-section--preview {
    margin-bottom: 6.4rem;
  }

  .create-game-sticky-bar {
    margin: 0 -0.5rem;
    margin-top: -5.3rem;
  }

  .create-game-sticky-bar__content {
    padding-left: calc(0.6rem + env(safe-area-inset-left));
    padding-right: calc(0.6rem + env(safe-area-inset-right));
  }
}

@media (max-width: 359px) {
  .create-game-count-row,
  .create-game-variant-grid,
  .create-game-sticky-bar__buttons {
    grid-template-columns: 1fr;
  }
}
</style>
