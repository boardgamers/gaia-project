import type { GaiaHex } from "@gaia-project/engine";

/** Deterministic per-hex star field for the space tiles.
 *
 * The stars are pure decoration, but they must be identical on every client's render of the same
 * board and must not reshuffle when the map rotates for screen-fit - so they are derived from the
 * hex's own axial coordinates (q,r,s), not from Math.random() or the render-time viewBox. Each
 * hex gets a small handful of pinprick stars plus the occasional brighter one, positioned and
 * sized deterministically within the unit hexagon.
 *
 * Stars are sampled inside the hex's apothem (the inscribed circle, radius ~0.82 here, a touch
 * under the true ~0.87), so every dot already lies within the tile outline and the caller needs
 * no clip path - which keeps the map's <defs> block count at the value SpaceMap.spec.ts asserts.
 */

function coordHash(q: number, r: number, s: number): number {
  let h = 2166136261;
  const mix = (n: number) => {
    h ^= n & 0xffff;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  };
  mix(q);
  mix(r);
  mix(s);
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type HexStar = { x: number; y: number; r: number; opacity: number };

/** The stars for one space hex, in the hex's local (-1..1) coordinates, centred on the tile.
 *  ~4-6 per tile, deterministic per (q,r,s). Radii are small so they read as a subtle texture
 *  under the planet/building rather than a new game element. */
export function hexStarField(hex: GaiaHex): HexStar[] {
  const rand = mulberry32(coordHash(hex.q, hex.r, hex.s));
  const count = 4 + Math.floor(rand() * 3); // 4-6 stars per tile
  const stars: HexStar[] = [];
  for (let i = 0; i < count; i++) {
    // Sample a radius within the hex's inscribed circle so the point is guaranteed inside the
    // tile (see the module comment) - no clip needed.
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * 0.82;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    const magnitude = rand();
    const r = magnitude > 0.94 ? 0.028 : magnitude > 0.8 ? 0.02 : 0.013;
    const opacity = 0.22 + rand() * 0.4;
    stars.push({ x: +x.toFixed(3), y: +y.toFixed(3), r, opacity: +opacity.toFixed(3) });
  }
  return stars;
}
