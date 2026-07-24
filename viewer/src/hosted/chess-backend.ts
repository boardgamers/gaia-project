/* eslint-disable @typescript-eslint/camelcase */
// Supabase row/RPC wire names are snake_case.
import { ChessBackend, ChessPanelMode, ChessRow } from "../logic/chess-backend";
import { SupabaseClient } from "./supabase-client";

function throwIfError(error: any): void {
  if (error) {
    throw error;
  }
}

function isPanelPermissionError(error: any): boolean {
  return typeof error?.message === "string" && error.message.includes("only a player in this game can switch");
}

export function createSupabaseChessBackend(client: SupabaseClient, gameId: string, userId: string): ChessBackend {
  const listeners = new Set<(row: ChessRow) => void>();
  let channel: any = null;

  const load = async (): Promise<ChessRow | null> => {
    const { data, error } = await client.rpc("ensure_chess_assignment", { p_game_id: gameId });
    throwIfError(error);
    // PostgREST returns a composite row as an object. Keep the array fallback for older gateways
    // that expose a one-row composite result as a singleton array.
    return (Array.isArray(data) ? data[0] : data) ?? null;
  };

  const emit = (row: ChessRow) => {
    for (const listener of listeners) {
      listener(row);
    }
  };

  const ensureSubscribed = () => {
    if (channel) {
      return;
    }
    channel = client
      .channel(`chess-board-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chess_board",
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { new?: ChessRow }) => {
          if (payload.new?.fen) {
            emit(payload.new);
          }
        }
      )
      .subscribe((status: string) => {
        // Close the small load->subscribe race: once the channel is confirmed live, read the
        // current row once more in case a move or panel switch landed during subscription.
        if (status === "SUBSCRIBED") {
          load()
            .then((row) => {
              if (row) {
                emit(row);
              }
            })
            .catch(() => undefined);
        }
      });
  };

  return {
    gameId,
    userId,
    load,
    subscribe(onRow) {
      listeners.add(onRow);
      ensureSubscribed();
      return () => {
        listeners.delete(onRow);
        if (listeners.size === 0 && channel) {
          const unusedChannel = channel;
          channel = null;
          client.removeChannel(unusedChannel);
        }
      };
    },
    async move(previousFen: string, nextFen: string, from: string, to: string): Promise<string> {
      const { data, error } = await client.rpc("move_chess", {
        p_game_id: gameId,
        p_prev_fen: previousFen,
        p_next_fen: nextFen,
        p_move_from: from,
        p_move_to: to,
      });
      throwIfError(error);
      return typeof data === "string" ? data : nextFen;
    },
    async reset(): Promise<void> {
      const { error } = await client.rpc("reset_chess", { p_game_id: gameId });
      throwIfError(error);
    },
    async setPanelMode(mode: ChessPanelMode): Promise<ChessRow | null> {
      // A player can arrive through an invitation after this browser session first loaded. Reclaim
      // that seat immediately before the membership-checked write so the first drawer swipe cannot
      // be rejected and snap back while the normal hosted-game bootstrap is still catching up.
      const { error: claimError } = await client.rpc("claim_my_seats", {});
      throwIfError(claimError);
      const { error } = await client.rpc("set_chess_panel_mode", {
        p_game_id: gameId,
        p_mode: mode,
      });
      if (isPanelPermissionError(error)) {
        // Spectators may browse either face locally, but must not change the shared face for the
        // seated players. Refresh/emit the shared row while Pool.vue still has its optimistic write
        // pending so it can establish the baseline without visibly snapping back.
        const row = await load().catch(() => null);
        if (row) {
          emit(row);
        }
        return null;
      }
      throwIfError(error);
      // Return the committed row. Pool.vue uses it to order this write against the initial load and
      // the subscription's catch-up load, either of which may have started before the swipe.
      // The write is already committed at this point, so a follow-up read failure must not make the
      // optimistic face snap back as though the write itself failed.
      return load().catch(() => null);
    },
  };
}
