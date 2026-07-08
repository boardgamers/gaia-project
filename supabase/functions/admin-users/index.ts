import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ADMIN_EMAIL = "kim.pham.nguyen2@gmail.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type PlayerRow = {
  user_id: string | null;
  invited_email: string;
  game_id: string;
};

type GameRow = {
  id: string;
  created_by: string;
  status: string;
};

type SubscriptionRow = {
  user_id: string;
};

function displayName(user: AuthUser): string {
  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name;
  const name = metadata.name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  return (user.email ?? "").split("@")[0] ?? "";
}

async function requireAdmin(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) {
    return { error: new Response("missing authorization", { status: 401 }) };
  }

  const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: token } },
  });
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();
  if (error || !user) {
    return { error: new Response("invalid user", { status: 401 }) };
  }
  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL) {
    return { error: new Response("forbidden", { status: 403 }) };
  }
  return { user };
}

async function listAllUsers(service: ReturnType<typeof createClient>): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const {
      data: { users: batch },
      error,
    } = await service.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    users.push(...((batch ?? []) as AuthUser[]));
    if (!batch || batch.length < perPage) {
      return users;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  const adminCheck = await requireAdmin(req);
  if (adminCheck.error) {
    return new Response(await adminCheck.error.text(), { status: adminCheck.error.status, headers: corsHeaders });
  }

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: { action?: string; userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  try {
    if (body.action === "delete") {
      if (!body.userId) {
        return new Response("userId required", { status: 400, headers: corsHeaders });
      }
      if (body.userId === adminCheck.user.id) {
        return new Response("cannot delete your own admin account", { status: 400, headers: corsHeaders });
      }

      await service.from("push_subscriptions").delete().eq("user_id", body.userId);
      const { error } = await service.auth.admin.deleteUser(body.userId, true);
      if (error) {
        throw error;
      }
      return new Response(JSON.stringify({ ok: true, message: "User deleted." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action !== "list") {
      return new Response("unknown action", { status: 400, headers: corsHeaders });
    }

    const [users, playersResult, gamesResult, subscriptionsResult] = await Promise.all([
      listAllUsers(service),
      service.from("players").select("user_id,invited_email,game_id"),
      service.from("games").select("id,created_by,status"),
      service.from("push_subscriptions").select("user_id"),
    ]);
    if (playersResult.error) {
      throw playersResult.error;
    }
    if (gamesResult.error) {
      throw gamesResult.error;
    }
    if (subscriptionsResult.error) {
      throw subscriptionsResult.error;
    }

    const players = (playersResult.data ?? []) as PlayerRow[];
    const games = (gamesResult.data ?? []) as GameRow[];
    const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
    const activeGameIds = new Set(games.filter((game) => game.status === "active").map((game) => game.id));

    const payload = users
      .filter((user) => !!user.email)
      .map((user) => {
        const email = (user.email ?? "").toLowerCase();
        const claimedSeats = players.filter((player) => player.user_id === user.id);
        const invitedSeats = players.filter((player) => player.user_id === user.id || player.invited_email === email);
        const activeGames = new Set(invitedSeats.map((player) => player.game_id).filter((gameId) => activeGameIds.has(gameId)));
        return {
          id: user.id,
          email: user.email,
          display_name: displayName(user),
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          invited_seats: invitedSeats.length,
          claimed_seats: claimedSeats.length,
          games_created: games.filter((game) => game.created_by === user.id).length,
          active_games: activeGames.size,
          subscription_count: subscriptions.filter((subscription) => subscription.user_id === user.id).length,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return new Response(JSON.stringify({ users: payload }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-users failed:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
