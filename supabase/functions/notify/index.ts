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
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
} from "./logic.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const { type, game_id, sender_id, author_name, body: chatBody } = await req.json();
  if (!game_id || (type !== "insert" && type !== "update" && type !== "chat")) {
    return new Response("bad request", { status: 400 });
  }
  if (type === "chat" && (!sender_id || !author_name || !chatBody)) {
    return new Response("bad request", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
  const notifications = buildNotifications(type, game as GameRow, hasQueuedPremove, chatMessage);
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

  const vapidKeys = await webpush.importVapidKeys(cfg.value.keys, { extractable: false });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: cfg.value.subject,
    vapidKeys,
  });
  const siteUrl: string = (cfg.value.site_url ?? "").replace(/\/$/, "");

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
      try {
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        });
        await subscriber.pushTextMessage(payload, {});
        sent++;
      } catch (err) {
        if (err instanceof webpush.PushMessageError && err.isGone()) {
          gone.push(sub.id);
        } else {
          console.error(`push to ${sub.endpoint} failed:`, err instanceof Error ? err.message : err);
        }
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
