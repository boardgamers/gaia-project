// chess.js is loaded at runtime from its classic-script CDN bundle rather than npm, for the same
// reason supabase-js is (see hosted/supabase-client.ts): this repo's webpack 4 can't parse the
// post-ES2019 syntax modern chess.js releases ship, and 0.13+ is ESM-only. Version 0.12.1 is the
// last release that is a plain browser global (`var Chess`), so injecting it as a <script> defines
// window.Chess with no module system involved. Version-pinned so a CDN release can't change it.

const CHESS_JS_URL = "https://cdn.jsdelivr.net/npm/chess.js@0.12.1/chess.js";

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

let ctorPromise: Promise<ChessCtor> | null = null;

// Loads chess.js once (memoised) and resolves its constructor.
export function loadChess(): Promise<ChessCtor> {
  if (!ctorPromise) {
    ctorPromise = new Promise((resolve, reject) => {
      const existing = (window as any).Chess;
      if (existing) {
        resolve(existing as ChessCtor);
        return;
      }
      const script = document.createElement("script");
      script.src = CHESS_JS_URL;
      script.async = true;
      script.onload = () => {
        const ctor = (window as any).Chess;
        if (!ctor) {
          reject(new Error("chess.js loaded but window.Chess is missing"));
          return;
        }
        resolve(ctor as ChessCtor);
      };
      script.onerror = () => reject(new Error(`could not load chess.js from ${CHESS_JS_URL}`));
      document.head.appendChild(script);
    });
  }
  return ctorPromise;
}
