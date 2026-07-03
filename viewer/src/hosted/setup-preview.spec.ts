import { expect } from "chai";
import { buildRotateMove, validateRotation } from "./setup-preview";

describe("buildRotateMove", () => {
  it("mod-6's every rotation count and drops entries that land back on zero", () => {
    const rotation = new Map<string, number>([
      ["0x0", 7], // 7 % 6 = 1, kept
      ["1x1", 6], // 6 % 6 = 0, dropped (no-op)
      ["2x2", 3], // kept as-is
    ]);

    expect(buildRotateMove(2, rotation)).to.equal("p2 rotate 0x0 1 2x2 3");
  });

  it("builds a bare rotate command with no pairs when nothing net-rotated", () => {
    const rotation = new Map<string, number>([["0x0", 12]]); // 12 % 6 = 0

    expect(buildRotateMove(3, rotation)).to.equal("p3 rotate");
  });

  it("builds a bare rotate command for an empty rotation map", () => {
    expect(buildRotateMove(4, new Map())).to.equal("p4 rotate");
  });
});

describe("validateRotation", () => {
  it("accepts a no-op rotation", () => {
    const result = validateRotation(2, "setup-preview-valid-seed", "p2 rotate");
    expect(result.valid).to.equal(true);
  });

  it("rejects a rotation that puts two matching planet types adjacent (the German-rules assert)", () => {
    // Same seed/center/rotation as the engine regression test in
    // engine/src/map.spec.ts ("should throw the German-rules assert via
    // moveRotateSectors..."), confirmed by running it: rotating this real
    // Lost Fleet sector center 3 times at 2p creates an invalid board.
    const result = validateRotation(2, "lost-fleet-space-map", "p2 rotate 0x0 3");

    expect(result.valid).to.equal(false);
    if (!result.valid) {
      expect(result.error).to.contain("Map is invalid with two planets for the same type being near each other");
    }
  });
});
