// Version 0.12.1 is intentionally pinned: it is the last small CommonJS build that this viewer's
// webpack 4 / TypeScript 3 toolchain can consume without transpiling modern package syntax. Keeping
// it in the viewer bundle (rather than injecting a CDN script) is also what makes the chess board
// genuinely usable in the app's airplane-mode/offline build.

// Structural typing for the slice of the chess.js API the board uses.
export interface ChessInstance {
  load(fen: string): boolean;
  fen(): string;
  turn(): "w" | "b";
  board(): ({ type: string; color: string } | null)[][];
  moves(opts: { square?: string; verbose: true }): { from: string; to: string; flags: string; promotion?: string }[];
  move(move: { from: string; to: string; promotion?: string }): unknown | null;
  in_check(): boolean;
  in_checkmate(): boolean;
  in_stalemate(): boolean;
  in_draw(): boolean;
  game_over(): boolean;
}

type ChessCtor = new (fen?: string) => ChessInstance;

// chess.js 0.12.1 has no bundled TypeScript declaration, so keep its untyped CommonJS edge here and
// expose only the narrow structural interface above to the rest of the viewer.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chessModule: any = require("chess.js");
// Node takes chess.js's CommonJS branch (`{ Chess }`); webpack 4 detects its legacy AMD branch and
// receives the constructor directly. Normalize both shapes here.
const Chess: ChessCtor = chessModule.Chess ?? chessModule.default?.Chess ?? chessModule.default ?? chessModule;

export function createChess(fen?: string): ChessInstance {
  return new Chess(fen);
}
