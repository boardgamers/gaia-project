import Vue from "vue";
import AdminUsers from "./hosted/AdminUsers.vue";
import { fetchMyApprovalStatus } from "./hosted/approval";
import { grantOfflineAccess } from "./hosted/offline-access";
import { createSupabaseChessBackend } from "./hosted/chess-backend";
import { createSupabaseRenjuBackend } from "./hosted/renju-backend";
import { createSupabaseUltimateTicTacToeBackend } from "./hosted/ultimate-tic-tac-toe-backend";
import Game from "./components/Game.vue";
import CreateGame from "./hosted/CreateGame.vue";
import ChatNotesPanel from "./hosted/ChatNotesPanel.vue";
import GameEntryNotice from "./hosted/GameEntryNotice.vue";
import GameNavPanel from "./hosted/GameNavPanel.vue";
import HostedBar from "./hosted/HostedBar.vue";
import ImportOfflineGame from "./hosted/ImportOfflineGame.vue";
import LobbyChatPanel from "./hosted/LobbyChatPanel.vue";
import NotificationSettings from "./hosted/NotificationSettings.vue";
import OpponentMovesNotice from "./hosted/OpponentMovesNotice.vue";
import { HostedGameHost, seatToLock } from "./hosted/host";
import {
  convertHostedGameToPassAndPlay,
  mirrorOfflineGameId,
  refreshHostedPassAndPlayFromOnline,
} from "./hosted/offline-mirror";
import { CancelTriggerKind, CancelTriggerLeechConfig } from "./hosted/types";
import { localChessLastMoveStorageKey, localChessStorageKey } from "./logic/chess";
import { localRenjuStorageKey } from "./logic/renju";
import { localUltimateStorageKey } from "./logic/ultimate-tic-tac-toe";
import { discardOfflineMinigameMirror } from "./logic/offline-minigame-sync";
import Lobby from "./hosted/Lobby.vue";
import OpenLobbyGame from "./hosted/OpenLobbyGame.vue";
import { syncPanelOpen } from "./hosted/panel-dock";
import PendingApproval from "./hosted/PendingApproval.vue";
import {
  backfillSubscriptionTimezone,
  currentPushEndpoint,
  isPushEnabled,
  setInAppGameNavigation,
} from "./hosted/push";
import { isActivelyFocused, isOnline, PresenceState, trackPresence, usersInGame } from "./hosted/presence";
import SignIn from "./hosted/SignIn.vue";
import { createSupabaseBackend, getSupabaseClient, subscribeMoves, SupabaseClient } from "./hosted/supabase-client";
import { setViewportZoomLocked } from "./hosted/viewport";
import launch from "./launcher";
import { parseAutoChargePreference } from "./logic/auto-decide";
import { retryWithBackoff } from "./logic/retry";

// The Supabase-hosted counterpart of self-contained.ts: instead of minting a
// fresh Engine per load, it boots a stored game (seed + committed move log),
// locks this browser session to the signed-in player's seat via the
// launcher's "player" event, and keeps the engine in sync over Realtime.

function mountChild(parent: Element, component: any, props: Record<string, unknown>): Vue {
  const el = document.createElement("div");
  parent.appendChild(el);
  return new Vue({ render: (h) => h(component, { props }) }).$mount(el);
}

/**
 * Mounts one game's whole chrome (top bar, engine/board tree, chat+notes) into `slot`, and returns
 * a `dispose()` that tears every bit of it back down again: Vue instances, Supabase realtime
 * channels, the seat-heartbeat interval, and the resync `visibilitychange` listener. Originally this
 * was `launchGame` itself, built to run exactly once per real page load with the browser tab's own
 * teardown doing the cleanup - the left-menu in-app game switch (GameNavPanel.vue, `launchGame`
 * below) needs to call it again without a reload, so every subscription/timer/listener it opens now
 * has to be closeable instead of leaking into the next game.
 */
async function mountGameInstance(
  root: Element,
  slot: Element,
  client: SupabaseClient,
  session: any,
  gameId: string,
  nav: any
): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  const barEl = document.createElement("div");
  // One joined recap of the opponents' turns since this viewer's previous turn. It shares the
  // game store mounted below, and sits immediately under HostedBar so three opponents never turn
  // into three separately dismissible notices in a four-player game.
  const opponentMovesNoticeEl = document.createElement("div");
  // Sits directly under the top banner (barEl) - a dismissible "X just entered the game" line shown
  // when another player opens this game while you're already in it (driven by the presence watcher
  // below). Its own element so it stays pinned under the bar, above the loading spinner/board.
  const entryNoticeEl = document.createElement("div");
  // Vue's initial `$mount(selector)` replaces the target element outright (attributes
  // and inline styles included), so hiding "#hosted-game" itself is a no-op once
  // launch() mounts onto it - the wrapper below is never touched by that replace and
  // is what actually stays hidden until the first real "state" arrives. Without it,
  // the store's placeholder Engine (empty moveHistory) renders Commands.vue's "pick
  // player count" init screen for the ~1s the Supabase fetch in host.load() takes.
  const gameWrapperEl = document.createElement("div");
  gameWrapperEl.style.display = "none";
  const gameEl = document.createElement("div");
  gameEl.id = "hosted-game";
  gameWrapperEl.appendChild(gameEl);
  const loadingEl = document.createElement("div");
  loadingEl.className = "text-muted text-center py-5";
  loadingEl.textContent = "Loading game…";
  slot.appendChild(barEl);
  slot.appendChild(opponentMovesNoticeEl);
  slot.appendChild(entryNoticeEl);
  slot.appendChild(loadingEl);
  slot.appendChild(gameWrapperEl);
  const entryNoticeRoot = new Vue({ render: (h) => h(GameEntryNotice) }).$mount(entryNoticeEl) as any;
  const entryNotice = entryNoticeRoot.$children[0] as any;

  // Created before `bar` so HostedBar.vue can embed <TurnOrder /> (PROGRESS.md Gaia 10) sharing
  // the SAME store as the Game tree below - TurnOrder
  // reads engine/presence state via `this.$store`, which only works if `bar`'s root Vue instance is
  // given this same store at construction (Vuex injects `$store` from the root's `store` option).
  const emitter = launch("#hosted-game", Game);
  const opponentMovesNoticeRoot = new Vue({
    store: emitter.store,
    render: (h) => h(OpponentMovesNotice),
  }).$mount(opponentMovesNoticeEl);
  emitter.once("ready", () => {
    loadingEl.remove();
    gameWrapperEl.style.display = "";
  });

  // Its own top-level mount (not folded into `bar`/HostedBar) - a fixed-position floating toggle +
  // overlay/dock, positioned independently of the rest of the chrome on every viewport (it
  // measures the mobile sticky action/premove bar's own live height itself to avoid overlapping
  // it - see ChatNotesPanel.vue's `startStickyBarWatch`), so it doesn't need to share HostedBar's
  // layout or store.
  const chatNotesRoot = mountChild(slot, ChatNotesPanel, { client, gameId, userId: session.user.id });
  const chatNotes = chatNotesRoot.$children[0] as any;

  // The Lost Fleet sidebar's yellow notes sheet (LostFleetNotes.vue, inside the viewer tree) reads and
  // writes the same per-game private notes the chat panel used to own - the `game_notes` table, one
  // row per (game, user). The viewer never touches Supabase itself; we inject this thin adapter into
  // its store so the sheet stays in sync across the player's devices. Self-contained play has no
  // backend and falls back to localStorage (see LostFleetNotes.vue).
  emitter.store.commit("setNotesBackend", {
    load: async (): Promise<string> => {
      const { data } = await (client as any)
        .from("game_notes")
        .select("body")
        .eq("game_id", gameId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      return data?.body ?? "";
    },
    save: async (body: string): Promise<void> => {
      const { error } = await (client as any).from("game_notes").upsert({
        game_id: gameId,
        user_id: session.user.id,
        body,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw error;
      }
    },
  });
  // ChessBoard.vue uses the same injection boundary as the notes sheet: the reusable viewer stays
  // unaware of Supabase, while hosted mode supplies a backend already scoped to this exact game.
  // Offline/self-contained stores leave this null and use per-game localStorage pass-and-play.
  const chessBackend = createSupabaseChessBackend(client, gameId, session.user.id);
  const renjuBackend = createSupabaseRenjuBackend(client, gameId, session.user.id);
  const ultimateBackend = createSupabaseUltimateTicTacToeBackend(client, gameId, session.user.id);
  emitter.store.commit("setChessBackend", chessBackend);
  // The research board's research/renju drawer uses the same injection boundary as the chess face.
  emitter.store.commit("setRenjuBackend", renjuBackend);
  // The ship-board drawer follows the same shared-online / local-offline boundary.
  emitter.store.commit("setUltimateTicTacToeBackend", ultimateBackend);
  // A converted pass-and-play game starts its three sidebar minigames from the positions currently
  // shown online. Only the positions are copied: account assignments and upload logs would lock the
  // offline boards to online players, contradicting pass-and-play.
  const offlineCopySearch = `?game=${encodeURIComponent(mirrorOfflineGameId(gameId))}`;
  const copyOfflineMinigames = async () => {
    const offlineGameId = mirrorOfflineGameId(gameId);
    discardOfflineMinigameMirror(offlineGameId);
    const [chess, renju, ultimate] = await Promise.all([
      chessBackend.load().catch(() => null),
      renjuBackend.load().catch(() => null),
      ultimateBackend.load().catch(() => null),
    ]);
    if (chess) {
      window.localStorage.setItem(localChessStorageKey(offlineCopySearch), chess.fen);
      window.localStorage.setItem(
        localChessLastMoveStorageKey(offlineCopySearch),
        JSON.stringify({ from: chess.last_move_from ?? null, to: chess.last_move_to ?? null })
      );
    }
    if (renju) {
      window.localStorage.setItem(
        localRenjuStorageKey(offlineCopySearch),
        JSON.stringify({ board: renju.board, lastMove: renju.last_move ?? null, prevMove: renju.prev_move ?? null })
      );
    }
    if (ultimate) {
      window.localStorage.setItem(
        localUltimateStorageKey(offlineCopySearch),
        JSON.stringify({ board: ultimate.board, lastMove: ultimate.last_move ?? null })
      );
    }
  };

  // The settings action creates the pass-and-play copy from a committed state. Later online states
  // may fast-forward it only while its local history is still an exact prefix; offline moves never
  // upload and are never overwritten.
  let lastCommittedState: any = null;

  // Declared here (before its watchers below, which reference it) rather than in its previous
  // spot further down - HostedBar.vue's settings-menu labels (`chatPanelOpen`/`gameNavPanelOpen`)
  // need to be kept live from `chatNotes`'/`nav`'s own `open` state, and a watcher can't reference
  // `bar` before it exists.
  const bar = new Vue({
    store: emitter.store,
    data: {
      gameName: "",
      finished: false,
      isLive: false,
      pushBusy: false,
      pushEnabled: false,
      abandoned: false,
      notifSettingsOpen: false,
      chatPanelOpen: chatNotes.open,
      gameNavPanelOpen: nav.open,
      offlineCopyStatus: "",
    },
    render(h) {
      // The bell now opens a settings modal (rendered as a sibling of the bar so its fixed-position
      // backdrop floats over the game) rather than toggling the device subscription directly.
      return h("div", [
        h(HostedBar, {
          props: { ...this.$data },
          on: {
            "open-notification-settings": () => {
              bar.notifSettingsOpen = true;
            },
            "abandon-game": async () => {
              const { error } = await client.rpc("abandon_game", { p_game_id: gameId });
              if (error) {
                window.alert(`Could not abandon the game: ${error.message}`);
              } else {
                bar.abandoned = true;
              }
            },
            "toggle-chat-panel": () => chatNotes.toggleOpen(),
            "toggle-game-nav-panel": () => nav.toggleOpen(),
            // A pass-and-play copy under one stable id. Repeating the action fast-forwards a stale
            // matching copy, but never overwrites one that advanced or diverged offline.
            "convert-to-offline": async () => {
              if (!lastCommittedState) {
                bar.offlineCopyStatus = "The game is still loading; try again in a moment.";
                return;
              }
              const offlineGameId = mirrorOfflineGameId(gameId);
              const result = convertHostedGameToPassAndPlay(gameId, bar.gameName, lastCommittedState);
              if (result.save && !result.created) {
                discardOfflineMinigameMirror(offlineGameId);
                if (result.updated) {
                  bar.offlineCopyStatus = "Pass-and-play copy updated to the latest online turn.";
                } else if (result.blockedByPendingMove) {
                  bar.offlineCopyStatus = "Offline copy has an unfinished turn, so it was not overwritten.";
                } else if (result.relation === "ahead") {
                  bar.offlineCopyStatus = "Offline copy is ahead; its local turns were kept.";
                } else if (result.relation === "diverged") {
                  bar.offlineCopyStatus = "Online and offline histories differ; the offline turns were kept.";
                } else {
                  bar.offlineCopyStatus = "Pass-and-play copy is already up to date.";
                }
                return;
              }
              if (!result.save) {
                bar.offlineCopyStatus = `Could not create pass-and-play copy: ${result.error ?? "unknown error"}`;
                return;
              }
              bar.offlineCopyStatus = "Pass-and-play copy saved in Offline games.";
              try {
                await copyOfflineMinigames();
              } catch {
                bar.offlineCopyStatus = "Pass-and-play game saved; a sidebar game could not be copied.";
              }
            },
          },
        }),
        h(NotificationSettings, {
          props: {
            open: bar.notifSettingsOpen,
            client,
            userId: session.user.id,
            pushEnabled: bar.pushEnabled,
          },
          on: {
            close: () => {
              bar.notifSettingsOpen = false;
            },
            // The modal owns the device subscribe/unsubscribe now; just refresh the bell state.
            "push-changed": async () => {
              bar.pushEnabled = await isPushEnabled();
            },
          },
        }),
      ]);
    },
  }).$mount(barEl) as any;
  isPushEnabled().then((enabled) => {
    bar.pushEnabled = enabled;
  });
  // Fill in this device's timezone for the turn-reminder quiet-hours gate if its subscription
  // predates the tz column (no-op once set / if push is off).
  backfillSubscriptionTimezone(client);

  // ChatNotesPanel.vue's own content/behavior is untouched (owner's explicit "keep it as is") - its
  // panel is `position: fixed`, so it floats OVER whatever's underneath rather than participating in
  // layout. Toggling a class on the page root and reserving the same width via CSS padding (see
  // frontend.scss's `#app.chat-notes-open`) makes the game area itself shrink out of the way
  // instead, so the two no longer overlap on desktop. The same class is what makes the page behind
  // the panel non-interactive on mobile, where it's a full-screen overlay rather than a dock - so
  // keep toggling it on every viewport, not just the desktop one it was first added for.
  //
  // Applied through `syncPanelOpen` (panel-dock.ts) rather than a bare `$watch`, because the panel
  // restores its desktop open state from localStorage in `data()`: a watcher alone never fires for
  // a panel that mounts ALREADY open, so the reservation was missing until the user toggled the
  // panel by hand - on every fresh load, and again on every in-app game switch, which re-mounts
  // this panel per game. That is what left the board rendered full-width under a docked chat.
  const chatOpenUnwatch = syncPanelOpen(chatNotes, (open: boolean) => {
    root.classList.toggle("chat-notes-open", open);
    bar.chatPanelOpen = open;
  });
  cleanups.push(chatOpenUnwatch, () => root.classList.remove("chat-notes-open"));
  // GameNavPanel.vue (`nav`) is mounted once at the `launchGame` level, not per-game like `bar`
  // above (it needs to survive an in-app game switch) - HostedBar.vue's settings-menu label still
  // needs its live `open` state on every re-mounted `bar`, so watch it here and clean up on
  // dispose rather than leaving a watcher from a torn-down `bar` still firing.
  const gameNavOpenUnwatch = syncPanelOpen(nav, (open: boolean) => {
    bar.gameNavPanelOpen = open;
  });
  cleanups.push(gameNavOpenUnwatch);
  // Feed the game's own presence roster (already tracked below via `trackPresence(..., {type:
  // "game", gameId}, ...)`, which lands in `emitter.store.state.presence`) into the chat's
  // per-message status dots, instead of ChatNotesPanel opening its own second Presence channel -
  // same reasoning as LobbyChatPanel's own presence fix (see PROGRESS.md).
  chatNotes.presenceState = emitter.store.state.presence;
  // GameNavPanel.vue's GameBar.vue rows show the same presence dots as Lobby.vue's own list - fed
  // the same way, for the same reason (see the comment just above).
  nav.presenceState = emitter.store.state.presence;
  // Entrant notice: diff the set of users present in THIS game across presence syncs and announce
  // anyone who newly appears while I'm here. `knownInGame` starts null so the very first sync
  // (everyone already in the game when I opened it, including myself) only establishes the baseline
  // and never announces - only genuine later arrivals fire a notice. My own id is always excluded.
  // The baseline is kept up to date on EVERY sync regardless of my own focus (below), but a notice
  // only fires while `isActivelyFocused()` is true - i.e. I'm actually looking at this game right
  // now, not just leaving its tab open in the background or sitting in the lobby. Without this gate,
  // arrivals/departures that happen while I'm away from this tab would silently queue up in
  // `entryNotice` and all dump onto the screen at once the next time I focus it.
  let knownInGame: Set<string> | null = null;
  const announceEntrants = (presence: PresenceState) => {
    const current = usersInGame(presence, gameId);
    if (knownInGame === null) {
      knownInGame = current;
      return;
    }
    const newcomers = [...current].filter((userId) => userId !== session.user.id && !knownInGame!.has(userId));
    knownInGame = current;
    if (newcomers.length === 0 || !isActivelyFocused()) {
      return;
    }
    for (const userId of newcomers) {
      const name = host.players.find((p) => p.user_id === userId)?.display_name ?? "";
      entryNotice.notifyEntered(name);
    }
  };
  const unwatchPresence = emitter.store.watch(
    (state: any) => state.presence,
    (presence: any) => {
      chatNotes.presenceState = presence;
      nav.presenceState = presence;
      updateBarLive();
      announceEntrants(presence as PresenceState);
    }
  );
  cleanups.push(unwatchPresence);

  let mySeats: number[] = [];

  // Close a race that briefly exposed the active player's in-progress faction-pick/round-0 buttons
  // to every connected viewer: `host.load()` below can emit its first "state" (and thus flip the
  // game visible via the "ready" listener above) before `mySeats` is known (it's only computed
  // once `load()` resolves, at "mySeats = host.mySeats(...)" below). Until then, `onState`'s
  // `seatToLock([], playerCount, ...)` would run with `playerCount` still 0 (game not loaded yet)
  // and return `null`, leaving `$store.state.player` at its default `null` - which Game.vue's
  // `canPlay` deliberately treats as "no lock, anyone may act" for local hot-seat play. In hosted
  // play that default is wrong for this brief window: it makes every viewer's `canPlay` true until
  // the real per-seat lock arrives. Locking to an impossible seat index up front makes `canPlay`
  // false for everyone (including the true active player, briefly) until `host.emitCurrentState()`
  // re-locks with the real seat below - a strictly safer default for hosted play than exposing the
  // active player's picker to onlookers. (`seatToLock` also locks true spectators - zero owned
  // seats once the game HAS loaded - to this same placeholder seat; see its own doc comment.)
  emitter.emit("player", { index: -1 });

  const host = new HostedGameHost(
    createSupabaseBackend(client),
    gameId,
    {
      onState: (data: any) => {
        emitter.emit("state", data);
        bar.gameName = host.game?.name ?? "";
        bar.finished = data.phase === "endGame";
        bar.abandoned = !!host.game?.abandoned_at;
        updateBarLive();
        const turnSeat = data.playerToMove;
        const playerCount = host.game?.player_count ?? 0;
        // Re-lock on every state so a user playing several (but not all) seats
        // gets whichever of their seats must act now (leech interrupts included).
        const lock = seatToLock(mySeats, playerCount, turnSeat);
        emitter.emit("player", lock !== null ? { index: lock } : null);
      },
      // Keep the latest committed state ready for conversion, and safely fast-forward any existing
      // pass-and-play copy on this device. A half-composed hosted turn never reaches this callback;
      // see host.ts's `emitState`.
      onCommittedState: (data: any) => {
        lastCommittedState = data;
        const result = refreshHostedPassAndPlayFromOnline(gameId, data);
        if (result.updated) {
          bar.offlineCopyStatus = "Pass-and-play copy updated from the online game.";
        } else if (result.error) {
          bar.offlineCopyStatus = `Could not update pass-and-play copy: ${result.error}`;
        }
      },
      onError: (message: string) => {
        emitter.emit("error", message);
        console.error("[hosted]", message);
      },
      onPremoveState: (premoves, failures) => {
        emitter.emit("premoveState", { premoves, failures });
      },
      // Sealed-bid auctions - submission progress for the bid panel. Straight into the store
      // (like the injected backends above) rather than through a launcher event: it is hosted-only
      // state that no other viewer mode has an equivalent of.
      onSealedBidState: (status) => {
        emitter.store.commit("sealedBidStatus", status);
      },
      // Phase 3 (§10.6) - quiet, in-app-only success feedback for a fast-path-played premove; never
      // a push (only failures push - see premove_failures' existing notify tie-in).
      onPremovePlayed: (seat, move, info) => {
        emitter.emit("premovePlayed", { seat, move, ...info });
      },
      onCancelTriggerState: (triggers) => {
        emitter.emit("cancelTriggerState", triggers);
      },
      onCancelTriggerFired: (seat, reason) => {
        emitter.emit("cancelTriggerFired", { seat, reason });
      },
    },
    {
      // "Auto leech" (host.ts's AutoDecideConfig) - never decide on behalf of a seat that isn't
      // one of this user's own, and always read the live preference (not a value snapshotted at
      // launch), so a mid-game toggle takes effect immediately.
      isMySeat: (seat) => mySeats.includes(seat),
      getAutoChargePower: () => parseAutoChargePreference(emitter.store.state.preferences.autoChargePower as string),
    }
  );

  // Sealed-bid auctions - the bid panels' only way to reach the server. Injected the same way
  // the notes/chess/renju backends are, so the reusable viewer never imports Supabase itself.
  emitter.store.commit("setSealedBidBackend", {
    submit: (seat: number, bids: { faction: string; points: number }[]) => host.submitSealedBid(seat, bids),
    refresh: () => host.refreshSealedBids(),
  });

  // Top-bar "Live" badge (mirrors GameBar.vue's `isLive`, the lobby's own reference
  // implementation): every player seated in this specific game is online right now. Recomputed on
  // every engine state change (game may finish) and every presence update (below); `host.players`
  // isn't populated until `host.load()` resolves, so the first real call happens after that.
  const updateBarLive = () => {
    const game = host.game;
    const players = host.players;
    if (!game || game.status !== "active" || players.length < 2) {
      bar.isLive = false;
      return;
    }
    const iAmPlaying = players.some((p) => p.user_id === session.user.id);
    if (!iAmPlaying) {
      bar.isLive = false;
      return;
    }
    const presence = emitter.store.state.presence;
    bar.isLive = players.every((p) => !!p.user_id && isOnline(presence, p.user_id));
  };

  const disposeMounted = () => {
    for (const fn of cleanups.splice(0).reverse()) {
      try {
        fn();
      } catch {
        // best-effort teardown - a failure here shouldn't block switching away from this game.
      }
    }
    bar.$destroy();
    chatNotesRoot.$destroy();
    entryNoticeRoot.$destroy();
    opponentMovesNoticeRoot.$destroy();
    emitter.app.$destroy();
  };

  try {
    await host.load();
  } catch (err) {
    loadingEl.remove();
    const message = err instanceof Error ? err.message : String(err);
    const alert = document.createElement("div");
    alert.className = "alert alert-danger m-3";
    alert.textContent = `Could not load this game: ${message}`;
    slot.insertBefore(alert, barEl);
    console.error("[hosted] game load failed", err);
    return disposeMounted;
  }

  mySeats = host.mySeats(session.user.id, session.user.email);
  updateBarLive();

  // Presence (PROGRESS.md Gaia 9) - the seat->user_id map (for matching a seat's turn-order dot to
  // its presence entry) is only known once host.players is populated by load() above; the presence
  // channel join itself doesn't need to wait on that, but there's nothing useful to track before a
  // gameId exists, so it's started here too rather than earlier.
  emitter.emit("seatUsers", Object.fromEntries(host.players.map((p) => [p.seat, p.user_id])));
  emitter.emit("seatLastActive", Object.fromEntries(host.players.map((p) => [p.seat, p.last_active_at ?? null])));
  const stopTrackingPresence = trackPresence(client, session.user.id, { type: "game", gameId }, (state) =>
    emitter.emit("presence", state)
  );
  cleanups.push(stopTrackingPresence);

  // Seat locking happens inside onState via seatToLock (launcher.ts "player"
  // -> store.state.player -> Game.vue's canPlay): a user with SOME seats is
  // locked to whichever of theirs must act; a user with ALL seats (test game)
  // plays hot-seat with no lock. Re-emit now that mySeats is known.
  host.emitCurrentState();

  emitter.on("move", (move: string) => {
    host.submitMove(move);
  });
  emitter.on("fetchState", () => host.emitCurrentState());
  // Premove (PREMOVE_PLAN.md) - Game.vue dispatches these with the seat the premove targets
  // (never inferred, so a multi-seat owner is never ambiguous - see host.ts's own RPCs).
  emitter.on("queuePremove", ({ seat, move, mode }: { seat: number; move: string; mode: "sequential" | "priority" }) =>
    host.queuePremove(seat, move, mode)
  );
  emitter.on("cancelPremove", ({ seat, seq }: { seat: number; seq: number }) => host.cancelPremove(seat, seq));
  emitter.on("editPremove", ({ seat, seq, move }: { seat: number; seq: number; move: string }) =>
    host.editPremove(seat, seq, move)
  );
  // Phase 3 (§10.4/§10.6)
  emitter.on("cancelAllPremoves", ({ seat }: { seat: number }) => host.cancelAllPremoves(seat));
  emitter.on("reorderPremove", ({ seat, seq, direction }: { seat: number; seq: number; direction: "up" | "down" }) =>
    host.reorderPremove(seat, seq, direction)
  );
  emitter.on("markPremoveFailureRead", (id: string) => host.markPremoveFailureRead(id));

  // Premove cancel triggers - same seat-explicit shape as the premove listeners above.
  emitter.on(
    "armCancelTrigger",
    ({
      seat,
      watchedSeat,
      move,
      atoms,
      kind,
      config,
    }: {
      seat: number;
      watchedSeat: number;
      move: string;
      atoms: string[];
      kind: CancelTriggerKind;
      config: CancelTriggerLeechConfig | Record<string, never>;
    }) => host.armCancelTrigger(seat, watchedSeat, move, atoms, kind, config)
  );
  emitter.on("disarmCancelTrigger", ({ seat, seq }: { seat: number; seq: number }) =>
    host.disarmCancelTrigger(seat, seq)
  );
  emitter.on("disarmAllCancelTriggers", ({ seat }: { seat: number }) => host.disarmAllCancelTriggers(seat));
  emitter.on(
    "editCancelTrigger",
    ({
      seat,
      seq,
      move,
      atoms,
      config,
    }: {
      seat: number;
      seq: number;
      move: string;
      atoms: string[];
      config: CancelTriggerLeechConfig | Record<string, never>;
    }) => host.editCancelTrigger(seat, seq, move, atoms, config)
  );

  // Phase 2 (offline auto-leech) - push the local preference to the server for each of this
  // user's own seats: once now (covers a preference already set from a previous game via
  // localStorage, before any in-game change happens here) and again on every future change (the
  // preference dropdown commits the "preferences" mutation directly, not an action - see
  // Commands.vue - so this listens at the mutation level, the same way launcher.ts already does
  // for "info"/"error").
  const pushAutoCharge = () => {
    const pref = String(emitter.store.state.preferences.autoChargePower ?? "ask");
    for (const seat of mySeats) {
      host.setAutoCharge(seat, pref);
    }
  };
  pushAutoCharge();
  const unsubAutoCharge = emitter.store.subscribe(({ type, payload }: { type: string; payload: any }) => {
    if (type === "preferences" && payload && "autoChargePower" in payload) {
      pushAutoCharge();
    }
  });
  cleanups.push(unsubAutoCharge);

  // host.resync()'s own promise was previously left unawaited/uncaught at both call sites below -
  // a resync attempted right as a backgrounded tab/PWA resumes (or a realtime channel reconnects)
  // can hit a transient network error before the device's radio is actually back (a well-known
  // mobile gotcha), silently rejecting with no retry: the app then sits on stale state - "still
  // shows it wasn't my turn" - until something else (a full close+reopen, which calls host.load()
  // fresh) happens to try again. Retry a few times with backoff before giving up quietly; the next
  // visibilitychange/reconnect will try again regardless if the device is still genuinely offline.
  const resyncWithRetry = () =>
    retryWithBackoff(
      () => host.resync(),
      [1000, 3000, 6000],
      (err) => console.error("[hosted] resync failed after retries", err)
    );

  // The first SUBSCRIBED fires right after load and would be a redundant
  // resync; only catch up on RE-subscribes (dropped connection recovered).
  let subscribedOnce = false;
  const stopSubscribingMoves = subscribeMoves(
    client,
    gameId,
    (row) => host.applyRemoteMove(row),
    () => {
      if (subscribedOnce) {
        resyncWithRetry();
      }
      subscribedOnce = true;
    }
  );
  cleanups.push(stopSubscribingMoves);

  // Heartbeat (Gaia 9, PROGRESS.md) - lets the server-side `notify` function tell "has the game
  // open right now" apart from "merely subscribed to realtime," so it can skip the redundant push
  // (see 0013_notify_presence_gate.sql). Only this session's own seats can be marked (mySeats;
  // mark_seat_active asserts seat ownership itself too) - a spectator or a session with no seats
  // here has nothing to heartbeat. Interval comfortably shorter than the server's staleness
  // threshold (45s) so ordinary timer jitter never makes an open tab look inactive.
  //
  // Reported alongside it, but per DEVICE rather than per seat: `players.last_active_at` above is
  // one row shared by every device this user is signed in on, so an open desktop tab used to
  // silence their phone as well (migration 20260808121000). This device's own push subscription is
  // the thing the push gate can key on instead - and unlike the seat heartbeat it must also report
  // while the tab is HIDDEN, since that report is exactly what re-enables pushes here. Null
  // endpoint = this device has no push subscription, so there is nothing to gate.
  let pushEndpoint: string | null = null;
  const markDeviceViewing = (viewing: boolean) => {
    if (!pushEndpoint) {
      return;
    }
    Promise.resolve(
      client.rpc("mark_device_viewing", { p_endpoint: pushEndpoint, p_game_id: viewing ? gameId : null })
    ).catch(() => undefined);
  };
  const markSeatsActive = () => {
    markDeviceViewing(document.visibilityState === "visible");
    if (document.visibilityState !== "visible") {
      return;
    }
    for (const seat of mySeats) {
      // supabase-js's query builder is thenable but not a real Promise (no direct .catch), so wrap
      // it - regressed silently with the 2.110.0 bump (PROGRESS.md Gaia 10) since 2.45.4 happened
      // to expose .catch directly.
      Promise.resolve(client.rpc("mark_seat_active", { p_game_id: gameId, p_seat: seat })).catch(() => undefined);
    }
  };
  markSeatsActive();
  // Async, so the first tick above can't have carried it - report as soon as it's known.
  currentPushEndpoint().then((endpoint) => {
    pushEndpoint = endpoint;
    markDeviceViewing(document.visibilityState === "visible");
  });
  const heartbeatInterval = setInterval(markSeatsActive, 20_000);
  cleanups.push(() => clearInterval(heartbeatInterval));
  // Leaving the game (back to the lobby, or a different game) is "no longer looking at it" just as
  // much as backgrounding the tab is.
  cleanups.push(() => markDeviceViewing(false));

  const visibilityListener = () => {
    if (document.visibilityState === "visible") {
      resyncWithRetry();
    }
    // Both directions: hiding the tab is the report that lets this device be pushed again.
    markSeatsActive();
  };
  document.addEventListener("visibilitychange", visibilityListener);
  cleanups.push(() => document.removeEventListener("visibilitychange", visibilityListener));

  return disposeMounted;
}

/**
 * Owns the in-game left menu (GameNavPanel.vue) and the currently-mounted game instance, so
 * clicking one of your other games there swaps the board in place instead of a full page reload:
 * tear down the old `mountGameInstance` (realtime channels, timers, Vue trees) via its returned
 * `dispose()`, wipe the slot, mount the new gameId, and update the URL with `pushState` (browser
 * back/forward wired via `popstate` below) rather than `location.assign`, which would defeat the
 * whole point by reloading the page. Switches are serialized through `switchChain` so a rapid
 * double-click can't overlap two in-flight `mountGameInstance` calls against the same slot.
 */
async function launchGame(root: Element, client: SupabaseClient, session: any, initialGameId: string): Promise<void> {
  const slot = document.createElement("div");
  root.appendChild(slot);

  const navRoot = mountChild(root, GameNavPanel, { client, session });
  const nav = navRoot.$children[0] as any;
  // `syncPanelOpen`, not a bare `$watch`, for the same reason as the chat panel's own reservation
  // in mountGameInstance: this panel also restores its open state from localStorage, so the class
  // has to be applied once at mount and not only when the state later changes.
  syncPanelOpen(nav, (open: boolean) => root.classList.toggle("game-nav-open", open));

  let currentGameId = initialGameId;
  let dispose: (() => void) | null = null;
  let switchChain: Promise<void> = Promise.resolve();

  const swapTo = (gameId: string) => {
    switchChain = switchChain.then(async () => {
      if (dispose) {
        dispose();
        dispose = null;
      }
      slot.innerHTML = "";
      currentGameId = gameId;
      nav.currentGameId = gameId;
      dispose = await mountGameInstance(root, slot, client, session, gameId, nav);
    });
    return switchChain;
  };

  const goToGame = (gameId: string) => {
    if (gameId === currentGameId) {
      return;
    }
    history.pushState({}, "", `?game=${gameId}`);
    swapTo(gameId);
  };

  nav.currentGameId = currentGameId;
  nav.$on("select-game", goToGame);

  // Tapping "your turn in <other game>" while this game is open goes through the very same swap
  // (push.ts's navigateToPushTarget), so it lands on that game immediately instead of reloading the
  // page and replaying its whole move history behind a spinner. Only registered here, inside a
  // mounted game - from the lobby a push target is just an ordinary page load.
  setInAppGameNavigation((gameId: string) => {
    goToGame(gameId);
    return true;
  });

  // Browser back/forward after an in-app switch (pushState above) - `location.search` is already
  // updated by the time `popstate` fires, so just read it back. Backing all the way out of `?game=`
  // entirely (e.g. to the lobby) isn't something this in-app switcher routes - only a fresh load
  // does - so fall back to a real reload for just that case rather than leaving a stale game
  // mounted under a URL that no longer says so.
  window.addEventListener("popstate", () => {
    const gameId = new URLSearchParams(window.location.search).get("game");
    if (!gameId) {
      window.location.reload();
    } else if (gameId !== currentGameId) {
      swapTo(gameId);
    }
  });

  await swapTo(initialGameId);
}

export default async function launchHosted(selector = "#app"): Promise<void> {
  const root = document.querySelector(selector);
  if (!root) {
    throw new Error(`no element matches ${selector}`);
  }

  let client: SupabaseClient;
  try {
    client = await getSupabaseClient();
  } catch (err) {
    root.textContent = `Could not reach the game server: ${err instanceof Error ? err.message : err}`;
    return;
  }

  const { data } = await client.auth.getSession();
  const session = data?.session;
  if (!session) {
    mountChild(root, SignIn, { client });
    return;
  }

  // Private access gate: every account starts unapproved (see migration
  // 20260708172234_admin_private_user_approval.sql) and sees no game data - checked here, before
  // anything else touches games/players/moves, so a pending user never even briefly renders the
  // lobby shell.
  const approval = await fetchMyApprovalStatus(client, session);
  if (approval !== "approved") {
    mountChild(root, PendingApproval, { client, session });
    return;
  }
  grantOfflineAccess();

  // Match the signed-in email to any seats the user was invited to.
  await client.rpc("claim_my_seats");

  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("game");
  if (gameId) {
    setViewportZoomLocked(false);
    await launchGame(root, client, session, gameId);
    return;
  }

  // Lobby and create-game are meant for one-handed phone use; lock pinch-zoom
  // there (viewport.ts), unlike the actual game board above.
  setViewportZoomLocked(true);
  if (params.has("preview")) {
    mountChild(root, OpenLobbyGame, { client, session, gameId: params.get("preview") });
  } else if (params.has("users")) {
    mountChild(root, AdminUsers, { client, session });
  } else if (params.has("create")) {
    mountChild(root, CreateGame, { client, session });
  } else if (params.has("importOffline")) {
    mountChild(root, ImportOfflineGame, { client, session, offlineGameId: params.get("importOffline") });
  } else {
    const lobbyRoot = mountChild(root, Lobby, { client, session });
    const lobby = lobbyRoot.$children[0] as any;
    // Lobby-only (not mounted inside a game, unlike ChatNotesPanel above) - a single global chat
    // room, separate from any one game's own chat.
    const lobbyChatRoot = mountChild(root, LobbyChatPanel, { client, userId: session.user.id });
    const lobbyChat = lobbyChatRoot.$children[0] as any;
    // Share Lobby.vue's own presence tracking (created() already calls trackPresence there) rather
    // than having LobbyChatPanel open a second Realtime Presence channel on the same "presence:app"
    // topic - two separate join requests for the identical topic/key-less read is an unnecessary
    // duplicate at best and, depending on how the client's channel dedup behaves, a plausible source
    // of a stale/never-synced roster at worst. Direct instance wiring, same pattern `bar`/`chatNotes`
    // already use in launchGame() above.
    lobbyChat.presenceState = lobby.presenceState;
    lobby.$watch("presenceState", (state: unknown) => {
      lobbyChat.presenceState = state;
    });
  }
}
