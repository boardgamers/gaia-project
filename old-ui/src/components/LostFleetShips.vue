<template>
  <div v-if="isLostFleet" class="lost-fleet-ships old-ships">
    <section v-for="ship in ships" :key="ship" class="lost-fleet-ship old-ship" :data-ship="ship">
      <header :style="{ background: shipColor(ship) }">
        <strong>{{ shipFullName(ship) }}</strong>
        <span class="old-ship-slots">
          <span
            v-for="slot in explorationSlots(ship)"
            :key="slot.index"
            v-b-tooltip
            :title="slotTitle(slot)"
            :class="{ occupied: !!slot.player }"
            >{{ slot.player ? "P" + (slot.player.player + 1) : slot.cost + "pw" }}</span
          >
        </span>
      </header>
      <div
        v-for="action in shipActions(ship)"
        :key="action.type"
        class="old-ship-action"
        :class="{ used: !!actionUser(ship, action.type) }"
        v-b-tooltip
        :title="actionTooltip(ship, action)"
      >
        <b>{{ action.cost }}</b
        ><span>{{ actionNotation(ship, action.type) }}</span>
      </div>
      <div class="old-ship-rewards">
        <FederationTile
          v-if="shipFederation(ship)"
          :spaceship-federation="shipFederation(ship)"
          :rewards-override="federationDisplayRewards(shipFederation(ship))"
          :num-tiles="1"
        />
        <TechTile v-if="hasTechSlot(ship)" :pos="ship" />
        <template v-else
          ><ArtifactIcon v-for="artifact in remainingArtifacts" :key="artifact" :artifact="artifact"
        /></template>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import { Spaceship } from "@gaia-project/engine";
import { Component } from "vue-property-decorator";
import CurrentShips from "../../../viewer/src/components/LostFleetShips.vue";
import ArtifactIcon from "./ArtifactIcon.vue";
import FederationTile from "./FederationTile.vue";
import TechTile from "./TechTile.vue";
@Component({ components: { FederationTile, TechTile, ArtifactIcon } })
export default class LostFleetShips extends CurrentShips {
  actionNotation(ship: Spaceship, type: string): string {
    const effects = this.actionIncome(ship, type as any);
    if (effects.length) return effects.join(",");
    const otherEffects = {
      [Spaceship.Twilight]: { power: "lab" },
      [Spaceship.Rebellion]: { power: "ts" },
      [Spaceship.TFMars]: { power: "instant-gaia", credit: "1step,mine" },
      [Spaceship.Eclipse]: { power: "up-research", credit: "asteroid mine" },
    };
    return otherEffects[ship][type];
  }
}
</script>
<style scoped>
.old-ships {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.old-ship {
  min-width: 0;
  background: white;
  color: #212529;
  border: 1px solid #444;
  font-size: 12px;
}
.old-ship header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
}
.old-ship-slots {
  display: flex;
  gap: 3px;
}
.old-ship-slots span {
  border: 1px solid #444;
  background: white;
  padding: 0 3px;
}
.old-ship-slots .occupied {
  font-weight: bold;
}
.old-ship-action {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 4px;
  padding: 4px;
  border-top: 1px solid #ccc;
}
.old-ship-action.used {
  opacity: 0.45;
}
.old-ship-rewards {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  border-top: 1px solid #ccc;
  padding: 4px;
}
@media (max-width: 900px) {
  .old-ships {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 480px) {
  .old-ships {
    grid-template-columns: 1fr;
  }
}
</style>
