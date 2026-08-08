/* eslint-disable @typescript-eslint/camelcase */
import { UltimateTicTacToeBackend, UltimateTicTacToeRow } from "../logic/ultimate-tic-tac-toe-backend";
import { SupabaseClient } from "./supabase-client";

function throwIfError(error: any): void {
  if (error) {
    throw error;
  }
}

export function createSupabaseUltimateTicTacToeBackend(
  client: SupabaseClient,
  gameId: string,
  userId: string
): UltimateTicTacToeBackend {
  const listeners = new Set<(row: UltimateTicTacToeRow) => void>();
  let channel: any = null;

  const load = async (): Promise<UltimateTicTacToeRow | null> => {
    const { data, error } = await client.rpc("ensure_ultimate_ttt_assignment", { p_game_id: gameId });
    throwIfError(error);
    return (Array.isArray(data) ? data[0] : data) ?? null;
  };

  const emit = (row: UltimateTicTacToeRow) => {
    for (const listener of listeners) {
      listener(row);
    }
  };

  const ensureSubscribed = () => {
    if (channel) {
      return;
    }
    channel = client
      .channel(`ultimate-ttt-board-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ultimate_ttt_board",
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { new?: UltimateTicTacToeRow }) => {
          if (payload.new?.board) {
            emit(payload.new);
          }
        }
      )
      .subscribe((status: string) => {
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
      const { data, error } = await client.rpc("move_ultimate_ttt", {
        p_game_id: gameId,
        p_prev_board: previousBoard,
        p_next_board: nextBoard,
        p_index: index,
      });
      throwIfError(error);
      return typeof data === "string" ? data : nextBoard;
    },
    async reset(): Promise<void> {
      const { error } = await client.rpc("reset_ultimate_ttt", { p_game_id: gameId });
      throwIfError(error);
    },
  };
}
