<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">New game</h3>
      <div class="d-flex align-items-center" style="gap: 0.5rem">
        <b-button v-b-modal.create-game-info size="sm" variant="outline-secondary">Info</b-button>
        <a href="?lobby=1" class="btn btn-outline-secondary btn-sm">Back to lobby</a>
      </div>
    </div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-form @submit.prevent="createGame">
      <div class="create-game-section">
        <div class="create-game-section__label">Players</div>
        <b-button-group>
          <b-button
            v-for="count in [2, 3, 4]"
            :key="count"
            :variant="form.playerCount === count ? 'primary' : 'outline-secondary'"
            @click="setPlayerCount(count)"
          >
            {{ count }}
          </b-button>
        </b-button-group>
      </div>

      <div class="create-game-section">
        <b-form-checkbox v-model="form.testGame" class="mb-0">Test game - I control all seats</b-form-checkbox>
      </div>

      <template v-if="!form.testGame">
        <div class="create-game-section">
          <div class="create-game-section__label">Invite {{ form.playerCount - 1 }} more</div>
          <div v-if="loadingUsers" class="text-muted small">Loading registered players...</div>
          <div v-else-if="invitableUsers.length === 0" class="text-muted small">
            No other registered players yet - they need to sign in once first.
          </div>
          <b-form-checkbox
            v-for="user in invitableUsers"
            :key="user.id"
            :checked="isInvited(user.id)"
            :disabled="!isInvited(user.id) && invitedUserIds.length >= form.playerCount - 1"
            @change="toggleInvite(user.id)"
          >
            {{ user.display_name }} <span class="text-muted small">({{ user.email }})</span>
          </b-form-checkbox>
        </div>
        <b-button
          variant="outline-secondary"
          size="sm"
          class="mb-3"
          :disabled="invitedUserIds.length === 0"
          @click="shuffleSeats"
        >
          Shuffle seat order
        </b-button>
      </template>

      <div class="create-game-section">
        <div class="create-game-section__label">Faction selection</div>
        <b-form-radio
          v-for="option in auctionVariantOptions"
          :key="option.value"
          v-model="form.auctionVariant"
          :value="option.value"
        >
          {{ option.label }}
        </b-form-radio>
      </div>

      <div class="create-game-section create-game-section--preview">
        <div class="create-game-section__label">Setup preview</div>
        <SetupPreview ref="setupPreview" :player-count="form.playerCount" @update="onSetupUpdate" />
      </div>

      <div class="create-game-sticky-bar">
        <div v-if="!canCreate" class="text-muted small create-game-sticky-bar__reason">{{ blockedReason }}</div>
        <div class="d-flex align-items-center justify-content-end" style="gap: 0.5rem">
          <b-button type="button" variant="outline-secondary" @click="rerollSetup">Reroll setup</b-button>
          <b-button type="submit" variant="primary" :disabled="creating || !canCreate">Create game</b-button>
        </div>
      </div>
    </b-form>

    <b-modal id="create-game-info" title="Create game" ok-only>
      <p class="mb-2">Pick player count, optionally switch on test-game hot-seat mode, invite seats, then choose a faction-selection variant.</p>
      <p class="mb-2">The setup preview is live: reroll until you like it, and click sectors to rotate them. Whatever is visible when you press Create becomes the game.</p>
      <p class="mb-0 text-muted small">Extra seed controls are tucked inside the preview's Seed tools toggle to keep this screen compact on mobile.</p>
    </b-modal>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { AUCTION_VARIANT_OPTIONS, buildCreateGameParams } from "./new-game";
import SetupPreview from "./SetupPreview.vue";

type RegisteredUser = { id: string; email: string; display_name: string };

export default Vue.extend({
  name: "HostedCreateGame",
  components: { SetupPreview },
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return {
      creating: false,
      loadingUsers: true,
      message: "",
      users: [] as RegisteredUser[],
      invitedUserIds: [] as string[],
      currentSeed: "" as string,
      currentRotateMove: "" as string,
      setupValid: false,
      form: {
        playerCount: 2,
        testGame: false,
        auctionVariant: "none" as "none" | "silent",
      },
    };
  },
  computed: {
    auctionVariantOptions() {
      return AUCTION_VARIANT_OPTIONS;
    },
    myUserId(): string {
      return (this.session as any).user?.id ?? "";
    },
    invitableUsers(): RegisteredUser[] {
      return this.users.filter((u) => u.id !== this.myUserId);
    },
    canCreate(): boolean {
      if (!this.currentSeed || !this.setupValid) {
        return false;
      }
      return this.form.testGame || this.invitedUserIds.length === this.form.playerCount - 1;
    },
    blockedReason(): string {
      if (!this.currentSeed || !this.setupValid) {
        return "Fix the invalid setup first";
      }
      return `Invite ${this.form.playerCount - 1} more player(s) first`;
    },
  },
  created() {
    this.loadUsers();
  },
  methods: {
    async loadUsers() {
      this.loadingUsers = true;
      const { data, error } = await (this.client as any).rpc("list_registered_users");
      if (error) {
        this.message = `Could not load registered players: ${error.message}`;
      } else {
        this.users = data ?? [];
      }
      this.loadingUsers = false;
    },
    setPlayerCount(count: number) {
      this.form.playerCount = count;
      this.invitedUserIds = this.invitedUserIds.slice(0, count - 1);
    },
    isInvited(userId: string): boolean {
      return this.invitedUserIds.includes(userId);
    },
    toggleInvite(userId: string) {
      if (this.isInvited(userId)) {
        this.invitedUserIds = this.invitedUserIds.filter((id) => id !== userId);
      } else if (this.invitedUserIds.length < this.form.playerCount - 1) {
        this.invitedUserIds = [...this.invitedUserIds, userId];
      }
    },
    shuffleSeats() {
      const ids = [...this.invitedUserIds];
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      this.invitedUserIds = ids;
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
        const myName =
          this.users.find((u) => u.id === this.myUserId)?.display_name ?? (this.session as any).user?.email ?? "Host";
        const seats = this.form.testGame
          ? Array.from({ length: this.form.playerCount }, (_, i) => ({
              userId: this.myUserId,
              name: `Player ${i + 1}`,
            }))
          : [
              { userId: this.myUserId, name: myName },
              ...this.invitedUserIds.map((id) => ({
                userId: id,
                name: this.users.find((u) => u.id === id)?.display_name ?? "",
              })),
            ];
        const params = buildCreateGameParams(
          { playerCount: this.form.playerCount, seats, auctionVariant: this.form.auctionVariant },
          this.currentSeed,
          this.currentRotateMove
        );
        const { data, error } = await (this.client as any).rpc("create_game", params);
        if (error) {
          throw new Error(error.message);
        }
        window.location.search = `?game=${data}`;
      } catch (err) {
        this.message = `Could not create the game: ${err instanceof Error ? err.message : err}`;
        this.creating = false;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.create-game-section {
  margin-bottom: 0.9rem;
}

.create-game-section__label {
  margin-bottom: 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5b657a;
}

.create-game-section--preview {
  margin-bottom: 5rem;
}

.create-game-sticky-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  padding: 0.7rem 0 calc(0.7rem + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 28%, #fff 100%);
}

.create-game-sticky-bar__reason {
  margin-bottom: 0.35rem;
}

@media (max-width: 767px) {
  .create-game-sticky-bar {
    margin: 0 -0.5rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
}
</style>
