<template>
  <div class="container py-5" style="max-width: 30rem">
    <h3 class="sign-in-title">Gaia Project: The Lost Fleet</h3>
    <b-alert show variant="info">
      You're signed in as <strong>{{ email }}</strong>, but this app is private. The host still
      needs to approve your account before you can see or join any games.
    </b-alert>
    <p class="text-muted small">Ask the host to approve you, then reload this page.</p>
    <b-button variant="outline-secondary" :disabled="busy" @click="signOut">Sign out</b-button>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "HostedPendingApproval",
  props: {
    client: { type: Object, required: true },
    session: { type: Object, required: true },
  },
  data() {
    return { busy: false };
  },
  computed: {
    email(): string {
      return (this.session as any).user?.email ?? "";
    },
  },
  methods: {
    async signOut() {
      this.busy = true;
      await (this.client as any).auth.signOut();
      window.location.reload();
    },
  },
});
</script>

<style lang="scss" scoped>
.sign-in-title {
  font-family: "Cinzel", "Palatino Linotype", Georgia, serif;
  font-weight: 700;
  color: #17253d;
}
</style>
