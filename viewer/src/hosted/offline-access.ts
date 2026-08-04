const OFFLINE_ACCESS_KEY = "gaia-offline-access-granted";

/**
 * Offline pass-and-play never talks to Supabase, so it can't check `user_approvals` itself - it
 * relies on this locally-stored flag, set once (see grantOfflineAccess()) the moment the hosted
 * approval gate in hosted.ts confirms the signed-in account is approved. Until that has happened
 * at least once on this device, offline mode must stay unreachable, same as the hosted app.
 */
export function isOfflineAccessGranted(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OFFLINE_ACCESS_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantOfflineAccess(): void {
  try {
    localStorage.setItem(OFFLINE_ACCESS_KEY, "1");
  } catch {
    // best-effort only - worst case offline mode stays gated on this device
  }
}
