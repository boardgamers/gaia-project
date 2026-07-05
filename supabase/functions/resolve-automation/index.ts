// The offline premove commit path (PREMOVE_PLAN.md §4c). Triggered by the `games_resolve_automation`
// trigger (0010/0011_*.sql) whenever current_seat changes AND that seat has a premove queued or
// auto-charge enabled (Phase 2). Payload: {game_id, seat}. Resolves exactly ONE committed turn per
// invocation and returns - a successful commit changes current_seat again, which re-fires the
// trigger for whatever's next.
//
// The actual decision logic lives in logic.ts (plain TS, no Deno/network dependency, unit-testable
// with a fake backend); this file is just the Deno.serve + service-role-client plumbing around it,
// mirroring supabase/functions/notify/index.ts's own shape.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Engine, Phase, parseAutoChargePreference } from "../_shared/engine.bundle.js";
import { Backend, CommitAutomatedTurnArgs, GameRow, MoveRow, PremoveRow, resolveOneAutomatedTurn } from "./logic.ts";

function makeBackend(supabase: ReturnType<typeof createClient>): Backend {
  return {
    async fetchGame(gameId: string): Promise<GameRow> {
      const { data, error } = await supabase
        .from("games")
        .select("id,seed,player_count,options,move_count")
        .eq("id", gameId)
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "game not found");
      }
      return data as GameRow;
    },
    async fetchMoves(gameId: string): Promise<MoveRow[]> {
      const { data, error } = await supabase
        .from("moves")
        .select("seq,move")
        .eq("game_id", gameId)
        .order("seq", { ascending: true });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as MoveRow[];
    },
    async fetchLowestSeqPremove(gameId: string, seat: number): Promise<PremoveRow | null> {
      const { data, error } = await supabase
        .from("premoves")
        .select("seq,move")
        .eq("game_id", gameId)
        .eq("seat", seat)
        .order("seq", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return (data as PremoveRow | null) ?? null;
    },
    async deletePremove(gameId: string, seat: number, seq: number): Promise<void> {
      const { error } = await supabase
        .from("premoves")
        .delete()
        .eq("game_id", gameId)
        .eq("seat", seat)
        .eq("seq", seq);
      if (error) {
        throw new Error(error.message);
      }
    },
    async insertPremoveFailure(gameId: string, seat: number, move: string, reason: string): Promise<void> {
      const { error } = await supabase
        .from("premove_failures")
        .insert({ game_id: gameId, seat, move, reason });
      if (error) {
        throw new Error(error.message);
      }
    },
    async commitAutomatedTurn(args: CommitAutomatedTurnArgs): Promise<void> {
      const { error } = await supabase.rpc("commit_automated_turn", {
        p_game_id: args.gameId,
        p_seq: args.seq,
        p_seat: args.seat,
        p_move: args.move,
        p_next_seat: args.nextSeat,
        p_finished: args.finished,
        p_current_round: args.currentRound,
        p_player_updates: args.playerUpdates,
      });
      if (error) {
        throw new Error(error.message);
      }
    },
    async fetchAutoCharge(gameId: string, seat: number): Promise<string> {
      const { data, error } = await supabase
        .from("players")
        .select("auto_charge")
        .eq("game_id", gameId)
        .eq("seat", seat)
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "player not found");
      }
      return data.auto_charge ?? "ask";
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  let game_id: string | undefined;
  let seat: number | undefined;
  try {
    ({ game_id, seat } = await req.json());
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (!game_id || seat === undefined || seat === null) {
    return new Response("game_id and seat required", { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const result = await resolveOneAutomatedTurn(
      { Engine, Phase, parseAutoChargePreference },
      makeBackend(supabase),
      game_id,
      seat
    );
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("resolve-automation failed:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
