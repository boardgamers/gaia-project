/* eslint-disable @typescript-eslint/camelcase */
// Supabase row/RPC wire names are snake_case.
import { ChessBackend, ChessRow } from "../logic/chess-backend";
import { Orientation } from "../logic/chess";
import { SupabaseClient } from "./supabase-client";

function throwIfError(error: any): void {
  if (error) {
    throw error;
  }
}

export function createSupabaseChessBackend(client: SupabaseClient, gameId: string, userId: string): ChessBackend {
  const load = async (): Promise<ChessRow | null> => {
    const { data, error } = await client
      .from("chess_board")
      .select("fen,white_user,black_user")
      .eq("game_id", gameId)
      .maybeSingle();
    throwIfError(error);
    return data ?? null;
  };

  return {
    gameId,
    userId,
    load,
    subscribe(onRow) {
      const channel = client
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
              onRow(payload.new);
            }
          }
        )
        .subscribe((status: string) => {
          // Close the small load->subscribe race: once the channel is confirmed live, read the
          // current row once more in case a move landed between the initial load and subscription.
          if (status === "SUBSCRIBED") {
            load()
              .then((row) => {
                if (row) {
                  onRow(row);
                }
              })
              .catch(() => undefined);
          }
        });
      return () => {
        client.removeChannel(channel);
      };
    },
    async claim(color: Orientation): Promise<void> {
      const { error } = await client.rpc("claim_chess_color", {
        p_game_id: gameId,
        p_color: color,
      });
      throwIfError(error);
    },
    async leave(): Promise<void> {
      const { error } = await client.rpc("leave_chess_seat", { p_game_id: gameId });
      throwIfError(error);
    },
    async move(previousFen: string, nextFen: string): Promise<string> {
      const { data, error } = await client.rpc("move_chess", {
        p_game_id: gameId,
        p_prev_fen: previousFen,
        p_next_fen: nextFen,
      });
      throwIfError(error);
      return typeof data === "string" ? data : nextFen;
    },
    async reset(): Promise<void> {
      const { error } = await client.rpc("reset_chess", { p_game_id: gameId });
      throwIfError(error);
    },
  };
}
