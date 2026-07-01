<template>
  <div class="container py-5" style="max-width: 30rem">
    <h3>Gaia Project — The Lost Fleet</h3>
    <p class="text-muted">Sign in with the email address your invite was sent to. You'll receive a one-time sign-in link — no password.</p>
    <b-form @submit.prevent="submit">
      <b-form-input v-model="email" type="email" required placeholder="you@example.com" autocomplete="email" />
      <b-button class="mt-2" type="submit" variant="primary" :disabled="busy || !email">Send sign-in link</b-button>
    </b-form>
    <b-alert class="mt-3" :show="!!message" variant="info">{{ message }}</b-alert>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "HostedSignIn",
  props: {
    client: { type: Object, required: true },
  },
  data() {
    return { email: "", message: "", busy: false };
  },
  methods: {
    async submit() {
      this.busy = true;
      this.message = "";
      const { error } = await (this.client as any).auth.signInWithOtp({
        email: this.email,
        options: { emailRedirectTo: window.location.href },
      });
      this.message = error
        ? `Could not send the link: ${error.message}`
        : `Sign-in link sent to ${this.email} — open it on this device, then come back here.`;
      this.busy = false;
    },
  },
});
</script>
