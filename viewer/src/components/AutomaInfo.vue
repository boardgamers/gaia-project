<template>
  <section v-if="state.action || passed || engine.ended" class="automa-info" aria-label="Automa cards">
    <header>
      <strong v-if="engine.ended">{{ result }}</strong>
      <strong v-else-if="passed">Passed</strong>
      <strong v-else-if="state.action"
        >{{ actionName }} <small>· Card {{ state.action }}</small></strong
      >
      <span v-if="engine.round && !engine.ended" class="automa-remaining">{{ state.remaining }} cards left</span>
    </header>
    <dl v-if="support" class="automa-card">
      <div>
        <dt>Support card</dt>
        <dd>{{ support.id }}</dd>
      </div>
      <div>
        <dt>Range</dt>
        <dd>{{ support.range }}</dd>
      </div>
      <div>
        <dt>Final scoring tiebreaker</dt>
        <dd>{{ support.scoringFinalTiebreaker }}</dd>
      </div>
      <div>
        <dt>Direction</dt>
        <dd>
          {{ support.directionalSelection === "right-down" ? "Top left → bottom right" : "Bottom right → top left" }}
        </dd>
      </div>
      <div>
        <dt>Numbered choice</dt>
        <dd>
          {{ support.numberedSelectionCount }} from the {{ support.numberedSelection === "right" ? "left" : "right" }}
        </dd>
      </div>
    </dl>
    <p v-if="state.discard.length" class="automa-discard">Earlier cards: {{ state.discard.join(", ") }}</p>
  </section>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";

@Component
export default class AutomaInfo extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  get state() {
    return this.engine.automa;
  }
  get support() {
    return cards.find((c) => c.id === this.state.support);
  }
  get actionName() {
    const action = cards.find((c) => c.id === this.state.action)?.action;
    return (
      {
        "build-mine": "Build a mine",
        upgrade: "Upgrade",
        "power-qic": "Power / Q.I.C. action",
        "research-area-highest": "Advance highest research",
        "research-area-random": "Advance research",
        faction: "Faction action",
      }[action] ?? "Automa turn"
    );
  }
  get passed() {
    return (this.engine.passedPlayers ?? []).includes(this.player.player);
  }
  get result() {
    const score = this.engine.players[0].data.victoryPoints - this.player.data.victoryPoints;
    return score > 0 ? "You win!" : score < 0 ? "Automa wins" : "Draw";
  }
}
</script>

<style scoped>
.automa-info {
  max-width: 700px;
  margin-top: 0.6rem;
}
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 1rem;
  flex-wrap: wrap;
}
.automa-remaining,
.automa-discard,
small {
  opacity: 0.72;
  font-size: 0.9em;
}
.automa-card {
  display: flex;
  gap: 0.4rem 1.4rem;
  flex-wrap: wrap;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ui-border);
  margin-bottom: 0.5rem;
  font-size: 0.9em;
}
dt {
  font-weight: normal;
  opacity: 0.72;
}
dd {
  margin: 0;
}
.automa-discard {
  margin-bottom: 0;
}
</style>
