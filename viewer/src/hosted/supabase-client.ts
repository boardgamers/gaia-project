import { supabaseConfig } from "./config";
import {
  CommitTurnArgs,
  GameRow,
  HostedBackend,
  MoveRow,
  PlayerRow,
  PremoveFailureRow,
  PremoveRow,
} from "./types";

// supabase-js v2 is loaded at runtime from its self-contained UMD bundle
// instead of npm: this repo's webpack 4 cannot parse post-ES2019 syntax
// inside node_modules, and the library's type declarations need TS >= 4
// (the viewer pins 3.9). The browser parses the bundle, webpack and tsc
// never see it. Version-pinned so a CDN release can't change behavior.
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

// Minimal structural typing for the slice of the client we use.
export type SupabaseClient = any;

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SUPABASE_JS_URL;
      script.async = true;
      script.onload = () => {
        const factory = (window as any).supabase;
        if (!factory) {
          reject(new Error("supabase-js loaded but window.supabase is missing"));
          return;
        }
        resolve(
          factory.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          })
        );
      };
      script.onerror = () => reject(new Error(`could not load supabase-js from ${SUPABASE_JS_URL}`));
      document.head.appendChild(script);
    });
  }
  return clientPromise;
}

async function unwrap<T>(query: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export function createSupabaseBackend(client: SupabaseClient): HostedBackend {
  return {
    fetchGame: (gameId): Promise<GameRow> => unwrap(client.from("games").select("*").eq("id", gameId).single()),
    fetchPlayers: (gameId): Promise<PlayerRow[]> =>
      unwrap(client.from("players").select("*").eq("game_id", gameId).order("seat")),
    fetchMoves: (gameId): Promise<MoveRow[]> =>
      unwrap(client.from("moves").select("game_id,seq,seat,move").eq("game_id", gameId).order("seq")),
    commitTurn: (args: CommitTurnArgs): Promise<void> =>
      unwrap(
        client.rpc("commit_turn", {
          p_game_id: args.gameId,
          p_seq: args.seq,
          p_seat: args.seat,
          p_move: args.move,
          p_next_seat: args.nextSeat,
          p_finished: args.finished,
          p_current_round: args.currentRound,
          p_player_updates: args.playerUpdates,
        })
      ),
    // RLS already scopes these to the caller's own seats (0010_premoves.sql), so no seat filter.
    fetchPremoves: (gameId): Promise<PremoveRow[]> =>
      unwrap(client.from("premoves").select("seat,seq,move,queued_move_count").eq("game_id", gameId).order("seq")),
    fetchPremoveFailures: (gameId): Promise<PremoveFailureRow[]> =>
      unwrap(
        client
          .from("premove_failures")
          .select("id,seat,move,reason,read_at")
          .eq("game_id", gameId)
          .is("read_at", null)
          .order("created_at")
      ),
    queuePremove: (gameId, seat, move): Promise<number> =>
      unwrap(client.rpc("queue_premove", { p_game_id: gameId, p_seat: seat, p_move: move })),
    cancelPremove: (gameId, seat, seq): Promise<void> =>
      unwrap(client.rpc("cancel_premove", { p_game_id: gameId, p_seat: seat, p_seq: seq })),
    markPremoveFailureRead: (id): Promise<void> => unwrap(client.rpc("mark_premove_failure_read", { p_id: id })),
  };
}

/**
 * Realtime fan-out for committed moves. `onInsert` gets each new row;
 * `onCatchUp` fires every time the channel (re)subscribes, so the caller can
 * resync anything missed while disconnected.
 */
export function subscribeMoves(
  client: SupabaseClient,
  gameId: string,
  onInsert: (row: MoveRow) => void,
  onCatchUp: () => void
): () => void {
  const channel = client
    .channel(`moves-${gameId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "moves", filter: `game_id=eq.${gameId}` },
      (payload: { new: MoveRow }) => onInsert(payload.new)
    )
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        onCatchUp();
      }
    });
  return () => {
    client.removeChannel(channel);
  };
}
