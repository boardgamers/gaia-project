// Turn/invite/finish/chat push notifications (BACKEND.md §6, §J4 as amended).
//
// Called by the pg_net trigger on the games table with {type, game_id}
// (type "insert" = game created, "update" = current_seat/status changed), or by the trigger on
// game_chat_messages with {type: "chat", game_id, sender_id, author_name, body}.
// Reads everything it needs (game, players, subscriptions, VAPID keys) with
// the service role - it never runs the game engine.
//
// app_config['vapid'] value shape (seeded out-of-band, never committed):
//   { keys: { publicKey: JWK, privateKey: JWK }, subject: "mailto:...",
//     site_url: "https://..." }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

import {
  buildNotifications,
  currentTurnPlayer,
  GameRow,
  planTurnReminder,
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
  TURN_REMINDER_AFTER_MS,
} from "./logic.ts";

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

  if (!game_id || (type !== "insert" && type !== "update" && type !== "chat")) {
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

  const notifications = buildNotifications(type, game as GameRow, hasQueuedPremove, chatMessage, mutedUserIds);
  if (notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }
  const turnPlayer = notifications.some((notification) => notification.kind === "turn")
    ? currentTurnPlayer(game as GameRow)
    : undefined;
  const playerByUserId = new Map(
    (game as GameRow).players.filter((p) => p.user_id).map((p) => [p.user_id as string, p])
  );

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,user_agent")
    .in("user_id", userIds);
  if (subsError) {
    console.error("could not load subscriptions:", subsError.message);
    return new Response("subscriptions unavailable", { status: 500 });
  }

  const { appServer, siteUrl } = await buildAppServer(cfg.value);

  let sent = 0;
  const gone: string[] = [];
  for (const notification of notifications) {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag,
      url: `${siteUrl}/?game=${game_id}`,
    });
    for (const sub of (subscriptions ?? []).filter((s: SubscriptionRow) => s.user_id === notification.userId)) {
      // Desktop subscriptions are intentionally "more sensitive": if it's your turn (or someone
      // just chatted), they still get the push even while the game is already open. Mobile/PWA
      // subscriptions keep the old suppression behavior to avoid duplicate alerts while actively
      // playing there - each recipient's OWN player row (not just the current turn player) decides
      // this for "message" notifications, since any seated player can receive a chat push.
      const recipient = notification.kind === "turn" ? turnPlayer : playerByUserId.get(notification.userId);
      if (
        (notification.kind === "turn" || notification.kind === "message") &&
        recipient &&
        shouldSkipTurnPushForSubscription(recipient, sub)
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

// Hourly pg_cron entry point (migration 20260721_turn_reminders): finds every active game whose
// current player has let their turn go idle past the reminder threshold and re-nudges them, subject
// to the per-turn cap and their local quiet hours (planTurnReminder). Loads its own config/state
// with the service role - it never runs the game engine.
async function runReminderSweep(supabase: SupabaseClient): Promise<Response> {
  const { data: cfg, error: cfgError } = await supabase.from("app_config").select("value").eq("key", "vapid").single();
  if (cfgError || !cfg) {
    console.error("vapid config missing:", cfgError?.message);
    return new Response("vapid config missing", { status: 500 });
  }

  const cutoff = new Date(Date.now() - TURN_REMINDER_AFTER_MS).toISOString();
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("*, players(*)")
    .eq("status", "active")
    .not("current_seat", "is", null)
    .not("latest_move_committed_at", "is", null)
    .lt("latest_move_committed_at", cutoff);
  if (gamesError) {
    console.error("could not load candidate games:", gamesError.message);
    return new Response("games unavailable", { status: 500 });
  }
  if (!games || games.length === 0) {
    return new Response(JSON.stringify({ swept: 0, reminded: 0, sent: 0 }), { status: 200 });
  }

  // The current player of each candidate game, and everything needed to decide/deliver a reminder.
  const currentPlayers = (games as GameRow[])
    .map((game) => ({ game, player: currentTurnPlayer(game) }))
    .filter((entry) => entry.player?.user_id);
  const userIds = [...new Set(currentPlayers.map((entry) => entry.player!.user_id as string))];
  const gameIds = currentPlayers.map((entry) => entry.game.id);

  const [{ data: subscriptions }, { data: premoves }] = await Promise.all([
    supabase.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,user_agent,tz").in("user_id", userIds),
    supabase.from("premoves").select("game_id,seat").in("game_id", gameIds),
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
    const hasQueuedPremove = premoveSeats.has(`${game.id}:${game.current_seat}`);
    const decision = planTurnReminder(game, currentPlayerSubs, hasQueuedPremove);
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
      if (shouldSkipTurnPushForSubscription(recipient, sub)) {
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

  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", gone);
  }

  return new Response(JSON.stringify({ swept: games.length, reminded, sent, deleted: gone.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
