import { expect } from "chai";
import { CURRENT_SETTINGS_VERSION, hasUnseenSettings, markSettingsSeen } from "./settings-notice";

describe("settings-notice", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reports unseen for a user who has never opened settings", () => {
    expect(hasUnseenSettings()).to.equal(true);
  });

  it("stops reporting unseen once markSettingsSeen has been called", () => {
    markSettingsSeen();
    expect(hasUnseenSettings()).to.equal(false);
  });

  it("reports unseen again if the seen version is older than the current one", () => {
    window.localStorage.setItem("gp-fight-club-settings-seen-version", String(CURRENT_SETTINGS_VERSION - 1));
    expect(hasUnseenSettings()).to.equal(true);
  });

  it("does not re-flag once already caught up to the current version", () => {
    window.localStorage.setItem("gp-fight-club-settings-seen-version", String(CURRENT_SETTINGS_VERSION));
    expect(hasUnseenSettings()).to.equal(false);
  });
});
