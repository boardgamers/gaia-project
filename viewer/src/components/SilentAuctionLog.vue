<template>
  <section class="silent-auction-log" aria-labelledby="silent-auction-heading">
    <header v-if="!hideTitle" class="silent-auction-log__header">
      <div>
        <span class="silent-auction-log__eyebrow">Setup complete</span>
        <h2 id="silent-auction-heading">Auction summary</h2>
      </div>
      <div class="silent-auction-log__metrics" aria-label="Auction totals">
        <span
          ><strong>{{ gameData.players.length }}</strong> players</span
        >
        <span
          ><strong>{{ gameData.silentAuctionBids.length }}</strong> bids</span
        >
        <span
          ><strong>{{ steps.length }}</strong> turns</span
        >
      </div>
    </header>

    <section class="auction-section auction-section--results" aria-labelledby="auction-results-heading">
      <div class="auction-section__heading">
        <div>
          <span class="auction-section__eyebrow">Final lineup</span>
          <h3 id="auction-results-heading">Turn order &amp; winning factions</h3>
        </div>
        <span class="auction-section__hint">Price paid in victory points</span>
      </div>

      <ol class="auction-results" aria-label="Final auction turn order">
        <li
          v-for="result in results"
          :key="result.faction"
          class="auction-result-card"
          :style="{ '--auction-accent': result.color }"
          :data-turn-order="result.turnOrder"
        >
          <span class="auction-result-card__rank" :aria-label="`Turn order ${result.turnOrder}`">
            {{ result.turnOrder }}
          </span>
          <span class="auction-result-card__swatch" aria-hidden="true"></span>
          <span class="auction-result-card__identity">
            <strong>{{ result.factionLabel }}</strong>
            <small>{{ result.winner }}</small>
          </span>
          <span class="auction-result-card__price">
            <strong>{{ result.price }}</strong>
            <small>VP</small>
          </span>
        </li>
      </ol>
    </section>

    <div class="auction-details-grid">
      <section class="auction-section auction-draft" aria-labelledby="auction-draft-heading">
        <div class="auction-section__heading">
          <div>
            <span class="auction-section__eyebrow">Opening round</span>
            <h3 id="auction-draft-heading">Picks &amp; Bans</h3>
          </div>
        </div>

        <ul class="auction-draft__list">
          <li v-for="row in draftRows" :key="row.player" class="auction-draft__row">
            <span class="auction-draft__seat">P{{ row.seat }}</span>
            <strong class="auction-draft__player">{{ row.player }}</strong>
            <span class="auction-draft__choice">
              <small>Picked</small>
              <strong>{{ row.pick }}</strong>
            </span>
            <span class="auction-draft__choice auction-draft__choice--ban">
              <small>Banned</small>
              <strong>{{ row.ban }}</strong>
            </span>
          </li>
        </ul>
      </section>

      <section class="auction-section auction-bids" aria-labelledby="auction-bids-heading">
        <div class="auction-section__heading">
          <div>
            <span class="auction-section__eyebrow">Private maximums</span>
            <h3 id="auction-bids-heading">Submitted Bids</h3>
          </div>
          <span class="auction-section__hint">Winner highlighted</span>
        </div>

        <div class="auction-bids__scroll">
          <table>
            <caption class="sr-only">
              Maximum victory-point bids submitted by each player for each faction
            </caption>
            <thead>
              <tr>
                <th scope="col">Faction</th>
                <th v-for="player in bidPlayers" :key="player.player" scope="col">{{ player.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in bidRows" :key="row.faction">
                <th scope="row">
                  <span class="auction-bids__faction" :style="{ '--auction-accent': row.color }">
                    <span aria-hidden="true"></span>{{ row.factionLabel }}
                  </span>
                </th>
                <td
                  v-for="bid in row.bids"
                  :key="bid.player"
                  :class="{ 'auction-bids__winner': bid.winner }"
                  :aria-label="bid.winner ? `${bid.value}, winning bid` : String(bid.value)"
                >
                  {{ bid.value }}<span v-if="bid.winner" aria-hidden="true">&#10003;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="auction-section auction-resolution" aria-labelledby="auction-resolution-heading">
      <div class="auction-section__heading">
        <div>
          <span class="auction-section__eyebrow">How it resolved</span>
          <h3 id="auction-resolution-heading">Resolution trail</h3>
        </div>
        <span class="auction-section__hint">Every turn, in order</span>
      </div>

      <ol class="auction-resolution__grid">
        <li v-for="step in steps" :key="step.step" class="auction-resolution__step">
          <span class="auction-resolution__number">{{ step.step }}</span>
          <span class="auction-resolution__copy">
            <strong>{{ step.player }}</strong>
            <span>{{ step.skipped ? "held" : "bid on" }}</span>
            <strong>{{ step.faction }}</strong>
          </span>
          <span :class="['auction-resolution__price', { 'auction-resolution__price--held': step.skipped }]">
            {{ step.skipped ? "Held" : `${step.price} VP` }}
          </span>
          <small v-if="step.tiebreak" class="auction-resolution__tiebreak"> {{ step.tiebreak }} tiebreak </small>
        </li>
      </ol>
    </section>
  </section>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import Engine, { Faction, PlayerEnum } from "@gaia-project/engine";
import { factionName } from "../data/factions";
import { factionColor } from "../graphics/utils";

@Component
export default class SilentAuctionLog extends Vue {
  /** The post-auction summary's modal already supplies its own title. */
  @Prop({ default: false, type: Boolean })
  hideTitle: boolean;

  get gameData(): Engine {
    return this.$store.state.data;
  }

  private playerLabel(player: PlayerEnum): string {
    const pl = this.gameData.players[player];
    return pl?.name || `Player ${player + 1}`;
  }

  private factionLabel(faction: Faction): string {
    return faction ? factionName(faction) : "-";
  }

  get draftRows() {
    return this.gameData.players.map((player, index) => ({
      seat: index + 1,
      player: this.playerLabel(player.player as PlayerEnum),
      pick: this.factionLabel(this.gameData.setup[index]),
      ban: this.factionLabel(this.gameData.bannedFactions[index]),
    }));
  }

  get bidPlayers() {
    return this.gameData.players.map((player) => ({
      player: player.player,
      label: this.playerLabel(player.player as PlayerEnum),
    }));
  }

  get bidRows() {
    return this.gameData.setup.map((faction) => {
      const winner = this.gameData.players.find((player) => player.faction === faction);

      return {
        faction,
        factionLabel: this.factionLabel(faction),
        color: factionColor(faction),
        bids: this.gameData.players.map((player) => {
          const bid = this.gameData.silentAuctionBids.find(
            (entry) => entry.player === player.player && entry.faction === faction
          );

          return {
            player: player.player,
            value: bid?.max ?? "-",
            winner: winner?.player === player.player,
          };
        }),
      };
    });
  }

  get steps() {
    return this.gameData.silentAuctionLog.map((step, index) => ({
      step: index + 1,
      player: this.playerLabel(step.player),
      faction: this.factionLabel(step.faction),
      price: step.price,
      skipped: step.skipped,
      tiebreak: step.tiebreak,
    }));
  }

  get results() {
    // turnOrderAfterSetupAuction is built by mapping `setup` in order to each faction's current
    // owner, so the Nth faction in `setup` always corresponds to the Nth turn-order slot.
    return this.gameData.setup.map((faction, index) => {
      const winner = this.gameData.players.find((player) => player.faction === faction);

      return {
        faction,
        factionLabel: this.factionLabel(faction),
        color: factionColor(faction),
        winner: winner ? this.playerLabel(winner.player as PlayerEnum) : "-",
        price: winner ? winner.data.bid : "-",
        turnOrder: index + 1,
      };
    });
  }
}
</script>

<style lang="scss">
.silent-auction-log {
  color: var(--ui-text);
  background: var(--ui-surface) !important;
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 0.75rem 2rem var(--ui-shadow-soft);
}

.silent-auction-log__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  color: var(--ui-banner-text);
  background: linear-gradient(125deg, var(--ui-banner-start), var(--ui-banner-end));

  h2 {
    margin: 0.05rem 0 0;
    font-size: 1.1rem;
    font-weight: 750;
    letter-spacing: -0.01em;
  }
}

.silent-auction-log__eyebrow,
.auction-section__eyebrow {
  display: block;
  font-size: 0.63rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  line-height: 1.2;
  text-transform: uppercase;
}

.silent-auction-log__eyebrow {
  color: var(--ui-banner-link);
}

.silent-auction-log__metrics {
  display: flex;
  gap: 0.4rem;

  span {
    display: flex;
    align-items: baseline;
    gap: 0.22rem;
    padding: 0.3rem 0.48rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    color: var(--ui-banner-link);
    font-size: 0.7rem;
    line-height: 1;
  }

  strong {
    color: var(--ui-banner-text);
    font-size: 0.8rem;
  }
}

.auction-section {
  min-width: 0;
  padding: 0.9rem 1rem;
}

.auction-section + .auction-section,
.auction-resolution {
  border-top: 1px solid var(--ui-border);
}

.auction-section__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;

  h3 {
    margin: 0.12rem 0 0;
    font-size: 0.91rem;
    font-weight: 750;
  }
}

.auction-section__eyebrow {
  color: var(--ui-text-subtle);
}

.auction-section__hint {
  color: var(--ui-text-subtle);
  font-size: 0.68rem;
  white-space: nowrap;
}

.auction-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.55rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.auction-result-card {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  background: linear-gradient(135deg, var(--ui-surface-raised), var(--ui-surface-muted));
  border: 1px solid var(--ui-border);
  border-radius: 0.55rem;
  box-shadow: inset 0 2px 0 var(--auction-accent);
}

.auction-result-card__rank {
  display: grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  font-size: 0.72rem;
  font-weight: 800;
}

.auction-result-card__swatch {
  width: 0.68rem;
  height: 0.68rem;
  background: var(--auction-accent);
  border: 1px solid rgba(0, 0, 0, 0.28);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--ui-surface);
}

.auction-result-card__identity,
.auction-result-card__price {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.auction-result-card__identity {
  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 0.86rem;
  }

  small {
    color: var(--ui-text-muted);
    font-size: 0.67rem;
  }
}

.auction-result-card__price {
  align-items: flex-end;
  padding-left: 0.55rem;
  border-left: 1px solid var(--ui-border);

  strong {
    font-size: 1rem;
    line-height: 1;
  }

  small {
    margin-top: 0.12rem;
    color: var(--ui-text-subtle);
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
}

.auction-details-grid {
  display: grid;
  grid-template-columns: minmax(19rem, 0.9fr) minmax(23rem, 1.1fr);
  border-top: 1px solid var(--ui-border);
}

.auction-details-grid > .auction-section {
  border-top: 0;
}

.auction-details-grid > .auction-section + .auction-section {
  border-left: 1px solid var(--ui-border);
}

.auction-draft__list {
  display: grid;
  gap: 0.35rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.auction-draft__row {
  display: grid;
  grid-template-columns: auto minmax(4.8rem, 1fr) minmax(5rem, 1fr) minmax(5rem, 1fr);
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.42rem 0.5rem;
  background: var(--ui-surface-muted);
  border-radius: 0.42rem;
}

.auction-draft__seat {
  color: var(--ui-text-subtle);
  font-size: 0.63rem;
  font-weight: 800;
}

.auction-draft__player {
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.auction-draft__choice {
  display: flex;
  flex-direction: column;
  min-width: 0;

  small {
    color: var(--ui-text-subtle);
    font-size: 0.57rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  strong {
    overflow: hidden;
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.auction-draft__choice--ban strong {
  color: var(--ui-danger);
  font-weight: 650;
}

.auction-bids__scroll {
  overflow-x: auto;
  border: 1px solid var(--ui-border);
  border-radius: 0.45rem;
}

.auction-bids table {
  width: 100%;
  min-width: 24rem;
  margin: 0;
  color: var(--ui-text);
  border-collapse: collapse;
  font-size: 0.72rem;

  th,
  td {
    padding: 0.4rem 0.48rem;
    border-bottom: 1px solid var(--ui-border);
  }

  thead th {
    color: var(--ui-text-muted);
    background: var(--ui-surface-muted);
    font-size: 0.63rem;
    font-weight: 750;
    text-align: center;
  }

  thead th:first-child,
  tbody th {
    text-align: left;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody th {
    font-weight: 700;
  }

  td {
    min-width: 4rem;
    color: var(--ui-text-muted);
    text-align: center;
  }
}

.auction-bids__faction {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  > span {
    width: 0.48rem;
    height: 0.48rem;
    flex: 0 0 auto;
    background: var(--auction-accent);
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 50%;
  }
}

.auction-bids td.auction-bids__winner {
  color: var(--ui-success-text);
  background: var(--ui-success-bg);
  font-weight: 800;

  span {
    margin-left: 0.25rem;
    color: var(--ui-success);
    font-size: 0.65rem;
  }
}

.auction-resolution__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.36rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.auction-resolution__step {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 0.45rem;
  min-width: 0;
  min-height: 2.4rem;
  padding: 0.4rem 0.5rem;
  background: var(--ui-surface-muted);
  border: 1px solid transparent;
  border-radius: 0.4rem;
}

.auction-resolution__number {
  color: var(--ui-text-subtle);
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.auction-resolution__copy {
  display: flex;
  flex-wrap: wrap;
  column-gap: 0.22rem;
  min-width: 0;
  font-size: 0.67rem;

  span {
    color: var(--ui-text-subtle);
  }
}

.auction-resolution__price {
  color: var(--ui-text);
  font-size: 0.67rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  white-space: nowrap;
}

.auction-resolution__price--held {
  color: var(--ui-text-subtle);
  font-weight: 650;
}

.auction-resolution__tiebreak {
  grid-column: 2 / -1;
  color: var(--ui-warning);
  font-size: 0.57rem;
  font-weight: 700;
}

@media (max-width: 880px) {
  .auction-details-grid {
    grid-template-columns: 1fr;
  }

  .auction-details-grid > .auction-section + .auction-section {
    border-top: 1px solid var(--ui-border);
    border-left: 0;
  }
}

@media (max-width: 560px) {
  .silent-auction-log__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .silent-auction-log__metrics {
    width: 100%;

    span {
      flex: 1 1 0;
      justify-content: center;
    }
  }

  .auction-section {
    padding: 0.78rem;
  }

  .auction-section__hint {
    display: none;
  }

  .auction-results,
  .auction-resolution__grid {
    grid-template-columns: 1fr;
  }

  .auction-draft__row {
    grid-template-columns: auto minmax(3.6rem, 1fr) minmax(3.4rem, 0.85fr) minmax(4rem, 1fr);
    gap: 0.35rem;
  }
}
</style>
