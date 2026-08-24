import { expect } from "chai";
import { retryWithBackoff } from "./retry";

describe("retryWithBackoff", () => {
  it("returns immediately on first success without waiting or calling onGiveUp", async () => {
    let calls = 0;
    let gaveUp = false;
    await retryWithBackoff(
      async () => {
        calls++;
      },
      [1000, 3000],
      () => {
        gaveUp = true;
      }
    );
    expect(calls).to.equal(1);
    expect(gaveUp).to.equal(false);
  });

  it("retries after a failure and succeeds without giving up", async () => {
    let calls = 0;
    let gaveUp = false;
    await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 2) {
          throw new Error("transient");
        }
      },
      [0, 0],
      () => {
        gaveUp = true;
      }
    );
    expect(calls).to.equal(2);
    expect(gaveUp).to.equal(false);
  });

  it("calls onGiveUp with the last error once the delay list is exhausted, without throwing", async () => {
    let calls = 0;
    let lastErr: unknown = null;
    await retryWithBackoff(
      async () => {
        calls++;
        throw new Error(`fail ${calls}`);
      },
      [0, 0],
      (err) => {
        lastErr = err;
      }
    );
    // 1 initial attempt + 2 retries (one per delay entry) = 3 total.
    expect(calls).to.equal(3);
    expect((lastErr as Error)?.message).to.equal("fail 3");
  });
});
