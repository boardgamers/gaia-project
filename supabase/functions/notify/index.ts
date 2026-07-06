// Turn/invite/finish push notifications (BACKEND.md §6, §J4 as amended).
//
// Called by the pg_net trigger on the games table with {type, game_id}
// (type "insert" = game created, "update" = current_seat/status changed).
// Reads everything it needs (game, players, subscriptions, VAPID keys) with
// the service role — it never runs the game engine.
//
// app_config['vapid'] value shape (seeded out-of-band, never committed):
//   { keys: { publicKey: JWK, privateKey: JWK }, subject: "mailto:...",
//     site_url: "https://..." }

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

type PlayerRow = {
  seat: number;
  user_id: string | null;
  invited_email: string;
  display_name: string;
  last_active_at: string | null;
};

// Comfortably larger than the client's own heartbeat interval (viewer/src/hosted.ts, ~20s while
// the tab is open and visible) so ordinary network/timer jitter never produces a false "they have
// it open" - but still short enough that closing the tab quickly resumes normal notifications.
const RECENTLY_ACTIVE_MS = 45_000;

function hasGameOpen(player: PlayerRow, now: number): boolean {
  if (!player.last_active_at) {
    return false;
  }
  return now - new Date(player.last_active_at).getTime() < RECENTLY_ACTIVE_MS;
}

type GameRow = {
  id: string;
  name: string;
  status: string;
  current_seat: number | null;
  created_by: string;
  last_committed_by: string | null;
  players: PlayerRow[];
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type Notification = { userId: string; title: string; body: string; tag: string };

function gameLabel(game: GameRow): string {
  return game.name || "your Lost Fleet game";
}

function buildNotifications(type: string, game: GameRow, hasQueuedPremove: boolean, now: number = Date.now()): Notification[] {
  if (type === "insert") {
    // Invite pushes reach only friends who already have an account + a
    // subscribed device; everyone else gets the link out-of-band.
    return game.players
      .filter((p) => p.user_id !== null && p.user_id !== game.created_by)
      .map((p) => ({
        userId: p.user_id!,
        title: "The Lost Fleet",
        body: `You've been invited to ${gameLabel(game)}.`,
        tag: `invite-${game.id}`,
      }));
  }
  if (game.status === "finished") {
    return game.players
      .filter((p) => p.user_id !== null)
      .map((p) => ({
        userId: p.user_id!,
        title: "The Lost Fleet",
        body: `${gameLabel(game)} is finished — come see the final scores.`,
        tag: `finished-${game.id}`,
      }));
  }
  const current = game.players.find((p) => p.seat === game.current_seat);
  if (!current || current.user_id === null || current.user_id === game.last_committed_by) {
    return [];
  }
  // Gaia 9 (PROGRESS.md): only push "your turn" when the player doesn't already have the game
  // open (hasGameOpen, via the mark_seat_active heartbeat) AND no premove is queued to play the
  // move for them automatically (hasQueuedPremove - a straight readback of the same existence
  // check notify_resolve_automation already does in Postgres, see 0010_premoves.sql).
  if (hasGameOpen(current, now) || hasQueuedPremove) {
    return [];
  }
  return [
    {
      userId: current.user_id,
      title: "The Lost Fleet",
      body: `Your turn in ${gameLabel(game)}.`,
      tag: `turn-${game.id}`,
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  const { type, game_id } = await req.json();
  if (!game_id || (type !== "insert" && type !== "update")) {
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

  const notifications = buildNotifications(type, game as GameRow, hasQueuedPremove);
  if (notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
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
