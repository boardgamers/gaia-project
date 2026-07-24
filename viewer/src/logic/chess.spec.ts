import { expect } from "chai";
import {
  BoardMatrix,
  START_FEN,
  boardOrientation,
  displaySquares,
  localChessPanelStorageKey,
  localChessStorageKey,
  pieceGlyph,
  promotionRank,
} from "./chess";

// A minimal stand-in for chess.js `.board()` of the opening position (rank 8 first, file a first).
function openingMatrix(): BoardMatrix {
  const back = (color: string) => ["r", "n", "b", "q", "k", "b", "n", "r"].map((type) => ({ type, color }));
  const pawns = (color: string) => new Array(8).fill(null).map(() => ({ type: "p", color }));
  const empty = () => new Array(8).fill(null);
  return [back("b"), pawns("b"), empty(), empty(), empty(), empty(), pawns("w"), back("w")];
}

describe("chess helpers", () => {
  it("exposes the standard opening FEN", () => {
    expect(START_FEN.split(" ")[0]).to.equal("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(START_FEN.split(" ")[1]).to.equal("w");
  });

  describe("pieceGlyph", () => {
    it("uses distinct text-presentation glyphs for White and Black", () => {
      expect(pieceGlyph({ type: "k", color: "w" })).to.equal("\u2654\uFE0E");
      expect(pieceGlyph({ type: "p", color: "w" })).to.equal("\u2659\uFE0E");
      expect(pieceGlyph({ type: "p", color: "b" })).to.equal("\u265F\uFE0E");
      expect(pieceGlyph(null)).to.equal("");
    });
  });

  describe("displaySquares orientation", () => {
    it("puts White's back rank at the bottom in White orientation", () => {
      const cells = displaySquares(openingMatrix(), "w");
      expect(cells).to.have.length(64);
      expect(cells[0].square).to.equal("a8"); // top-left
      expect(cells[0].light).to.equal(true); // a8 is a light square
      expect(cells[4].piece).to.deep.equal({ type: "k", color: "b" }); // black king top
      expect(cells[63].square).to.equal("h1"); // bottom-right
      expect(cells[60].piece).to.deep.equal({ type: "k", color: "w" }); // white king bottom
    });

    it("flips both axes in Black orientation so Black sits at the bottom", () => {
      const cells = displaySquares(openingMatrix(), "b");
      expect(cells[0].square).to.equal("h1"); // top-left becomes h1
      expect(cells[3].square).to.equal("e1"); // white king's file, now on the top row
      expect(cells[3].piece).to.deep.equal({ type: "k", color: "w" }); // white king now on top
      expect(cells[63].square).to.equal("a8");
      expect(cells[59].piece).to.deep.equal({ type: "k", color: "b" }); // black king at bottom
    });
  });

  describe("promotionRank", () => {
    it("is rank 8 for White and rank 1 for Black", () => {
      expect(promotionRank("w")).to.equal("8");
      expect(promotionRank("b")).to.equal("1");
    });
  });

  describe("persistence and orientation", () => {
    it("isolates offline chess state by Gaia game id", () => {
      expect(localChessStorageKey("?offline=1&game=offline-one")).to.equal("lf-chess-fen:offline-one");
      expect(localChessStorageKey("?offline=1&game=offline-two")).to.equal("lf-chess-fen:offline-two");
      expect(localChessStorageKey("?players=2&lostFleet=1")).to.equal("lf-chess-fen:sandbox");
      expect(localChessPanelStorageKey("?offline=1&game=offline-one")).to.equal("lf-chess-panel:offline-one");
      expect(localChessPanelStorageKey("?players=2&lostFleet=1")).to.equal("lf-chess-panel:sandbox");
    });

    it("keeps an online player's own colour down but rotates offline to the side to move", () => {
      expect(boardOrientation(true, "w", "b")).to.equal("w");
      expect(boardOrientation(true, "b", "w")).to.equal("b");
      expect(boardOrientation(true, null, "b")).to.equal("w");
      expect(boardOrientation(false, null, "w")).to.equal("w");
      expect(boardOrientation(false, null, "b")).to.equal("b");
    });
  });
});
