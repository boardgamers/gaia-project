<template>
  <div class="credits-content">
    <section class="credits-content__section">
      <h5>Gaia Project</h5>
      <p class="text-muted small mb-1">Original board game design and artwork</p>
      <ul class="credits-content__list">
        <li>Game design: Helge Ostertag &amp; Jens Drögemüller</li>
        <li>Artwork and graphics: Dennis Lohausen</li>
        <li>Published by Feuerland Spiele (Germany) and Rio Grande Games (North America)</li>
      </ul>
    </section>

    <section class="credits-content__section">
      <h5>Gaia Project &ndash; The Lost Fleet</h5>
      <p class="text-muted small mb-1">Expansion design and production, per the official rulebook's credits page</p>
      <ul class="credits-content__list">
        <li>Expansion design: Helge Ostertag &amp; Jens Drögemüller</li>
        <li>Artwork and graphics: Dennis Lohausen</li>
        <li>Rules written by Bastian Winkelhaus, with Stephan Rink, who also edited and produced the game</li>
        <li>
          Additional thanks (per the rulebook): Ursula Steinhoff (DTP), Translation Circus (translation &amp; additional
          DTP), Nathan Morse (proofreading), Christof Tisch &amp; Inga Keutmann (editorial support), the testing team,
          and the many playtesters credited in the rulebook.
        </li>
      </ul>
    </section>

    <section class="credits-content__section">
      <h5>This software</h5>
      <p class="text-muted small mb-1">
        Built on the open-source
        <a href="https://github.com/boardgamers/gaia-project" target="_blank" rel="noopener noreferrer"
          >boardgamers/gaia-project</a
        >
        engine and viewer, used and modified under its MIT License.
      </p>
      <ul class="credits-content__list">
        <li>Copyright &copy; the boardgamers/gaia-project contributors</li>
        <li>Licensed under the MIT License</li>
      </ul>
    </section>

    <p class="text-muted small credits-content__disclaimer">
      Gaia Project and Gaia Project &ndash; The Lost Fleet are the intellectual property of their respective designers
      and publisher. This is an unofficial, fan-made digital implementation.
    </p>
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
  margin-bottom: 1.1rem;

  &:last-of-type {
    margin-bottom: 0.6rem;
  }

  h5 {
    margin-bottom: 0.2rem;
    font-size: 0.95rem;
  }
}

.credits-content__list {
  margin: 0;
  padding-left: 1.1rem;
}

.credits-content__disclaimer {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 0.6rem;
  margin-bottom: 0;
}
</style>
