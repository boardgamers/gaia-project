import { expect } from "chai";
import { shouldFallBackToOffline } from "./route-decision";

describe("shouldFallBackToOffline", () => {
  it("falls back to offline for a bare ambient load while reported offline", () => {
    expect(shouldFallBackToOffline("", false)).to.equal(true);
  });

  it("does not fall back for a bare load while online", () => {
    expect(shouldFallBackToOffline("", true)).to.equal(false);
  });

  it("does not fall back for a bare load when onLine is undefined (unsupported API)", () => {
    expect(shouldFallBackToOffline("", undefined)).to.equal(false);
  });

  it("does not fall back for an explicit ?lobby=1 navigation even while reported offline (the pinned-URL/PWA start_url and the in-app 'Online lobby' link)", () => {
    expect(shouldFallBackToOffline("lobby=1", false)).to.equal(false);
  });

  it("does not fall back for any other explicit param (e.g. ?game=xyz) while reported offline", () => {
    expect(shouldFallBackToOffline("game=xyz", false)).to.equal(false);
  });
});
