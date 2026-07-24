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
    channelCount: 0,
    changeFilter: null as any,
    changeHandler: null as ((payload: { new?: ChessRow }) => void) | null,
    statusHandler: null as ((status: string) => void) | null,
    removedCount: 0,
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
    subscribe(handler: (status: string) => void) {
      calls.statusHandler = handler;
      return channel;
    },
  };
  const client: any = {
    from() {
      return query;
    },
    channel(name: string) {
      calls.channelName = name;
      calls.channelCount += 1;
      return channel;
    },
    removeChannel() {
      calls.removedCount += 1;
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

  it("loads and multicasts one current-game Realtime subscription to every board listener", async () => {
    const row: ChessRow = {
      fen: "fen",
      white_user: "white",
      white_user_2: "white-two",
      black_user: null,
      black_user_2: null,
      white_next_user: "white-two",
      black_next_user: null,
      panel_mode: "pool",
    };
    const { client, calls } = makeClient(row);
    const backend = createSupabaseChessBackend(client, gameId, "white");

    expect(await backend.load()).to.deep.equal(row);
    expect(calls.selected).to.equal(
      "fen,white_user,white_user_2,black_user,black_user_2,white_next_user,black_next_user,panel_mode"
    );
    expect(calls.filters).to.deep.equal([["game_id", gameId]]);

    let receivedA: ChessRow | null = null;
    let receivedB: ChessRow | null = null;
    const unsubscribeA = backend.subscribe((next) => (receivedA = next));
    const unsubscribeB = backend.subscribe((next) => (receivedB = next));
    expect(calls.channelName).to.equal(`chess-board-${gameId}`);
    expect(calls.channelCount).to.equal(1);
    expect(calls.changeFilter).to.deep.include({
      event: "*",
      schema: "public",
      table: "chess_board",
      filter: `game_id=eq.${gameId}`,
    });
    calls.changeHandler?.({ new: row });
    expect(receivedA).to.deep.equal(row);
    expect(receivedB).to.deep.equal(row);

    unsubscribeA();
    expect(calls.removedCount).to.equal(0);
    const chessRow: ChessRow = { ...row, panel_mode: "chess" };
    calls.changeHandler?.({ new: chessRow });
    expect(receivedA).to.deep.equal(row);
    expect(receivedB).to.deep.equal(chessRow);

    unsubscribeB();
    expect(calls.removedCount).to.equal(1);
  });

  it("scopes every write RPC to the current Gaia game", async () => {
    const { client, calls } = makeClient();
    const backend = createSupabaseChessBackend(client, gameId, "white");

    await backend.claim("w");
    await backend.move("before", "after");
    await backend.reset();
    await backend.leave();
    await backend.setPanelMode("chess");

    expect(calls.rpc).to.deep.equal([
      { name: "claim_chess_color", args: { p_game_id: gameId, p_color: "w" } },
      {
        name: "move_chess",
        args: { p_game_id: gameId, p_prev_fen: "before", p_next_fen: "after" },
      },
      { name: "reset_chess", args: { p_game_id: gameId } },
      { name: "leave_chess_seat", args: { p_game_id: gameId } },
      { name: "set_chess_panel_mode", args: { p_game_id: gameId, p_mode: "chess" } },
    ]);
  });
});
