import { supabaseConfig } from "./config";
import {
  CommitTurnArgs,
  GameRow,
  HostedBackend,
  MoveRow,
  PlayerRow,
  PremoveFailureRow,
  PremoveRow,
  SealedBidEntry,
  SealedBidStatus,
} from "./types";

// supabase-js v2 is loaded at runtime from its self-contained UMD bundle
// instead of npm: this repo's webpack 4 cannot parse post-ES2019 syntax
// inside node_modules, and the library's type declarations need TS >= 4
// (the viewer pins 3.9). The browser parses the bundle, webpack and tsc
// never see it. Version-pinned so a CDN release can't change behavior.
//
// Bumped from 2.45.4 (2024) to 2.110.0 (PROGRESS.md Gaia 10): confirmed live against the real
// project that 2.45.4's realtime-js never delivers a "sync"/"join" event for a private Presence
// channel (subscribe + track() both silently succeed, but the state stays permanently empty on
// every client, self included) - this project's Realtime server expects the newer Authorization
// handshake that 2.45.4 predates. 2.110.0 was verified end-to-end (two real signed-in browsers,
// cross-tab presence sync) against this exact project before the bump.
const SUPABASE_JS_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.js";

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
    claimMySeats: (): Promise<void> => unwrap(client.rpc("claim_my_seats")),
    repairMoveCount: (gameId): Promise<number> => unwrap(client.rpc("repair_game_move_count", { p_game_id: gameId })),
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
          p_latest_move_summary: args.latestMoveSummary,
          p_player_updates: args.playerUpdates,
        })
      ),
    // RLS already scopes these to the caller's own seats (0010_premoves.sql), so no seat filter.
    fetchPremoves: (gameId): Promise<PremoveRow[]> =>
      unwrap(client.from("premoves").select("seat,seq,move,mode,queued_move_count").eq("game_id", gameId).order("seq")),
    fetchPremoveFailures: (gameId): Promise<PremoveFailureRow[]> =>
      unwrap(
        client
          .from("premove_failures")
          .select("id,seat,move,reason,read_at")
          .eq("game_id", gameId)
          .is("read_at", null)
          .order("created_at")
      ),
    queuePremove: (gameId, seat, move, mode): Promise<number> =>
      unwrap(client.rpc("queue_premove", { p_game_id: gameId, p_seat: seat, p_move: move, p_mode: mode })),
    cancelPremove: (gameId, seat, seq): Promise<void> =>
      unwrap(client.rpc("cancel_premove", { p_game_id: gameId, p_seat: seat, p_seq: seq })),
    editPremove: (gameId, seat, seq, move): Promise<void> =>
      unwrap(client.rpc("edit_premove", { p_game_id: gameId, p_seat: seat, p_seq: seq, p_move: move })),
    cancelAllPremoves: (gameId, seat): Promise<void> =>
      unwrap(client.rpc("cancel_all_premoves", { p_game_id: gameId, p_seat: seat })),
    reorderPremove: (gameId, seat, seq, direction): Promise<void> =>
      unwrap(client.rpc("reorder_premove", { p_game_id: gameId, p_seat: seat, p_seq: seq, p_direction: direction })),
    markPremoveFailureRead: (id): Promise<void> => unwrap(client.rpc("mark_premove_failure_read", { p_id: id })),
    setAutoCharge: (gameId, seat, pref): Promise<void> =>
      unwrap(client.rpc("set_auto_charge", { p_game_id: gameId, p_seat: seat, p_pref: pref })),
    // Preference Split Auction (migration 20260805120000). Note that nothing here ever selects
    // from `auction_sealed_bids` directly: `sealed_bid_status` returns progress only, and the
    // points themselves are read exclusively by the server, inside `reveal_sealed_bids`.
    fetchSealedBidStatus: async (gameId): Promise<SealedBidStatus> => {
      const raw = await unwrap<any>(client.rpc("sealed_bid_status", { p_game_id: gameId }));
      return {
        playerCount: raw?.player_count ?? 0,
        budget: raw?.budget ?? 0,
        submittedSeats: raw?.submitted_seats ?? [],
      };
    },
    announceSealedBidAuction: (gameId): Promise<boolean> =>
      unwrap(client.rpc("announce_sealed_bid_auction", { p_game_id: gameId })),
    submitSealedBid: (gameId, seat, bids): Promise<number> =>
      unwrap(client.rpc("submit_sealed_bid", { p_game_id: gameId, p_seat: seat, p_bids: bids })),
    fetchSealedBids: (gameId): Promise<{ seat: number; bids: SealedBidEntry[] }[]> =>
      unwrap(client.from("auction_sealed_bids").select("seat,bids").eq("game_id", gameId).order("seat")),
    revealSealedBids: (gameId, seq, nextSeat): Promise<number> =>
      unwrap(client.rpc("reveal_sealed_bids", { p_game_id: gameId, p_seq: seq, p_next_seat: nextSeat })),
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
