import Vue from "vue";
import AdminUsers from "./hosted/AdminUsers.vue";
import { fetchMyApprovalStatus } from "./hosted/approval";
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
import { HostedGameHost, seatToLock } from "./hosted/host";
import {
  isOfflineMirrorEnabled,
  mirrorOfflineGameId,
  planOfflineUpload,
  readOfflineMirrorState,
  setOfflineMirrorEnabled,
  syncOfflineMirror,
} from "./hosted/offline-mirror";
import { localChessLastMoveStorageKey, localChessStorageKey } from "./logic/chess";
import { localRenjuStorageKey } from "./logic/renju";
import { localUltimateStorageKey } from "./logic/ultimate-tic-tac-toe";
import {
  clearOfflineMinigameOps,
  MinigameKind,
  offlineMinigameGameId,
  queueOfflineMinigameOp,
  readOfflineMinigameOps,
  uploadOfflineMinigameOps,
  writeOfflineMinigameMirror,
} from "./logic/offline-minigame-sync";
import Lobby from "./hosted/Lobby.vue";
import OpenLobbyGame from "./hosted/OpenLobbyGame.vue";
import PendingApproval from "./hosted/PendingApproval.vue";
import { backfillSubscriptionTimezone, isPushEnabled } from "./hosted/push";
import { isOnline, PresenceState, trackPresence, usersInGame } from "./hosted/presence";
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
  // The three sidebar minigames travel with the offline copy too (logic/offline-minigame-sync.ts).
  // Same contract as the Gaia board: their positions come down, moves played offline go back up.
  const offlineCopySearch = `?game=${encodeURIComponent(mirrorOfflineGameId(gameId))}`;
  const minigames: Array<{ kind: MinigameKind; backend: any; localState: (row: any) => void }> = [
    {
      kind: "chess",
      backend: chessBackend,
      localState: (row) => {
        window.localStorage.setItem(localChessStorageKey(offlineCopySearch), row.fen);
        window.localStorage.setItem(
          localChessLastMoveStorageKey(offlineCopySearch),
          JSON.stringify({ from: row.last_move_from ?? null, to: row.last_move_to ?? null })
        );
      },
    },
    {
      kind: "renju",
      backend: renjuBackend,
      localState: (row) =>
        window.localStorage.setItem(
          localRenjuStorageKey(offlineCopySearch),
          JSON.stringify({ board: row.board, lastMove: row.last_move ?? null, prevMove: row.prev_move ?? null })
        ),
    },
    {
      kind: "ultimate",
      backend: ultimateBackend,
      localState: (row) =>
        window.localStorage.setItem(
          localUltimateStorageKey(offlineCopySearch),
          JSON.stringify({ board: row.board, lastMove: row.last_move ?? null })
        ),
    },
  ];

  // "Convert to offline game" (hosted/offline-mirror.ts) - a per-device setting in this game's
  // settings menu. While it's on, every committed state (host.ts's `onCommittedState`, below)
  // is written into a playable copy of this game in the browser's own offline library, so it stays
  // readable and playable with no account and no connection. Deliberately not in the Vuex store:
  // nothing in the viewer tree needs it, only the bar's own menu.
  let lastCommittedState: any = null;
  // Guards the upload loop below against re-entry: each move it sends commits, which emits another
  // committed state, which calls straight back into `syncOfflineCopy`.
  let uploadingOfflineMoves = false;
  // Set once `host.load()` has resolved and `mySeats` is real. The copy records which seats may be
  // played offline, and nothing may be uploaded before we know whose seats they are, so the first
  // states (emitted from inside `load()`, while `mySeats` is still empty) must not write it.
  let seatsKnown = false;
  let syncingMinigames = false;
  let minigameUploads = 0;
  const minigameConflicts = new Set<MinigameKind>();

  const syncOfflineCopy = () => {
    if (!lastCommittedState || !bar.offlineMirror || !seatsKnown) {
      return;
    }
    const result = syncOfflineMirror(gameId, host.game?.name ?? "", lastCommittedState, mySeats);
    if (result.error) {
      // Never interrupts play - the online game is unaffected either way, and the copy just stays at
      // the last move it managed to store (a full-storage quota error being the likeliest cause).
      // Reported on the settings menu's own status line rather than as an alert per move.
      bar.offlineMirrorStatus = `Offline copy failed: ${result.error}`;
      console.warn("[hosted] offline copy failed", result.error);
      return;
    }
    if (result.relation === "ahead") {
      // The copy holds moves played offline that this game doesn't have yet. It is NOT overwritten
      // (syncOfflineMirror refuses); those moves go up instead, so the two converge forwards.
      uploadOfflineMoves();
      return;
    }
    if (result.relation === "diverged") {
      // Offline play raced a move made online: the two histories genuinely disagree, so neither side
      // can be replayed onto the other. Leave both alone and say so - the local game is still intact
      // in the offline lobby, and the online game is untouched.
      bar.offlineMirrorStatus = "Offline copy conflicts with the online game - kept, not overwritten";
      return;
    }
    if (!result.skipped && result.save) {
      const moves = Math.max((result.save.engineData?.moveHistory?.length ?? 1) - 1, 0);
      bar.offlineMirrorStatus = `Offline copy saved (${moves} ${moves === 1 ? "move" : "moves"})`;
    }
    syncOfflineMinigames();
  };

  /**
   * The sidebar minigames' half of the copy. Their rows hold only a current position, so unlike the
   * Gaia board they cannot be compared for "ahead"; instead anything played offline is recorded as
   * an op log (logic/offline-minigame-sync.ts) which is replayed here first. A board with a pending
   * log is never refreshed from the online row until that log has gone up, which is the same
   * no-overwrite rule the Gaia copy follows.
   */
  const syncOfflineMinigames = () => {
    if (!bar.offlineMirror || syncingMinigames) {
      return;
    }
    syncingMinigames = true;
    const offlineGameId = offlineMinigameGameId(offlineCopySearch);
    const rows: Partial<Record<MinigameKind, any>> = {};
    Promise.all(
      minigames.map(async ({ kind, backend, localState }) => {
        const pending = readOfflineMinigameOps(offlineGameId, kind);
        if (pending.length > 0) {
          const result = await uploadOfflineMinigameOps(backend, kind, pending);
          if (result.uploaded > 0) {
            minigameUploads += result.uploaded;
          }
          if (result.conflict) {
            // Keep what could not be sent: the offline board stays as the player left it, and the
            // online board is whatever the other player made of it.
            minigameConflicts.add(kind);
            clearOfflineMinigameOps(offlineGameId, kind);
            for (const op of result.remaining) {
              queueOfflineMinigameOp(offlineGameId, kind, op);
            }
            return;
          }
          clearOfflineMinigameOps(offlineGameId, kind);
        }
        const row = await backend.load();
        if (row) {
          rows[kind] = row;
          if (readOfflineMinigameOps(offlineGameId, kind).length === 0) {
            localState(row);
          }
        }
      })
    )
      .then(() => {
        // The colour/team assignments and this account's id travel with the copy: offline there is
        // no session to ask, and without them the boards could not tell whose move it is.
        writeOfflineMinigameMirror(offlineGameId, session.user.id, rows);
        if (minigameConflicts.size > 0) {
          bar.offlineMirrorStatus = `Offline ${[...minigameConflicts].join(
            "/"
          )} moves clashed with the online board and were kept offline`;
        } else if (minigameUploads > 0) {
          bar.offlineMirrorStatus = `Sent ${minigameUploads} offline minigame ${
            minigameUploads === 1 ? "move" : "moves"
          }`;
        }
        minigameUploads = 0;
        minigameConflicts.clear();
      })
      .catch(() => {
        // Best effort - the minigames must never block or alarm about the Gaia game.
      })
      .finally(() => {
        syncingMinigames = false;
      });
  };

  /**
   * Sends moves played in the offline copy up to the online game, one committed turn at a time
   * through the ordinary commit path, so other players see them exactly like any other move.
   *
   * Re-planned on every iteration rather than from one precomputed list: each commit can be beaten
   * by another device (seq conflict -> resync), which changes what is still uploadable. The loop
   * stops as soon as a move can't go (someone else's seat, or the engine rejects it now) and says
   * why; whatever couldn't be sent stays in the offline copy rather than being discarded.
   */
  const uploadOfflineMoves = async () => {
    if (uploadingOfflineMoves) {
      return;
    }
    uploadingOfflineMoves = true;
    let uploaded = 0;
    let blocked: ReturnType<typeof planOfflineUpload>["blocked"] = null;
    try {
      for (;;) {
        const state = readOfflineMirrorState(gameId, lastCommittedState?.moveHistory ?? []);
        if (state.relation !== "ahead") {
          break;
        }
        const plan = planOfflineUpload(lastCommittedState, state.offlineMoves, (seat) => mySeats.includes(seat));
        if (plan.moves.length === 0) {
          blocked = plan.blocked;
          break;
        }
        bar.offlineMirrorStatus = `Sending ${plan.moves.length} offline ${
          plan.moves.length === 1 ? "move" : "moves"
        } to the online game…`;
        const before = lastCommittedState?.moveHistory?.length ?? 0;
        await host.submitMove(plan.moves[0]);
        if ((lastCommittedState?.moveHistory?.length ?? 0) <= before) {
          // The commit didn't land (rejected, or another device won the race and we resynced).
          // Stop rather than spin - the next committed state will try again from the real state.
          blocked = { move: plan.moves[0], seat: null, reason: "rejected" };
          break;
        }
        uploaded++;
      }
    } finally {
      uploadingOfflineMoves = false;
    }

    if (blocked?.reason === "other-seat") {
      const seatLabel = blocked.seat === null ? "another player" : `seat ${blocked.seat + 1}`;
      bar.offlineMirrorStatus = `Sent ${uploaded} offline ${
        uploaded === 1 ? "move" : "moves"
      }; the rest waits on ${seatLabel}`;
    } else if (blocked) {
      bar.offlineMirrorStatus = `Sent ${uploaded} offline ${
        uploaded === 1 ? "move" : "moves"
      }; the next one no longer fits the online game and was kept offline`;
    } else if (uploaded > 0) {
      bar.offlineMirrorStatus = `Sent ${uploaded} offline ${uploaded === 1 ? "move" : "moves"} to the online game`;
      // Everything landed: the copy and the online game now match, so refresh it normally (this also
      // re-stamps the record, which is what makes the offline lobby show it as up to date again).
      syncOfflineCopy();
    }
  };

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
      offlineMirror: isOfflineMirrorEnabled(gameId),
      offlineMirrorStatus: "",
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
            // The bar has already confirmed the change with the user (HostedBar.vue's
            // `toggleOfflineCopy`); switching it on copies the state this session is already
            // holding, so the copy exists immediately rather than only after the next turn.
            "toggle-offline-mirror": () => {
              const result = setOfflineMirrorEnabled(gameId, !bar.offlineMirror);
              bar.offlineMirror = result.enabled;
              bar.offlineMirrorStatus = "";
              if (result.error) {
                window.alert(`Could not change the offline copy setting: ${result.error}`);
              }
              syncOfflineCopy();
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
  // frontend.scss's `#app.chat-notes-open`, desktop-only) makes the game area itself shrink out of
  // the way instead, so the two no longer overlap.
  const chatOpenUnwatch = chatNotes.$watch("open", (open: boolean) => {
    root.classList.toggle("chat-notes-open", open);
    bar.chatPanelOpen = open;
  });
  root.classList.remove("chat-notes-open");
  cleanups.push(chatOpenUnwatch, () => root.classList.remove("chat-notes-open"));
  // GameNavPanel.vue (`nav`) is mounted once at the `launchGame` level, not per-game like `bar`
  // above (it needs to survive an in-app game switch) - HostedBar.vue's settings-menu label still
  // needs its live `open` state on every re-mounted `bar`, so watch it here and clean up on
  // dispose rather than leaving a watcher from a torn-down `bar` still firing.
  const gameNavOpenUnwatch = nav.$watch("open", (open: boolean) => {
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
  let knownInGame: Set<string> | null = null;
  const announceEntrants = (presence: PresenceState) => {
    const current = usersInGame(presence, gameId);
    if (knownInGame === null) {
      knownInGame = current;
      return;
    }
    for (const userId of current) {
      if (userId === session.user.id || knownInGame.has(userId)) {
        continue;
      }
      const name = host.players.find((p) => p.user_id === userId)?.display_name ?? "";
      entryNotice.notifyEntered(name);
    }
    knownInGame = current;
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
      // Committed states only (never a half-composed turn) - the offline copy must hold a game that
      // opens cleanly in the offline lobby, not a turn frozen mid-click. See host.ts's `emitState`.
      onCommittedState: (data: any) => {
        lastCommittedState = data;
        syncOfflineCopy();
      },
      onError: (message: string) => {
        emitter.emit("error", message);
        console.error("[hosted]", message);
      },
      onPremoveState: (premoves, failures) => {
        emitter.emit("premoveState", { premoves, failures });
      },
      // Phase 3 (§10.6) - quiet, in-app-only success feedback for a fast-path-played premove; never
      // a push (only failures push - see premove_failures' existing notify tie-in).
      onPremovePlayed: (seat, move, info) => {
        emitter.emit("premovePlayed", { seat, move, ...info });
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
  // The offline copy may now be written/uploaded: which seats this account holds is what decides
  // both what it records as playable offline and what may be sent back up (see syncOfflineCopy).
  // `host.emitCurrentState()` below re-emits the loaded state, which is what actually runs it.
  seatsKnown = true;
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
  const markSeatsActive = () => {
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
  const heartbeatInterval = setInterval(markSeatsActive, 20_000);
  cleanups.push(() => clearInterval(heartbeatInterval));

  const visibilityListener = () => {
    if (document.visibilityState === "visible") {
      resyncWithRetry();
      markSeatsActive();
    }
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
  nav.$watch("open", (open: boolean) => root.classList.toggle("game-nav-open", open));

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

  nav.currentGameId = currentGameId;
  nav.$on("select-game", (gameId: string) => {
    if (gameId === currentGameId) {
      return;
    }
    history.pushState({}, "", `?game=${gameId}`);
    swapTo(gameId);
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
