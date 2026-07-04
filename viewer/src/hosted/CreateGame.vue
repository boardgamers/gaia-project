<template>
  <div class="container py-4" style="max-width: 46rem">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3 class="mb-0">New game</h3>
      <a href="?lobby=1" class="btn btn-outline-secondary btn-sm">← Back to lobby</a>
    </div>
    <b-alert :show="!!message" variant="info" dismissible @dismissed="message = ''">{{ message }}</b-alert>

    <b-form @submit.prevent="createGame">
      <b-form-group label="Players">
        <b-button-group>
          <b-button
            v-for="count in [2, 3, 4]"
            :key="count"
            :variant="form.playerCount === count ? 'primary' : 'outline-secondary'"
            @click="setPlayerCount(count)"
            >{{ count }}</b-button
          >
        </b-button-group>
      </b-form-group>

      <b-form-checkbox v-model="form.testGame" class="mb-2">
        Test game — I control all seats
        <span class="text-muted small">(hot-seat; handy for trying out mechanics solo)</span>
      </b-form-checkbox>

      <template v-if="!form.testGame">
        <b-form-group :label="`Invite ${form.playerCount - 1} more player(s)`">
          <div v-if="loadingUsers" class="text-muted small">Loading registered players…</div>
          <div v-else-if="invitableUsers.length === 0" class="text-muted small">
            No other registered players yet — they need to sign in to the site once first.
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
        </b-form-group>
        <b-button
          variant="outline-secondary"
          size="sm"
          class="mb-3"
          :disabled="invitedUserIds.length === 0"
          @click="shuffleSeats"
          >Shuffle seat order</b-button
        >
      </template>

      <b-form-group label="Faction selection">
        <b-form-radio
          v-for="option in auctionVariantOptions"
          :key="option.value"
          v-model="form.auctionVariant"
          :value="option.value"
        >
          {{ option.label }}
          <span class="text-muted small d-block">{{ option.description }}</span>
        </b-form-radio>
      </b-form-group>

      <h6 class="mt-3">Setup preview</h6>
      <p class="text-muted small mb-2">
        Reroll until you like the map, then click sectors to rotate them. Whatever's shown becomes the game when you
        click "Create game" below.
      </p>
      <SetupPreview :player-count="form.playerCount" @update="onSetupUpdate" />

      <div>
        <b-button type="submit" variant="primary" :disabled="creating || !canCreate">Create game</b-button>
        <span v-if="!canCreate" class="text-muted small ml-2">{{ blockedReason }}</span>
      </div>
    </b-form>
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
      // Continuously updated by SetupPreview's "update" event (no separate
      // lock-in step) - whatever's current here at "Create game" click time
      // is what gets created.
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
        return "Fix the invalid setup above first";
      }
      return `Invite ${this.form.playerCount - 1} more player(s) above first`;
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
      // SetupPreview itself rerolls to a fresh seed on a player-count change
      // and immediately re-emits "update" with it - no need to clear here.
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
    async createGame() {
      if (!this.canCreate) {
        return;
      }
      this.creating = true;
      this.message = "";
      try {
        const myName = this.users.find((u) => u.id === this.myUserId)?.display_name ?? (this.session as any).user?.email ?? "Host";
        // Test games: every seat is the creator, played hot-seat.
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
