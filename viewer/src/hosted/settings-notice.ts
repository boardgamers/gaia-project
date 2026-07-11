const SEEN_VERSION_KEY = "gp-fight-club-settings-seen-version";

/**
 * Bump this whenever a new user-visible settings option is added (a new SettingsToggle row, a new
 * dropdown item, etc.) - that's the entire mechanism. Anyone whose last-seen version is behind this
 * number gets a small "new" badge on every settings gear icon (Lobby.vue and HostedBar.vue both
 * share this one flag, since they're the same conceptual "settings menu" just appearing in two
 * places) until they open either menu, at which point `markSettingsSeen` catches them up and the
 * badge is gone for good - never re-prompted for options they've already been shown, per the
 * owner's explicit "shouldn't fire again" requirement. Not expected to be read by anyone browsing
 * old commits for a changelog - this is purely a "have they ever opened settings since we last
 * added something" flag, not a record of what was added when.
 */
export const CURRENT_SETTINGS_VERSION = 1;

export function hasUnseenSettings(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const seen = Number(window.localStorage.getItem(SEEN_VERSION_KEY) ?? "0");
  return !Number.isFinite(seen) || seen < CURRENT_SETTINGS_VERSION;
}

export function markSettingsSeen(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SEEN_VERSION_KEY, String(CURRENT_SETTINGS_VERSION));
}
