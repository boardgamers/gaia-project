<template>
  <b-modal v-if="open" :visible="open" @change="$emit('update:open', $event)" title="Automa cards" hide-footer>
    <div class="gaia-viewer-modal automa-details">
      <p v-if="state.difficulty !== 'automa'">{{ difficulty }}</p>
      <p v-if="engine.ended">
        <strong>{{ result }}</strong>
      </p>
      <p>
        Automa draws cards to choose its actions. BGS resolves them automatically. Its faction action happens whenever a
        card calls for it, even several times in a round.
      </p>
      <p v-if="engine.round">
        <strong>{{ state.remaining }} cards left.</strong> Automa can pass before the pile is empty.
      </p>
      <template v-if="lastActions.length">
        <strong>Last turn</strong>
        <ul>
          <li v-for="(action, i) in lastActions" :key="i">{{ describeAction(action) }}</li>
        </ul>
      </template>
      <details v-if="support">
        <summary>Decision details</summary>
        <p class="mt-2">
          These are references to the physical cards. The support card settles choices when several options are valid.
        </p>
        <dl>
          <dt>Cards</dt>
          <dd>Action: {{ state.action || "—" }} · Support: {{ support.id }}</dd>
          <dt>Mining range</dt>
          <dd>{{ support.range }} spaces, unless the faction action overrides it.</dd>
          <dt>Final scoring preference</dt>
          <dd>{{ scoringPreference }}</dd>
          <dt>Map search order</dt>
          <dd>
            {{ support.directionalSelection === "right-down" ? "Top left → bottom right" : "Bottom right → top left" }},
            when earlier choices are tied.
          </dd>
          <dt>Numbered selection</dt>
          <dd>
            Count {{ support.numberedSelectionCount }} available options from the
            {{ support.numberedSelection === "right" ? "left" : "right" }}; wrap around if needed.
          </dd>
        </dl>
        <p>Each action uses only the selection rules that apply to it.</p>
      </details>
      <a
        class="d-inline-block mt-3"
        href="https://www.feuerland-spiele.de/fileadmin/game/Gaia_Project/Gaia_Project_Automa_rules_EN_Web.pdf"
        target="_blank"
        rel="noopener noreferrer"
        >Automa rules (PDF)</a
      >
    </div>
  </b-modal>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import type { Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import { automaDifficulties, describeAutomaAction } from "../data/automa";

@Component
export default class AutomaInfo extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  @Prop({ default: false, type: Boolean }) open: boolean;
  describeAction = describeAutomaAction;
  get difficulty() {
    return automaDifficulties[this.state.difficulty];
  }
  get state() {
    return this.engine.automa;
  }
  get support() {
    return cards.find((c) => c.id === this.state.support);
  }
  get lastActions() {
    return this.state.action || (this.engine.passedPlayers ?? []).includes(this.player.player)
      ? (this.state.lastActions ?? [])
      : [];
  }
  get scoringPreference() {
    return this.support.scoringFinalTiebreaker === "none"
      ? "No final-scoring preference."
      : `Prefer planets that improve the ${this.support.scoringFinalTiebreaker} final-scoring tile, when applicable.`;
  }
  get result() {
    const score = this.engine.players[0].data.victoryPoints - this.player.data.victoryPoints;
    return score > 0 ? "You win!" : score < 0 ? "Automa wins" : "Draw";
  }
}
</script>

<style scoped>
summary {
  cursor: pointer;
}
dd {
  margin-bottom: 0.75rem;
}
</style>
