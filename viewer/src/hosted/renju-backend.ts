/* eslint-disable @typescript-eslint/camelcase */
// Supabase row/RPC wire names are snake_case. Structurally identical to hosted/chess-backend.ts -
// see that file for why each of these steps exists (they were all learned from live play).
import { RenjuBackend, RenjuRow } from "../logic/renju-backend";
import { SupabaseClient } from "./supabase-client";

function throwIfError(error: any): void {
  if (error) {
    throw error;
  }
}

export function createSupabaseRenjuBackend(client: SupabaseClient, gameId: string, userId: string): RenjuBackend {
  const listeners = new Set<(row: RenjuRow) => void>();
  let channel: any = null;

  const load = async (): Promise<RenjuRow | null> => {
    const { data, error } = await client.rpc("ensure_renju_assignment", { p_game_id: gameId });
    throwIfError(error);
    // PostgREST returns a composite row as an object; older gateways expose it as a singleton array.
    return (Array.isArray(data) ? data[0] : data) ?? null;
  };

  const emit = (row: RenjuRow) => {
    for (const listener of listeners) {
      listener(row);
    }
  };

  const ensureSubscribed = () => {
    if (channel) {
      return;
    }
    channel = client
      .channel(`renju-board-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "renju_board",
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { new?: RenjuRow }) => {
          if (payload.new?.board) {
            emit(payload.new);
          }
        }
      )
      .subscribe((status: string) => {
        // Close the small load->subscribe race: once the channel is live, read the row once more in
        // case a stone or panel switch landed during subscription.
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
    async move(previousBoard: string, nextBoard: string, index: number): Promise<string> {
      const { data, error } = await client.rpc("move_renju", {
        p_game_id: gameId,
        p_prev_board: previousBoard,
        p_next_board: nextBoard,
        p_index: index,
      });
      throwIfError(error);
      return typeof data === "string" ? data : nextBoard;
    },
    async reset(): Promise<void> {
      const { error } = await client.rpc("reset_renju", { p_game_id: gameId });
      throwIfError(error);
    },
  };
}
