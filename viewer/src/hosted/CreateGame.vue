<template>
  <div class="container py-3 py-md-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">New game</h3>
      <a href="?lobby=1" class="btn btn-outline-secondary btn-sm">Back to lobby</a>
    </div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-form @submit.prevent="createGame">
      <div class="create-game-grid">
        <section class="create-game-section">
          <div class="create-game-section__label">Players</div>
          <p class="create-game-help mb-2">Pick seat count, then switch on hot-seat test mode if needed.</p>
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
            <b-form-checkbox v-model="form.testGame" class="create-game-inline-check mb-0">Test game</b-form-checkbox>
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
              role="button"
              tabindex="0"
              @click="form.auctionVariant = option.value"
              @keydown.enter.prevent="form.auctionVariant = option.value"
              @keydown.space.prevent="form.auctionVariant = option.value"
            >
              <div class="create-game-variant__title-row">
                <strong>{{ option.label }}</strong>
                <button
                  type="button"
                  class="create-game-info-dot"
                  :aria-label="`About ${option.label}`"
                  @click.stop="showInfo(option.label, option.description)"
                >
                  i
                </button>
              </div>
              <div class="create-game-variant__summary">{{ option.summary }}</div>
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

        <section v-if="!form.testGame" class="create-game-section create-game-section--full">
          <div class="create-game-section__label mb-1">Open Lobby</div>
          <p class="create-game-help mb-0">
            Regular games now open in the lobby instead of sending invites. You take seat 1 immediately, the other
            {{ form.playerCount - 1 }} seat<span v-if="form.playerCount > 2">s</span> stay open for anyone in the lobby
            to join, and the game starts automatically once the table is full.
          </p>
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
import Vue from "vue";
import InfoModal from "./InfoModal.vue";
import { AUCTION_VARIANT_OPTIONS, buildCreateGameParams } from "./new-game";
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
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      creating: false,
      message: "",
      myNickname: "" as string,
      activeInfo: null as null | { title: string; description: string },
      currentSeed: "" as string,
      currentRotateMove: "" as string,
      setupValid: false,
      form: {
        playerCount: 2,
        testGame: false,
        auctionVariant: "none" as import("./new-game").AuctionVariantOption,
        banPhase: false,
        officialCenterSectors: false,
      },
    };
  },
  created() {
    fetchMyNickname(this.client as any, this.myUserId).then((nickname) => {
      this.myNickname = nickname;
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
      return !!this.currentSeed && this.setupValid;
    },
    blockedReason(): string {
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
        const seats = this.form.testGame
          ? Array.from({ length: this.form.playerCount }, (_, i) => ({
              userId: this.myUserId,
              name: `Player ${i + 1}`,
            }))
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
            openLobby: !this.form.testGame,
          },
          this.currentSeed,
          this.currentRotateMove
        );
        const { data, error } = await (this.client as any).rpc("create_game", params);
        if (error) {
          throw new Error(error.message);
        }
        window.location.search = this.form.testGame ? `?game=${data}` : `?preview=${data}`;
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
  border-top: 1px solid rgba(28, 43, 74, 0.1);
  padding-top: 0.8rem;
  margin-bottom: 6rem;
}

.create-game-section__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5b657a;
}

.create-game-help {
  font-size: 0.82rem;
  line-height: 1.25;
  color: #5d677d;
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
  width: 100%;
  text-align: left;
  border: 1px solid rgba(28, 43, 74, 0.12);
  border-radius: 10px;
  padding: 0.55rem 0.65rem;
  background: #fff;
  color: #2a354d;

  &--active {
    border-color: rgba(43, 93, 184, 0.4);
    background: #f4f8ff;
    box-shadow: 0 0 0 1px rgba(43, 93, 184, 0.08);
  }
}

.create-game-variant__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.create-game-variant__summary {
  font-size: 0.82rem;
  line-height: 1.25;
  color: #60708d;
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
  width: 1.2rem;
  height: 1.2rem;
  border: 1px solid rgba(28, 43, 74, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #4f5f7d;
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
  border: 1px solid rgba(28, 43, 74, 0.1);
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #eef1f6 100%);
  box-shadow: 0 -12px 28px rgba(20, 26, 50, 0.18), 0 -1px 0 rgba(255, 255, 255, 0.6);
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
  box-shadow: 0 1px 2px rgba(31, 45, 82, 0.08);
}

.btn-secondary.create-game-sticky-button {
  border-color: rgba(31, 45, 82, 0.14);
  background: linear-gradient(180deg, #ffffff 0%, #e7ebf3 100%);
  color: #33415c;
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
