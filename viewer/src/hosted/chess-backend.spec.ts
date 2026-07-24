/* eslint-disable @typescript-eslint/camelcase */
// Assertions intentionally use Supabase wire names.
import { expect } from "chai";
import { ChessRow } from "../logic/chess-backend";
import { createSupabaseChessBackend } from "./chess-backend";

function makeClient(row: ChessRow | null = null) {
  const calls = {
    selected: "",
    filters: [] as Array<[string, string]>,
    rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
    channelName: "",
    changeFilter: null as any,
    changeHandler: null as ((payload: { new?: ChessRow }) => void) | null,
    removed: false,
  };
  const query: any = {
    select(columns: string) {
      calls.selected = columns;
      return query;
    },
    eq(column: string, value: string) {
      calls.filters.push([column, value]);
      return query;
    },
    async maybeSingle() {
      return { data: row, error: null };
    },
  };
  const channel: any = {
    on(_event: string, filter: any, handler: (payload: { new?: ChessRow }) => void) {
      calls.changeFilter = filter;
      calls.changeHandler = handler;
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const client: any = {
    from() {
      return query;
    },
    channel(name: string) {
      calls.channelName = name;
      return channel;
    },
    removeChannel() {
      calls.removed = true;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.rpc.push({ name, args });
      return { data: name === "move_chess" ? args.p_next_fen : null, error: null };
    },
  };
  return { client, calls };
}

describe("Supabase chess backend", () => {
  const gameId = "11111111-1111-4111-8111-111111111111";

  it("loads and subscribes to only the current Gaia game's board", async () => {
    const row: ChessRow = { fen: "fen", white_user: "white", black_user: null };
    const { client, calls } = makeClient(row);
    const backend = createSupabaseChessBackend(client, gameId, "white");

    expect(await backend.load()).to.deep.equal(row);
    expect(calls.selected).to.equal("fen,white_user,black_user");
    expect(calls.filters).to.deep.equal([["game_id", gameId]]);

    let received: ChessRow | null = null;
    const unsubscribe = backend.subscribe((next) => (received = next));
    expect(calls.channelName).to.equal(`chess-board-${gameId}`);
    expect(calls.changeFilter).to.deep.include({
      event: "*",
      schema: "public",
      table: "chess_board",
      filter: `game_id=eq.${gameId}`,
    });
    calls.changeHandler?.({ new: row });
    expect(received).to.deep.equal(row);
    unsubscribe();
    expect(calls.removed).to.equal(true);
  });

  it("scopes every write RPC to the current Gaia game", async () => {
    const { client, calls } = makeClient();
    const backend = createSupabaseChessBackend(client, gameId, "white");

    await backend.claim("w");
    await backend.move("before", "after");
    await backend.reset();
    await backend.leave();

    expect(calls.rpc).to.deep.equal([
      { name: "claim_chess_color", args: { p_game_id: gameId, p_color: "w" } },
      {
        name: "move_chess",
        args: { p_game_id: gameId, p_prev_fen: "before", p_next_fen: "after" },
      },
      { name: "reset_chess", args: { p_game_id: gameId } },
      { name: "leave_chess_seat", args: { p_game_id: gameId } },
    ]);
  });
});
