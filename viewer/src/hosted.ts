import Vue from "vue";
import Game from "./components/Game.vue";
import CreateGame from "./hosted/CreateGame.vue";
import HostedBar from "./hosted/HostedBar.vue";
import { HostedGameHost, seatToLock } from "./hosted/host";
import Lobby from "./hosted/Lobby.vue";
import { enablePushNotifications, registerServiceWorker } from "./hosted/push";
import SignIn from "./hosted/SignIn.vue";
import { createSupabaseBackend, getSupabaseClient, subscribeMoves, SupabaseClient } from "./hosted/supabase-client";
import { setViewportZoomLocked } from "./hosted/viewport";
import launch from "./launcher";
import { parseAutoChargePreference } from "./logic/auto-decide";

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

  const bar = new Vue({
    data: {
      gameName: "",
      turnPlayerName: "",
      mySeatName: "",
      myTurn: false,
      finished: false,
      pushBusy: false,
    },
    render(h) {
      return h(HostedBar, {
        props: { ...this.$data },
        on: {
          "enable-push": async () => {
            bar.pushBusy = true;
            window.alert(await enablePushNotifications(client, session.user.id));
            bar.pushBusy = false;
          },
        },
      });
    },
  }).$mount(barEl) as any;

  const emitter = launch("#hosted-game", Game);
  emitter.once("ready", () => {
    loadingEl.remove();
    gameWrapperEl.style.display = "";
  });
  let mySeats: number[] = [];

  const host = new HostedGameHost(
    createSupabaseBackend(client),
    gameId,
    {
      onState: (data: any) => {
        emitter.emit("state", data);
        bar.gameName = host.game?.name ?? "";
        bar.finished = data.phase === "endGame";
        const turnSeat = data.playerToMove;
        bar.turnPlayerName = data.players?.[turnSeat]?.name ?? `Player ${turnSeat + 1}`;
        bar.myTurn = !bar.finished && mySeats.includes(turnSeat);
        const playerCount = host.game?.player_count ?? 0;
        bar.mySeatName =
          mySeats.length >= playerCount && mySeats.length > 0
            ? "all seats (test game)"
            : mySeats.length > 0
            ? data.players?.[mySeats[0]]?.name ?? `Player ${mySeats[0] + 1}`
            : "";
        // Re-lock on every state so a user playing several (but not all) seats
        // gets whichever of their seats must act now (leech interrupts included).
        const lock = seatToLock(mySeats, playerCount, turnSeat);
        if (lock !== null) {
          emitter.emit("player", { index: lock });
        }
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

  // The first SUBSCRIBED fires right after load and would be a redundant
  // resync; only catch up on RE-subscribes (dropped connection recovered).
  let subscribedOnce = false;
  subscribeMoves(
    client,
    gameId,
    (row) => host.applyRemoteMove(row),
    () => {
      if (subscribedOnce) {
        host.resync();
      }
      subscribedOnce = true;
    }
  );

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      host.resync();
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

  const { data } = await client.auth.getSession();
  const session = data?.session;
  if (!session) {
    mountChild(root, SignIn, { client });
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
  if (params.has("create")) {
    mountChild(root, CreateGame, { client, session });
  } else {
    mountChild(root, Lobby, { client, session });
  }
}
