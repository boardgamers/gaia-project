<template>
  <div v-if="isLostFleet" class="lost-fleet-action-row">
    <div class="lost-fleet-action-row__groups">
      <section v-for="ship in ships" :key="ship" class="lost-fleet-action-row__group" :data-ship="ship">
        <header class="lost-fleet-action-row__group-head">
          <div class="lost-fleet-action-row__group-title">
            <span class="lost-fleet-ship-marker" :data-marker="shipMarker(ship)">{{ shipMarker(ship) }}</span>
            <div>
              <div class="lost-fleet-action-row__eyebrow">{{ shipLabel(ship) }}</div>
              <div class="lost-fleet-action-row__title">{{ shipName(ship) }}</div>
            </div>
          </div>
          <div class="lost-fleet-action-row__slots">
            <span
              v-for="slot in explorationSlots(ship)"
              :key="slot.index"
              class="lost-fleet-action-row__slot"
              :class="{ 'lost-fleet-action-row__slot--occupied': !!slot.player }"
              :data-slot="slot.index"
              :style="slotStyle(slot.player)"
              :title="slotTitle(slot)"
            />
          </div>
        </header>

        <div class="lost-fleet-action-row__actions">
          <div
            v-for="action in shipActions(ship)"
            :key="action.type"
            class="lost-fleet-action-row__action"
            :data-action="action.type"
            :title="`${shipName(ship)}: ${action.effect}`"
          >
            <svg width="56" height="56" viewBox="-28 -28 56 56" style="overflow: visible">
              <g :class="['lost-fleet-board-action', action.type, { faded: actionUser(ship, action.type) != null }]">
                <SpecialAction
                  :class="{ faded: actionUser(ship, action.type) != null }"
                  :action="actionIncome(ship, action.type)"
                  :board="true"
                  x="-20"
                  y="-25"
                  width="40"
                />
                <g transform="translate(-15,-15)">
                  <rect
                    x="-8"
                    y="-8"
                    width="16"
                    height="16"
                    :rx="action.type === 'power' ? 8 : 0"
                    :ry="action.type === 'power' ? 8 : 0"
                    :fill="badgeColor(action.type)"
                    stroke="black"
                    stroke-width="1"
                    transform="scale(0.8)"
                  />
                  <text x="-3" y="3.5" class="lost-fleet-board-action__cost">
                    {{ actionCostNumber(action.cost) }}
                  </text>
                </g>
                <g v-if="actionUser(ship, action.type) != null">
                  <line y1="-11" y2="11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
                  <line y1="11" y2="-11" x1="-11" x2="11" stroke="#333" stroke-width="5" />
                </g>
              </g>
            </svg>
            <div class="lost-fleet-action-row__ship-name">{{ shipName(ship) }}</div>
            <div class="lost-fleet-action-row__label">{{ actionLabel(ship, action.type) }}</div>
            <div class="lost-fleet-action-row__state">{{ actionState(ship, action.type) }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { Component } from "vue-property-decorator";
import Engine, {
  Expansion,
  Faction,
  hasExpansion,
  Player,
  Spaceship,
} from "@gaia-project/engine";
import { Player as PlayerEnum } from "@gaia-project/engine/src/enums";
import {
  EXPLORATION_CHARGE_TRACK,
  spaceshipActionEffects,
  spaceshipBoards,
  SpaceshipActionType,
  shipsInPlay,
} from "@gaia-project/engine/src/spaceships";
import { factionColor, factionLogTextColors } from "../graphics/utils";
import SpecialAction from "./SpecialAction.vue";

const spaceshipNames: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Twilight",
  [Spaceship.Rebellion]: "Rebellion",
  [Spaceship.TFMars]: "T F Mars",
  [Spaceship.Eclipse]: "Eclipse",
};

const spaceshipLabels: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "Nautilaks",
  [Spaceship.Rebellion]: "Vo'Kron",
  [Spaceship.TFMars]: "Gaia Federation",
  [Spaceship.Eclipse]: "Eridani Empire",
};

const spaceshipMarkers: Record<Spaceship, string> = {
  [Spaceship.Twilight]: "T",
  [Spaceship.Rebellion]: "R",
  [Spaceship.TFMars]: "M",
  [Spaceship.Eclipse]: "E",
};

@Component({
  components: {
    SpecialAction,
  },
})
export default class LostFleetShipActionsRow extends Vue {
  get engine(): Engine {
    return this.$store.state.data;
  }

  get isLostFleet(): boolean {
    return hasExpansion(this.engine.expansions, Expansion.LostFleet);
  }

  get ships(): Spaceship[] {
    return shipsInPlay(this.engine.expansions, this.engine.players.length);
  }

  shipName(ship: Spaceship): string {
    return spaceshipNames[ship];
  }

  shipLabel(ship: Spaceship): string {
    return spaceshipLabels[ship];
  }

  shipMarker(ship: Spaceship): string {
    return spaceshipMarkers[ship];
  }

  shipActions(ship: Spaceship) {
    return spaceshipBoards[ship].actions;
  }

  actionIncome(ship: Spaceship, type: SpaceshipActionType): string[] {
    return spaceshipActionEffects[ship]?.[type] ?? [];
  }

  actionUser(ship: Spaceship, type: SpaceshipActionType): Player | null {
    const player = this.engine.spaceshipActions[ship]?.[type];
    return player === undefined ? null : this.engine.player(player as PlayerEnum);
  }

  actionState(ship: Spaceship, type: SpaceshipActionType): string {
    const player = this.actionUser(ship, type);
    return player ? `Used by ${player.name || `P${player.player + 1}`}` : "Ready";
  }

  actionCostNumber(cost: string): number {
    const match = /^(\d+)/.exec(cost);
    return match ? Number(match[1]) : 0;
  }

  actionLabel(ship: Spaceship, type: SpaceshipActionType): string {
    const labels: Record<Spaceship, Record<SpaceshipActionType, string>> = {
      [Spaceship.Twilight]: {
        qic: "Re-score",
        power: "Build Lab",
        knowledge: "+3 Range",
        credit: "",
      },
      [Spaceship.Rebellion]: {
        qic: "Tech Tile",
        power: "Build TS",
        knowledge: "2c + 1q",
        credit: "",
      },
      [Spaceship.TFMars]: {
        qic: "VP / Tech",
        power: "Gaiaform",
        knowledge: "",
        credit: "Terraform",
      },
      [Spaceship.Eclipse]: {
        qic: "VP / Type",
        power: "Research",
        knowledge: "",
        credit: "Asteroid",
      },
    };

    return labels[ship][type];
  }

  badgeColor(type: SpaceshipActionType): string {
    const colors: Record<SpaceshipActionType, string> = {
      qic: "green",
      power: "#984FF1",
      knowledge: "#3b82f6",
      credit: "#d6a23c",
    };
    return colors[type];
  }

  explorationSlots(ship: Spaceship): Array<{ index: number; cost: number; player: Player | null }> {
    return EXPLORATION_CHARGE_TRACK.map((cost, index) => ({
      index: index + 1,
      cost,
      player: this.engine.players.find((player) => player.data.explorationShips[ship] === index + 1) ?? null,
    }));
  }

  slotStyle(player: Player | null): string {
    if (!player?.faction) {
      return "";
    }

    return `--slot-bg:${factionColor(player.faction as Faction)}; --slot-ink:${factionLogTextColors[player.faction as Faction]};`;
  }

  slotTitle(slot: { index: number; cost: number; player: Player | null }): string {
    if (slot.player) {
      return `Slot ${slot.index}: ${slot.player.name || `P${slot.player.player + 1}`} (${slot.cost} power)`;
    }
    return `Slot ${slot.index}: Open (${slot.cost} power)`;
  }
}
</script>

<style lang="scss" scoped>
.lost-fleet-action-row__groups {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.lost-fleet-action-row__group {
  flex: 0 0 auto;
  padding: 0.6rem 0.7rem 0.65rem;
  border: 1px solid #ccd5e3;
  border-radius: 10px;
  background: white;
  box-shadow: 0 3px 10px rgb(23 46 98 / 7%);
}

.lost-fleet-action-row__group-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.lost-fleet-action-row__group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lost-fleet-ship-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  border: 1px solid #d8c57c;
  background: #efe6c4;
  color: #172e62;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 35%);
}

.lost-fleet-action-row__eyebrow {
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5f6773;
}

.lost-fleet-action-row__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-action-row__slots {
  display: flex;
  gap: 0.2rem;
  padding-top: 0.1rem;
}

.lost-fleet-action-row__slot {
  width: 0.85rem;
  height: 0.85rem;
  border: 1px solid #b8c2d4;
  border-radius: 999px;
  background: #eef2f8;
}

.lost-fleet-action-row__slot--occupied {
  background: var(--slot-bg);
  border-color: rgb(0 0 0 / 20%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 15%);
}

.lost-fleet-action-row__actions {
  display: flex;
  gap: 0.25rem;
}

.lost-fleet-action-row__action {
  width: 58px;
  text-align: center;
}

.lost-fleet-action-row__ship-name,
.lost-fleet-action-row__label,
.lost-fleet-action-row__state {
  line-height: 1.2;
}

.lost-fleet-action-row__ship-name {
  font-size: 0.62rem;
  font-weight: 700;
  color: #172e62;
}

.lost-fleet-action-row__label {
  min-height: 1.5rem;
  font-size: 0.62rem;
  color: #3c4a64;
}

.lost-fleet-action-row__state {
  min-height: 1.5rem;
  font-size: 0.58rem;
  color: #6a7280;
}

.lost-fleet-board-action__cost {
  fill: white;
  text-anchor: middle;
  dominant-baseline: middle;
  font-size: 12px;
  pointer-events: none;
}

.faded {
  opacity: 0.8;
}
</style>
