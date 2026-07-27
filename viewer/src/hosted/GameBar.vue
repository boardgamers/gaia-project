<template>
  <a :href="href" class="text-body text-decoration-none flex-grow-1 game-bar__link">
    <span class="game-bar__identity">
      <span class="game-bar__round-slot">
        <span v-if="game.current_round != null" class="game-bar__round">R{{ game.current_round }}</span>
        <span
          v-else-if="game.status === 'open'"
          class="game-bar__seats"
          :title="`${claimedSeatsCount} of ${game.player_count} seats joined`"
          >{{ claimedSeatsCount }}/{{ game.player_count }}</span
        >
        <!-- What the pulse is actually asking for: one tiny glyph per sub-game waiting on this
             viewer (Gaia / chess / renju / whatever comes next). Directly under the round badge, so
             it reads as part of the same left-edge "state of this game" column. -->
        <span v-if="turnBadges.length > 0" class="game-bar__turn-kinds">
          <span
            v-for="badge in turnBadges"
            :key="badge.kind"
            class="game-bar__turn-kind"
            :class="`game-bar__turn-kind--${badge.kind}`"
            :title="badge.label"
            :aria-label="badge.label"
            >{{ badge.glyph }}</span
          >
        </span>
      </span>
      <span class="game-bar__copy">
        <span class="game-bar__title">
          <strong>{{ game.name || "Unnamed game" }}</strong>
          <span v-if="auctionLabelText" class="game-bar__tag">{{ auctionLabelText }}</span>
          <span v-if="game.options && game.options.banPhase" class="game-bar__tag">Ban Phase</span>
          <span v-if="game.options && game.options.officialCenterSectors" class="game-bar__tag">Sector 1-4</span>
          <span v-if="isTestGameRow" class="game-bar__tag">Test game</span>
          <span v-if="game.abandoned_at" class="game-bar__tag game-bar__tag--abandoned">Abandoned</span>
          <button
            v-if="isTestGameRow && game.created_by === myUserId"
            type="button"
            class="game-bar__delete-test-game"
            title="Delete this test game (immediate, no other players are in it)"
            @click.stop.prevent="$emit('delete-test-game', game)"
          >
            Delete
          </button>
        </span>
        <span v-if="isLive" class="game-bar__live"> <span class="game-bar__live-dot"></span>Live </span>
        <span v-if="summary" class="game-bar__summary text-muted small">
          <span v-if="age" class="game-bar__age">{{ age }}</span>
          {{ summary }}
        </span>
      </span>
    </span>
    <span
      v-if="playersWithSummaryList.length > 0"
      class="game-bar__players gaia-viewer-game"
      :class="{ 'game-bar__players--stacked': playersWithSummaryList.length >= 3 }"
    >
      <span v-for="(row, rowIndex) in playerRowsList" :key="`row-${rowIndex}`" class="game-bar__player-row">
        <span
          v-for="(player, index) in row"
          :key="player.seat"
          class="game-bar__player"
          :style="{ zIndex: String(row.length - index) }"
          :title="playerBarTitle(player)"
        >
          <span class="game-bar__avatar">
            <svg viewBox="-22 -22 44 44"><Token :faction="player.faction" /></svg>
            <span class="game-bar__initial">{{ factionInitial(player) }}</span>
            <span class="game-bar__presence" :class="`game-bar__presence--${playerPresence(player)}`"></span>
            <span class="game-bar__score" :class="{ 'game-bar__score--active': player.seat === game.current_seat }">
              {{ player.score != null ? player.score : "-" }}
            </span>
          </span>
        </span>
      </span>
    </span>
  </a>
</template>

<script lang="ts">
import Vue from "vue";
import Token from "../components/Token.vue";
import { isOnline, PresenceState } from "./presence";
import { pendingTurnBadges, TurnKindBadge } from "./turn-kinds";
import {
  auctionLabel,
  claimedSeats,
  factionInitial,
  isTestGame,
  moveAge,
  playerBarTitle,
  playerPresence,
  playerRows,
  playersWithSummary,
  summaryForGame,
} from "./game-bar";

/**
 * The single shared "what does a game look like in a list" component - used by both Lobby.vue's
 * own game list and GameNavPanel.vue's desktop-only in-game menu (owner request: the two must be
 * identical, and a change to one must apply to both). Purely presentational: navigation (`href`)
 * is computed internally since it's the same rule everywhere (open games preview, everything else
 * opens/switches to the real game), but anything a specific list needs to customize - intercepting
 * the click (swipe-cancel in Lobby, in-app switch in GameNavPanel), deleting a test game - is left
 * to the caller via a plain native click listener (`@click.native`) and the `delete-test-game`
 * event. Swipe-to-delete (admin-only) and its wrapping chrome are deliberately NOT part of this
 * component - that's an interaction affordance around the bar, not part of what the bar displays.
 */
export default Vue.extend({
  name: "GameBar",
  components: { Token },
  props: {
    game: { type: Object, required: true },
    gameHref: { type: String, default: "" },
    presenceState: { type: Object, default: () => ({}) },
    myUserId: { type: String, required: true },
    // Only needed to resolve a seat this viewer holds by invitation rather than by user_id (see
    // isMyTurn) - the offline game list has neither and simply never shows a turn badge.
    userEmail: { type: String, default: "" },
  },
  computed: {
    href(): string {
      if (this.gameHref) {
        return this.gameHref;
      }
      return this.game.status === "open" ? `?preview=${this.game.id}` : `?game=${this.game.id}`;
    },
    claimedSeatsCount(): number {
      return claimedSeats(this.game);
    },
    // Computed here rather than passed in, so both game lists label the pulse identically for free
    // (the same reason `href` is computed internally). The wrapper class that actually pulses still
    // belongs to each caller, since it sits on their own row element - both derive it from the same
    // turn-kinds module.
    turnBadges(): TurnKindBadge[] {
      return pendingTurnBadges(this.game, this.myUserId, this.userEmail);
    },
    auctionLabelText(): string {
      return auctionLabel(this.game);
    },
    isTestGameRow(): boolean {
      return isTestGame(this.game);
    },
    summary(): string | null {
      return summaryForGame(this.game);
    },
    age(): string | null {
      return moveAge(this.game);
    },
    playersWithSummaryList(): any[] {
      return playersWithSummary(this.game);
    },
    playerRowsList(): any[][] {
      return playerRows(this.game);
    },
    // "Live" = every player in a game I'm in is online right now, so a real-time session is
    // possible. Only meaningful for an in-progress game with at least two seated players, and only
    // for games I'm actually in (matches the owner's "all players I'm in a game with, at once").
    // Offline lobby passes an empty presenceState, so this is always false there.
    isLive(): boolean {
      if (this.game.status !== "active") {
        return false;
      }
      const players = this.playersWithSummaryList;
      if (players.length < 2) {
        return false;
      }
      const iAmPlaying = !!this.myUserId && players.some((p: any) => p.user_id === this.myUserId);
      if (!iAmPlaying) {
        return false;
      }
      return players.every((p: any) => p.user_id && isOnline(this.presenceState as PresenceState, p.user_id));
    },
  },
  methods: {
    factionInitial,
    playerBarTitle,
    playerPresence(player: any): "green" | "yellow" | "grey" {
      return playerPresence(this.game, player, this.presenceState as PresenceState);
    },
  },
});
</script>

<!-- Deliberately global, not `scoped` - Vue's scoped CSS attaches to elements based on which
     component's template rendered them, not who uses that component as a child. The `.game-bar`/
     `.game-bar--my-turn` wrapper classes below are applied by EACH caller (Lobby.vue's own
     `<b-list-group-item>`, GameNavPanel.vue's own row wrapper) around this component, not by this
     component's own template - a scoped block here would never reach them. Global class names are
     the single source of truth both callers share, matching the owner's "any change to one affects
     both" requirement for how a game bar looks. -->
<style lang="scss">
.game-bar {
  min-height: 4.25rem;
  transition: transform 0.16s ease-out;
}

.game-bar--my-turn {
  animation: game-bar-my-turn-pulse 2s infinite;
}

// `inset`, not an outward ring: a bar's swipe-to-delete wrapper (Lobby.vue's `.game-swipe`) has
// `overflow: hidden`, which silently clips an outward box-shadow ring to nothing - the class/
// animation was applying correctly the whole time, it just had nowhere visible to render. An inset
// shadow stays within the bar's own box, so it can't be clipped by an ancestor either way.
@keyframes game-bar-my-turn-pulse {
  0% {
    box-shadow: inset 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
  50% {
    box-shadow: inset 0 0 0 3px rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgba(var(--highlighted-rgb, 32, 204, 68), 0.65);
  }
}

.game-bar__link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 100%;
}

.game-bar__identity {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1 1 auto;
}

.game-bar__round-slot {
  width: 2.35rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
}

// Deliberately tiny and unboxed (owner request: "a small icon somewhere subtle") - it labels the
// pulse, it isn't a second badge competing with the round pill above it. Sized in `em` off the
// row's own font so it scales with the rest of the bar.
.game-bar__turn-kinds {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  line-height: 1;
  color: rgb(var(--highlighted-rgb, 32, 204, 68));
}

.game-bar__turn-kind {
  font-size: 0.62rem;
  line-height: 1;
}

// The glyphs are drawn at whatever size their own font gives them, which is nowhere near uniform:
// nudge the two side-game marks so all three read as the same weight next to each other.
.game-bar__turn-kind--renju {
  font-size: 0.44rem;
}

.game-bar__turn-kind--chess {
  font-size: 0.72rem;
}

.game-bar__round {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ui-secondary-text);
  background: var(--ui-secondary-bg);
  border: 1px solid var(--ui-border);
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
}

// Same slot/shape as .game-bar__round (open games have no round yet, so that slot was just empty)
// - shows claimed/total seats instead, in the same green used for "it's this seat's turn" elsewhere
// in this bar (.game-bar__score--active), so a glance at the left edge tells you "in progress,
// round N" vs "still filling up, X of Y joined" consistently.
.game-bar__seats {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  background: #28a745;
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
}

.game-bar__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-bar__copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.05rem;
  min-width: 0;
}

.game-bar__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// The "Live" indicator is its own row directly under the game name (it lives inside the flex-column
// `.game-bar__copy`, so it only ever grows THAT column). The players/avatars column is centered on
// the bar independently (see `.game-bar__link` / `.game-bar__players`) and keeps its own position -
// this row never reflows the avatars.
.game-bar__live {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ui-success-text);
}

.game-bar__live-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #28a745;
  box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.65);
  animation: game-bar-live-pulse 1.8s infinite;
}

@keyframes game-bar-live-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.55);
  }
  70% {
    box-shadow: 0 0 0 0.4rem rgba(40, 167, 69, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(40, 167, 69, 0);
  }
}

.game-bar__age {
  margin-right: 0.35rem;
  font-weight: 700;
  color: var(--ui-text-muted);
}

.game-bar__tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 1.2rem;
  padding: 0.08rem 0.42rem;
  border-radius: 999px;
  background: var(--ui-secondary-bg);
  color: var(--ui-secondary-text);
  border: 1px solid var(--ui-border);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;

  &--abandoned {
    background: var(--ui-danger-bg);
    color: var(--ui-danger-text);
    border-color: var(--ui-danger-border);
  }
}

// A plain always-visible button rather than reusing the admin-only swipe-to-delete gesture (which
// is also explicitly disabled for mouse pointers) - this needs to work the same on desktop click
// and mobile tap for any player, not just the admin.
.game-bar__delete-test-game {
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  padding: 0.08rem 0.5rem;
  background: var(--ui-danger-bg);
  color: var(--ui-danger-text);
  border: 1px solid var(--ui-danger-border);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
}

.game-bar__players {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.18rem;
  flex-shrink: 0;
  margin-left: auto;
}

.game-bar__player-row {
  display: flex;
  align-items: center;
}

.game-bar__player {
  display: flex;
  align-items: center;
  padding: 0.1rem;
  position: relative;

  & + & {
    margin-left: 0.35rem;
  }
}

.game-bar__players--stacked {
  min-width: 3.35rem;
}

.game-bar__avatar {
  position: relative;
  display: inline-flex;
  width: 1.9rem;
  height: 1.9rem;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.game-bar__initial {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.85), 0 0 3px rgba(0, 0, 0, 0.85);
  pointer-events: none;
}

.game-bar__score {
  position: absolute;
  bottom: -0.3rem;
  right: -0.2rem;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background: #495057;
  border-radius: 0.6rem;
  padding: 0.15rem 0.25rem;
  min-width: 0.9rem;
  max-width: 1.5rem;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 0 0 1px var(--ui-surface);
  z-index: 1;

  &--active {
    background: #28a745;
  }
}

.game-bar__presence {
  position: absolute;
  top: -0.08rem;
  right: -0.02rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: 1px solid var(--ui-surface);
  box-shadow: 0 0 0 1px rgba(73, 80, 87, 0.12);

  &--green {
    background: #28a745;
  }

  &--yellow {
    background: #f1c40f;
  }

  &--grey {
    background: #95a5a6;
  }
}

// Applies whenever the bar's column is narrow enough to need it - a phone-width viewport (Lobby.vue)
// or GameNavPanel.vue's fixed-width desktop panel, which can be narrower than Lobby's own page
// column regardless of the overall window width.
@media (max-width: 767px) {
  .game-bar__title {
    white-space: normal;
  }

  .game-bar__summary {
    white-space: normal;
  }
}
</style>
