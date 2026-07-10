<template>
  <div class="credits-content">
    <section class="credits-content__section">
      <h5>boardgamers.space</h5>
      <p class="text-muted small mb-1">
        Built on the open-source
        <a href="https://github.com/boardgamers/gaia-project" target="_blank" rel="noopener noreferrer"
          >boardgamers/gaia-project</a
        >
        engine and viewer, from
        <a href="https://www.boardgamers.space" target="_blank" rel="noopener noreferrer">boardgamers.space</a>, used
        and modified under its MIT License.
      </p>
      <ul class="credits-content__list">
        <li>Copyright &copy; the boardgamers/gaia-project contributors</li>
        <li>Licensed under the MIT License</li>
      </ul>
    </section>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "CreditsContent",
});
</script>

<style lang="scss" scoped>
.credits-content__section {
  margin-bottom: 0.6rem;

  h5 {
    margin-bottom: 0.2rem;
    font-size: 0.95rem;
  }
}

.credits-content__list {
  margin: 0;
  padding-left: 1.1rem;
}
</style>
