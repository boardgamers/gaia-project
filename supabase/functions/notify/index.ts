// Turn/invite/finish/chat push notifications (BACKEND.md §6, §J4 as amended).
//
// Called by the pg_net trigger on the games table with {type, game_id}
// (type "insert" = game created, "update" = current_seat/status changed), by the trigger on
// chess_board with {type: "chess_turn", game_id} (fen changed - a move or a reset), by the trigger
// on renju_board with {type: "renju_turn", game_id} (board changed - a stone or a reset), or by the
// trigger on game_chat_messages with {type: "chat", game_id, sender_id, author_name, body}.
// Reads everything it needs (game, players, chess/renju board, subscriptions, VAPID keys) with
// the service role - it never runs the game engine.
//
// app_config['vapid'] value shape (seeded out-of-band, never committed):
//   { keys: { publicKey: JWK, privateKey: JWK }, subject: "mailto:...",
//     site_url: "https://..." }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

import {
  AuctionReminderRow,
  buildChessTurnNotification,
  buildNotifications,
  buildRenjuTurnNotification,
  buildSealedBidNotifications,
  ChessBoardRow,
  currentTurnPlayer,
  GameRow,
  isNotificationAllowed,
  isTurnKind,
  MIN_REMINDER_INTERVAL_MS,
  NotificationPrefs,
  planSealedBidReminder,
  planTurnReminder,
  RenjuBoardRow,
  resolvePrefs,
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
} from "./logic.ts";

// Columns of public.push_subscriptions every delivery path needs: the keys to push with, the
// user agent that decides whether suppression applies at all, and the per-device presence the
// suppression is judged on (migration 20260808121000).
const SUBSCRIPTION_COLUMNS = "id,user_id,endpoint,p256dh,auth,user_agent,active_game_id,active_at";

// Columns of public.notification_prefs the notify function reads.
const PREFS_COLUMNS =
  "user_id,turn_pushes,chess_pushes,renju_pushes,chat_pushes,invite_pushes,finished_pushes,reminders_enabled," +
  "reminder_interval_hours,reminder_max_count,quiet_hours_enabled,quiet_start_hour,quiet_end_hour,snooze_until";

// Loads global prefs for the given users into a Map, resolving defaults for anyone without a row.
async function loadPrefsByUser(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, NotificationPrefs>> {
  const byUser = new Map<string, NotificationPrefs>();
  if (userIds.length === 0) {
    return byUser;
  }
  const { data } = await supabase.from("notification_prefs").select(PREFS_COLUMNS).in("user_id", userIds);
  for (const row of (data ?? []) as (Partial<NotificationPrefs> & { user_id: string })[]) {
    byUser.set(row.user_id, resolvePrefs(row));
  }
  for (const id of userIds) {
    if (!byUser.has(id)) {
      byUser.set(id, resolvePrefs(null));
    }
  }
  return byUser;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
// deno-lint-ignore no-explicit-any
type AppServer = any;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const { type, game_id, sender_id, author_name, body: chatBody } = await req.json();

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (type === "reminder_sweep") {
    return await runReminderSweep(supabase);
  }

  if (
    !game_id ||
    (type !== "insert" &&
      type !== "update" &&
      type !== "chat" &&
      type !== "chess_turn" &&
      type !== "renju_turn" &&
      type !== "auction_bid")
  ) {
    return new Response("bad request", { status: 400 });
  }
  if (type === "chat" && (!sender_id || !author_name || !chatBody)) {
    return new Response("bad request", { status: 400 });
  }

  const [{ data: cfg, error: cfgError }, { data: game, error: gameError }] = await Promise.all([
    supabase.from("app_config").select("value").eq("key", "vapid").single(),
    supabase.from("games").select("*, players(*)").eq("id", game_id).single(),
  ]);
  if (cfgError || !cfg) {
    console.error("vapid config missing:", cfgError?.message);
    return new Response("vapid config missing", { status: 500 });
  }
  if (gameError || !game) {
    console.error("game not found:", gameError?.message);
    return new Response("game not found", { status: 404 });
  }

  let notifications: ReturnType<typeof buildNotifications> = [];
  if (type === "chess_turn") {
    const { data: board, error: boardError } = await supabase
      .from("chess_board")
      .select("*")
      .eq("game_id", game_id)
      .single();
    if (boardError || !board) {
      console.error("chess board not found:", boardError?.message);
      return new Response("chess board not found", { status: 404 });
    }
    notifications = buildChessTurnNotification(board as ChessBoardRow, game as GameRow);
  } else if (type === "renju_turn") {
    const { data: board, error: boardError } = await supabase
      .from("renju_board")
      .select("*")
      .eq("game_id", game_id)
      .single();
    if (boardError || !board) {
      console.error("renju board not found:", boardError?.message);
      return new Response("renju board not found", { status: 404 });
    }
    notifications = buildRenjuTurnNotification(board as RenjuBoardRow, game as GameRow);
  } else if (type === "auction_bid") {
    // A sealed-bid auction opened its bid phase (announce_sealed_bid_auction stamped the game
    // row). Everyone who hasn't submitted yet is on turn - which, at announcement time, is
    // normally everyone, but a player who managed to bid before this call lands is correctly left
    // out rather than told to do what they just did.
    notifications = buildSealedBidNotifications(game as GameRow, await pendingBidSeats(supabase, game as GameRow));
  } else {
    let hasQueuedPremove = false;
    if (type === "update" && (game as GameRow).current_seat !== null) {
      const { count } = await supabase
        .from("premoves")
        .select("seat", { count: "exact", head: true })
        .eq("game_id", game_id)
        .eq("seat", (game as GameRow).current_seat);
      hasQueuedPremove = (count ?? 0) > 0;
    }

    const chatMessage =
      type === "chat"
        ? { senderId: sender_id as string, authorName: author_name as string, body: chatBody as string }
        : undefined;

    let mutedUserIds = new Set<string>();
    if (type === "chat") {
      const { data: mutes } = await supabase.from("game_chat_mutes").select("user_id").eq("game_id", game_id);
      mutedUserIds = new Set((mutes ?? []).map((m: { user_id: string }) => m.user_id));
    }

    notifications = buildNotifications(type, game as GameRow, hasQueuedPremove, chatMessage, mutedUserIds);
  }
  if (notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }
  const playerByUserId = new Map(
    (game as GameRow).players.filter((p) => p.user_id).map((p) => [p.user_id as string, p])
  );

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .in("user_id", userIds);
  if (subsError) {
    console.error("could not load subscriptions:", subsError.message);
    return new Response("subscriptions unavailable", { status: 500 });
  }

  // Global per-user prefs decide whether each recipient wants this category at all (and whether
  // they're snoozed). Missing row = defaults (every category on except opt-in reminders).
  const prefsByUser = await loadPrefsByUser(supabase, userIds);

  const { appServer, siteUrl } = await buildAppServer(cfg.value);

  let sent = 0;
  const gone: string[] = [];
  for (const notification of notifications) {
    if (!isNotificationAllowed(notification, prefsByUser.get(notification.userId) ?? resolvePrefs(null))) {
      continue; // recipient turned this category off, or is snoozed
    }
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      url: `${siteUrl}/?game=${game_id}`,
    });
    for (const sub of (subscriptions ?? []).filter((s: SubscriptionRow) => s.user_id === notification.userId)) {
      // Desktop subscriptions are intentionally "more sensitive": if it's your turn (Gaia, chess or
      // renju) or someone just chatted, they still get the push even while the game is already open.
      // Mobile/PWA subscriptions are suppressed only by their OWN report that this game is open on
      // them right now (never by another of the user's devices) - see
      // shouldSkipTurnPushForSubscription. The player row is still passed for the legacy fallback
      // there; it's the same row for a "turn" notification's userId either way (Gaia's current seat,
      // the chess/renju mover, or a seat that still owes an auction bid).
      const recipient = playerByUserId.get(notification.userId);
      if (
        (isTurnKind(notification.kind) || notification.kind === "message") &&
        recipient &&
        shouldSkipTurnPushForSubscription(recipient, sub, game_id)
      ) {
        continue;
      }
      if (await pushToSubscription(appServer, sub, payload, gone)) {
        sent++;
      }
    }
  }

  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", gone);
  }

  return new Response(JSON.stringify({ sent, deleted: gone.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// deno-lint-ignore no-explicit-any
async function buildAppServer(cfg: any): Promise<{ appServer: AppServer; siteUrl: string }> {
  const vapidKeys = await webpush.importVapidKeys(cfg.keys, { extractable: false });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: cfg.subject,
    vapidKeys,
  });
  return { appServer, siteUrl: (cfg.site_url ?? "").replace(/\/$/, "") };
}

// Sends one push, returning whether it landed. A subscription the push service reports as "gone"
// (410) is collected in `gone` for deletion by the caller.
async function pushToSubscription(
  appServer: AppServer,
  sub: SubscriptionRow,
  payload: string,
  gone: string[]
): Promise<boolean> {
  try {
    const subscriber = appServer.subscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    });
    await subscriber.pushTextMessage(payload, {});
    return true;
  } catch (err) {
    if (err instanceof webpush.PushMessageError && err.isGone()) {
      gone.push(sub.id);
    } else {
      console.error(`push to ${sub.endpoint} failed:`, err instanceof Error ? err.message : err);
    }
    return false;
  }
}

/** Seats of `game` that still owe a sealed submission (empty once the auction is full). */
async function pendingBidSeats(supabase: SupabaseClient, game: GameRow): Promise<number[]> {
  const { data, error } = await supabase.from("auction_sealed_bids").select("seat").eq("game_id", game.id);
  if (error) {
    console.error("could not load sealed bids:", error.message);
    return [];
  }
  const submitted = new Set(((data ?? []) as { seat: number }[]).map((row) => row.seat));
  return game.players.filter((p) => p.user_id !== null && !submitted.has(p.seat)).map((p) => p.seat);
}

// Hourly pg_cron entry point (migration 20260721_turn_reminders): finds every active game whose
// current player has let their turn go idle past the reminder threshold and re-nudges them, subject
// to the per-turn cap and their local quiet hours (planTurnReminder). Loads its own config/state
// with the service role - it never runs the game engine.
//
// Second pass (migration 20260808120000): the same treatment for an open sealed-bid auction, which
// no amount of `current_seat` watching can cover - see sweepSealedBidAuctions.
async function runReminderSweep(supabase: SupabaseClient): Promise<Response> {
  const { data: cfg, error: cfgError } = await supabase.from("app_config").select("value").eq("key", "vapid").single();
  if (cfgError || !cfg) {
    console.error("vapid config missing:", cfgError?.message);
    return new Response("vapid config missing", { status: 500 });
  }

  // Prefilter on the SMALLEST interval a user can choose (12h) so a longer-interval opt-in isn't
  // dropped here; planTurnReminder/planSealedBidReminder apply each user's actual interval.
  const cutoff = new Date(Date.now() - MIN_REMINDER_INTERVAL_MS).toISOString();
  const [{ data: games, error: gamesError }, { data: auctions, error: auctionsError }] = await Promise.all([
    supabase
      .from("games")
      .select("*, players(*)")
      .eq("status", "active")
      .not("current_seat", "is", null)
      .not("latest_move_committed_at", "is", null)
      .lt("latest_move_committed_at", cutoff),
    supabase
      .from("games")
      .select("*, players(*)")
      .eq("status", "active")
      .not("sealed_bid_announced_at", "is", null)
      .lt("sealed_bid_announced_at", cutoff),
  ]);
  if (gamesError) {
    console.error("could not load candidate games:", gamesError.message);
    return new Response("games unavailable", { status: 500 });
  }
  if (auctionsError) {
    // Not fatal: the ordinary turn reminders below are independent of this half.
    console.error("could not load candidate auctions:", auctionsError.message);
  }
  const auctionGames = (auctions ?? []) as GameRow[];
  if ((!games || games.length === 0) && auctionGames.length === 0) {
    return new Response(JSON.stringify({ swept: 0, reminded: 0, sent: 0 }), { status: 200 });
  }

  // The current player of each candidate game, and everything needed to decide/deliver a reminder.
  const currentPlayers = ((games ?? []) as GameRow[])
    .map((game) => ({ game, player: currentTurnPlayer(game) }))
    .filter((entry) => entry.player?.user_id);
  const userIds = [...new Set(currentPlayers.map((entry) => entry.player!.user_id as string))];
  const gameIds = currentPlayers.map((entry) => entry.game.id);

  const [{ data: subscriptions }, { data: premoves }, prefsByUser] = await Promise.all([
    supabase.from("push_subscriptions").select(`${SUBSCRIPTION_COLUMNS},tz`).in("user_id", userIds),
    supabase.from("premoves").select("game_id,seat").in("game_id", gameIds),
    loadPrefsByUser(supabase, userIds),
  ]);
  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }
  const premoveSeats = new Set(
    ((premoves ?? []) as { game_id: string; seat: number }[]).map((p) => `${p.game_id}:${p.seat}`)
  );

  const { appServer, siteUrl } = await buildAppServer(cfg.value);

  let sent = 0;
  let reminded = 0;
  const gone: string[] = [];
  for (const { game } of currentPlayers) {
    const currentPlayerSubs = subsByUser.get(currentTurnPlayer(game)!.user_id as string) ?? [];
    // "If notifications enabled": no subscribed device means nothing to remind - skip without
    // stamping so the game isn't churned every hour for a player who's opted out.
    if (currentPlayerSubs.length === 0) {
      continue;
    }
    const prefs = prefsByUser.get(currentTurnPlayer(game)!.user_id as string) ?? resolvePrefs(null);
    const hasQueuedPremove = premoveSeats.has(`${game.id}:${game.current_seat}`);
    const decision = planTurnReminder(game, currentPlayerSubs, hasQueuedPremove, prefs);
    if (!decision) {
      continue;
    }
    const payload = JSON.stringify({
      title: decision.notification.title,
      body: decision.notification.body,
      tag: decision.notification.tag,
      url: `${siteUrl}/?game=${game.id}`,
    });
    const recipient = currentTurnPlayer(game)!;
    for (const sub of currentPlayerSubs) {
      if (shouldSkipTurnPushForSubscription(recipient, sub, game.id)) {
        continue;
      }
      if (await pushToSubscription(appServer, sub, payload, gone)) {
        sent++;
      }
    }
    // Stamp the game whenever the reminder was due, even if every device was skipped/unreachable:
    // the cap and 12h cadence should advance so a player with no live device doesn't get swept
    // every single hour forever.
    reminded++;
    await supabase
      .from("games")
      .update({ last_turn_reminder_at: new Date().toISOString(), turn_reminder_count: decision.reminderCount })
      .eq("id", game.id);
  }

  const auctionResult = await sweepSealedBidAuctions(supabase, auctionGames, appServer, siteUrl, gone);
  reminded += auctionResult.reminded;
  sent += auctionResult.sent;

  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", gone);
  }

  return new Response(
    JSON.stringify({ swept: (games ?? []).length + auctionGames.length, reminded, sent, deleted: gone.length }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * The reminder sweep's second pass: re-nudge everyone who still owes a bid in an open sealed-bid
 * auction (migration 20260808120000).
 *
 * Structurally different from the turn pass above for one reason: an open auction has up to five
 * people on turn simultaneously, so the decision, the cap and the cadence are all per SEAT
 * (`auction_bid_reminders`) rather than per game. Seats that have already submitted are simply not
 * in the pending set, and a fully-submitted auction is skipped entirely - the reveal is what clears
 * `sealed_bid_announced_at` and drops the game out of the candidate query for good.
 */
async function sweepSealedBidAuctions(
  supabase: SupabaseClient,
  auctionGames: GameRow[],
  appServer: AppServer,
  siteUrl: string,
  gone: string[]
): Promise<{ reminded: number; sent: number }> {
  if (auctionGames.length === 0) {
    return { reminded: 0, sent: 0 };
  }
  const gameIds = auctionGames.map((game) => game.id);
  const [{ data: bids }, { data: reminderRows }] = await Promise.all([
    supabase.from("auction_sealed_bids").select("game_id,seat").in("game_id", gameIds),
    supabase
      .from("auction_bid_reminders")
      .select("game_id,seat,reminder_count,last_reminder_at")
      .in("game_id", gameIds),
  ]);
  const submitted = new Set(((bids ?? []) as { game_id: string; seat: number }[]).map((b) => `${b.game_id}:${b.seat}`));
  const reminderByKey = new Map(
    ((reminderRows ?? []) as (AuctionReminderRow & { game_id: string })[]).map((r) => [`${r.game_id}:${r.seat}`, r])
  );

  // Only seats that still owe a bid, and only ones with a real account to push to.
  const pending = auctionGames.flatMap((game) =>
    game.players
      .filter((p) => p.user_id !== null && !submitted.has(`${game.id}:${p.seat}`))
      .map((p) => ({ game, seat: p.seat, userId: p.user_id as string }))
  );
  if (pending.length === 0) {
    return { reminded: 0, sent: 0 };
  }

  const userIds = [...new Set(pending.map((entry) => entry.userId))];
  const [{ data: subscriptions }, prefsByUser] = await Promise.all([
    supabase.from("push_subscriptions").select(`${SUBSCRIPTION_COLUMNS},tz`).in("user_id", userIds),
    loadPrefsByUser(supabase, userIds),
  ]);
  const subsByUser = new Map<string, SubscriptionRow[]>();
  for (const sub of (subscriptions ?? []) as SubscriptionRow[]) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let reminded = 0;
  let sent = 0;
  for (const { game, seat, userId } of pending) {
    const subs = subsByUser.get(userId) ?? [];
    // Same rule as the turn pass: no subscribed device means nothing to remind, and no bookkeeping
    // to advance either.
    if (subs.length === 0) {
      continue;
    }
    const prefs = prefsByUser.get(userId) ?? resolvePrefs(null);
    const key = `${game.id}:${seat}`;
    const decision = planSealedBidReminder(game, reminderByKey.get(key), subs, prefs);
    if (!decision) {
      continue;
    }
    const [notification] = buildSealedBidNotifications(game, [seat], "reminder");
    if (!notification || !isNotificationAllowed(notification, prefs)) {
      continue;
    }
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      url: `${siteUrl}/?game=${game.id}`,
    });
    const recipient = game.players.find((p) => p.seat === seat)!;
    for (const sub of subs) {
      if (shouldSkipTurnPushForSubscription(recipient, sub, game.id)) {
        continue;
      }
      if (await pushToSubscription(appServer, sub, payload, gone)) {
        sent++;
      }
    }
    reminded++;
    await supabase.from("auction_bid_reminders").upsert(
      {
        game_id: game.id,
        seat,
        reminder_count: decision.reminderCount,
        last_reminder_at: new Date().toISOString(),
      },
      { onConflict: "game_id,seat" }
    );
  }

  return { reminded, sent };
}
