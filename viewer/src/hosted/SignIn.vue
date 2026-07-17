<template>
  <div class="container py-5" style="max-width: 30rem">
    <h3 class="sign-in-title">GP: Fight Club</h3>
    <p class="text-muted">Sign in once on this device and you stay signed in.</p>
    <b-button block variant="primary" :disabled="busy" @click="google">Sign in with Google</b-button>
    <hr />
    <p class="text-muted small mb-1">No Google account on this email? Get a one-time sign-in link instead.</p>
    <b-form @submit.prevent="submit">
      <b-form-input v-model="email" type="email" required placeholder="you@example.com" autocomplete="email" />
      <b-button class="mt-2" type="submit" variant="outline-primary" :disabled="busy || !email"
        >Send sign-in link</b-button
      >
    </b-form>
    <b-alert class="mt-3" :show="!!message" variant="info">{{ message }}</b-alert>
    <hr />
    <a href="?offline=1" class="btn btn-outline-success btn-block">Play offline on this device</a>
    <p class="text-muted small mt-2 mb-0">No account or connection is needed for pass-and-play.</p>
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
    async google() {
      this.busy = true;
      this.message = "";
      // Redirect flow: the browser leaves for Google and comes back to this
      // exact URL, where detectSessionInUrl completes the session.
      const { error } = await (this.client as any).auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href },
      });
      if (error) {
        this.message = `Could not start Google sign-in: ${error.message}`;
        this.busy = false;
      }
    },
    async submit() {
      this.busy = true;
      this.message = "";
      const { error } = await (this.client as any).auth.signInWithOtp({
        email: this.email,
        options: { emailRedirectTo: window.location.href },
      });
      this.message = error
        ? `Could not send the link: ${error.message}`
        : `Sign-in link sent to ${this.email} - open it on this device, then come back here.`;
      this.busy = false;
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
