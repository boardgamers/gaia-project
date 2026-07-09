import Vue from "vue";
import AdminUsers from "./hosted/AdminUsers.vue";
import { fetchMyApprovalStatus } from "./hosted/approval";
import Game from "./components/Game.vue";
import CreateGame from "./hosted/CreateGame.vue";
import HostedBar from "./hosted/HostedBar.vue";
import { HostedGameHost, seatToLock } from "./hosted/host";
import Lobby from "./hosted/Lobby.vue";
import OpenLobbyGame from "./hosted/OpenLobbyGame.vue";
import PendingApproval from "./hosted/PendingApproval.vue";
import {
  disablePushNotifications,
  enablePushNotifications,
  isPushEnabled,
  registerServiceWorker,
  registerServiceWorkerNavigationListener,
} from "./hosted/push";
import { trackPresence } from "./hosted/presence";
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

async function launchGame(root: Element, client: SupabaseClient, session: any, gameId: string): Promise<void> {
  const barEl = document.createElement("div");
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
  root.appendChild(barEl);
  root.appendChild(loadingEl);
  root.appendChild(gameWrapperEl);

  // Created before `bar` so HostedBar.vue can embed <TurnOrder /> (PROGRESS.md Gaia 10) sharing
  // the SAME store as the Game tree below - TurnOrder
  // reads engine/presence state via `this.$store`, which only works if `bar`'s root Vue instance is
  // given this same store at construction (Vuex injects `$store` from the root's `store` option).
  const emitter = launch("#hosted-game", Game);
  emitter.once("ready", () => {
    loadingEl.remove();
    gameWrapperEl.style.display = "";
  });

  const bar = new Vue({
    store: emitter.store,
    data: {
      gameName: "",
      finished: false,
      pushBusy: false,
      pushEnabled: false,
    },
    render(h) {
      return h(HostedBar, {
        props: { ...this.$data },
        on: {
          "enable-push": async () => {
            bar.pushBusy = true;
            window.alert(await enablePushNotifications(client, session.user.id));
            bar.pushEnabled = await isPushEnabled();
            bar.pushBusy = false;
          },
          "disable-push": async () => {
            bar.pushBusy = true;
            window.alert(await disablePushNotifications(client));
            bar.pushEnabled = await isPushEnabled();
            bar.pushBusy = false;
          },
        },
      });
    },
  }).$mount(barEl) as any;
  isPushEnabled().then((enabled) => {
    bar.pushEnabled = enabled;
  });

  let mySeats: number[] = [];

  // Close a race that briefly exposed the active player's in-progress faction-pick/round-0 buttons
  // to every connected viewer: `host.load()` below can emit its first "state" (and thus flip the
  // game visible via the "ready" listener above) before `mySeats` is known (it's only computed
  // once `load()` resolves, at "mySeats = host.mySeats(...)" below). Until then, `onState`'s
  // `seatToLock([], ...)` returns null, so no "player" event fires and `$store.state.player` stays
  // its default `null` - which Game.vue's `canPlay` deliberately treats as "no lock, anyone may
  // act" for local hot-seat play. In hosted play that default is wrong for this brief window: it
  // makes every viewer's `canPlay` true until the real per-seat lock arrives. Locking to an
  // impossible seat index up front makes `canPlay` false for everyone (including the true active
  // player, briefly) until `host.emitCurrentState()` re-locks with the real seat below - a strictly
  // safer default for hosted play than exposing the active player's picker to onlookers.
  emitter.emit("player", { index: -1 });

  const host = new HostedGameHost(
    createSupabaseBackend(client),
    gameId,
    {
      onState: (data: any) => {
        emitter.emit("state", data);
        bar.gameName = host.game?.name ?? "";
        bar.finished = data.phase === "endGame";
        const turnSeat = data.playerToMove;
        const playerCount = host.game?.player_count ?? 0;
        // Re-lock on every state so a user playing several (but not all) seats
        // gets whichever of their seats must act now (leech interrupts included).
        const lock = seatToLock(mySeats, playerCount, turnSeat);
        emitter.emit("player", lock !== null ? { index: lock } : null);
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

  try {
    await host.load();
  } catch (err) {
    loadingEl.remove();
    const message = err instanceof Error ? err.message : String(err);
    const alert = document.createElement("div");
    alert.className = "alert alert-danger m-3";
    alert.textContent = `Could not load this game: ${message}`;
    root.insertBefore(alert, barEl);
    console.error("[hosted] game load failed", err);
    return;
  }

  mySeats = host.mySeats(session.user.id, session.user.email);

  // Presence (PROGRESS.md Gaia 9) - the seat->user_id map (for matching a seat's turn-order dot to
  // its presence entry) is only known once host.players is populated by load() above; the presence
  // channel join itself doesn't need to wait on that, but there's nothing useful to track before a
  // gameId exists, so it's started here too rather than earlier.
  emitter.emit(
    "seatUsers",
    Object.fromEntries(host.players.map((p) => [p.seat, p.user_id]))
  );
  emitter.emit(
    "seatLastActive",
    Object.fromEntries(host.players.map((p) => [p.seat, p.last_active_at ?? null]))
  );
  trackPresence(client, session.user.id, { type: "game", gameId }, (state) => emitter.emit("presence", state));

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
  emitter.store.subscribe(({ type, payload }: { type: string; payload: any }) => {
    if (type === "preferences" && payload && "autoChargePower" in payload) {
      pushAutoCharge();
    }
  });

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
  subscribeMoves(
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
  setInterval(markSeatsActive, 20_000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resyncWithRetry();
      markSeatsActive();
    }
  });
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

  // Keep the service worker registered on every visit so push subscriptions
  // stay alive; actual permission/subscription is behind an explicit button.
  registerServiceWorker().catch(() => undefined);
  registerServiceWorkerNavigationListener();

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
  } else {
    mountChild(root, Lobby, { client, session });
  }
}
