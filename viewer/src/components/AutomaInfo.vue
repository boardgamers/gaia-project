<template>
  <section class="player-info automa-info" aria-label="Automa opponent">
    <div class="automa-panel" :style="{ borderColor: color }">
      <header>
        <strong>Automa · {{ name }}</strong>
        <span class="automa-difficulty">{{ difficulty }}</span>
        <svg viewBox="-13 -13 26 26" width="38" height="38" :aria-label="`${player.data.victoryPoints} VP`">
          <Resource kind="vp" :count="player.data.victoryPoints" />
        </svg>
      </header>
      <p v-if="engine.ended" class="automa-result">{{ result }}</p>
      <div class="automa-turn" v-else-if="state.action || state.support">
        <span
          ><b>{{ passed ? "Passed" : actionName }}</b
          ><small v-if="state.action"> · Card {{ state.action }}</small></span
        >
        <span class="automa-difficulty">{{ state.remaining }} cards left</span>
      </div>
      <p v-else class="automa-difficulty">{{ engine.round ? "Ready for this round" : "Setting up" }}</p>
      <details>
        <summary>Cards &amp; faction</summary>
        <p class="automa-ability">{{ ability }}</p>
        <dl v-if="support" class="automa-card">
          <dt>Support card</dt>
          <dd>{{ support.id }}</dd>
          <dt>Range</dt>
          <dd>{{ support.range }}</dd>
          <dt>Final scoring tiebreaker</dt>
          <dd>{{ support.scoringFinalTiebreaker }}</dd>
          <dt>Direction</dt>
          <dd>
            {{ support.directionalSelection === "right-down" ? "Top left → bottom right" : "Bottom right → top left" }}
          </dd>
          <dt>Numbered choice</dt>
          <dd>
            {{ support.numberedSelectionCount }} from the {{ support.numberedSelection === "right" ? "left" : "right" }}
          </dd>
        </dl>
        <p v-if="state.discard.length" class="automa-difficulty">Earlier cards: {{ state.discard.join(", ") }}</p>
        <div class="automa-supply">
          <span v-for="building in buildings" :key="building" :title="`Remaining ${building}`">
            <svg viewBox="-6 -6 12 12" width="32" height="32">
              <Building :building="building" :faction="player.faction" />
            </svg>
            {{ player.maxBuildings(building) - player.data.buildings[building] }}
          </span>
          <span>{{ player.data.satellites }} satellites</span>
          <Booster v-if="player.data.tiles.booster" :booster="player.data.tiles.booster" width="35" height="70" />
        </div>
      </details>
    </div>
  </section>
</template>

<script lang="ts">
import type Engine from "@gaia-project/engine";
import { Building as BuildingEnum, Player } from "@gaia-project/engine";
import { cards } from "@gaia-project/engine/src/automa/cards";
import { Component, Prop, Vue } from "vue-property-decorator";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";
import Booster from "./Booster.vue";
import Building from "./Building.vue";
import Resource from "./Resource.vue";

@Component({ components: { Resource, Building, Booster } })
export default class AutomaInfo extends Vue {
  @Prop() player: Player;
  @Prop() engine: Engine;
  get name() {
    return factionName(this.player.faction);
  }
  get state() {
    return this.engine.automa;
  }
  get color() {
    return factionColor(this.player.faction);
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
    return this.engine.passedPlayers.includes(this.player.player);
  }
  get result() {
    const score = this.engine.players[0].data.victoryPoints - this.player.data.victoryPoints;
    return score > 0 ? "You win!" : score < 0 ? "Automa wins" : "Draw";
  }
  get buildings() {
    return [
      BuildingEnum.Mine,
      BuildingEnum.TradingStation,
      BuildingEnum.ResearchLab,
      BuildingEnum.Academy1,
      BuildingEnum.Academy2,
      BuildingEnum.PlanetaryInstitute,
    ];
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
.automa-panel {
  border: 1px solid;
  border-left-width: 4px;
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  margin-top: 0.5rem;
}
header,
.automa-turn,
.automa-supply {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}
header strong {
  flex: 1;
}
.automa-turn {
  justify-content: space-between;
  margin: 0.4rem 0 0.6rem;
}
.automa-difficulty,
small {
  opacity: 0.72;
  font-size: 0.9em;
}
summary {
  cursor: pointer;
  font-size: 0.9em;
}
.automa-ability {
  margin: 0.7rem 0;
}
.automa-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 1rem;
  font-size: 0.9em;
}
dd {
  margin: 0;
}
.automa-supply > span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}
.automa-result {
  font-weight: 600;
}
</style>
