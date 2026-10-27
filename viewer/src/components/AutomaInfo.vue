<template>
  <section class="automa-info" aria-label="Automa cards and faction">
    <header>
      <strong v-if="engine.ended">{{ result }}</strong>
      <strong v-else-if="passed">Passed</strong>
      <strong v-else-if="state.action"
        >{{ actionName }} <small>· Card {{ state.action }}</small></strong
      >
      <strong v-else>{{ engine.round ? "Ready for this round" : "Setting up" }}</strong>
      <span class="automa-difficulty"
        >{{ difficulty }}<template v-if="engine.round"> · {{ state.remaining }} cards left</template></span
      >
    </header>
    <p class="automa-ability">{{ ability }}</p>
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
  get difficulty() {
    return {
      automalein: "Automalein",
      automa: "Automa",
      automaechtig: "Automächtig",
      ultoma: "Ultoma",
      alptrauma: "Alptrauma",
    }[this.state.difficulty];
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
  get ability() {
    return {
      terrans:
        "Faction action: advance Gaia Project, then build a mine with range 4, preferring Transdim planets. Gain 2 VP.",
      xenos:
        "Faction action: build a mine with range 2, block one power/Q.I.C. action, gain 2 VP. Other power/Q.I.C. cards block two actions.",
      taklons:
        "Faction action: build a mine with range 3, preferring the closest planet to you. Block one power/Q.I.C. action and gain 2 VP.",
      "hadsch-hallas":
        "Faction action: upgrade, or build a mine with range 3 if no upgrade is possible. Gain 1 VP. Each Trading Station upgrade also scores 3 VP.",
      geodens:
        "Faction action: advance research, block one power/Q.I.C. action, gain 1 VP. Each new planet type also scores 2 VP.",
      firaks:
        "Faction action: upgrade, allowing a lab to become a Trading Station before the usual mine upgrade. Gain 2 VP. Each Research Lab upgrade also advances research.",
      itars: "Faction action: block two power/Q.I.C. actions and gain 4 VP.",
    }[this.player.faction];
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
.automa-difficulty,
.automa-discard,
small {
  opacity: 0.72;
  font-size: 0.9em;
}
.automa-ability {
  margin: 0.5rem 0;
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
