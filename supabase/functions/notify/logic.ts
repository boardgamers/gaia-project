export type PlayerRow = {
  seat: number;
  user_id: string | null;
  invited_email: string;
  display_name: string;
  last_active_at: string | null;
};

export type GameRow = {
  id: string;
  name: string;
  status: string;
  current_seat: number | null;
  created_by: string;
  last_committed_by: string | null;
  players: PlayerRow[];
  // Present on rows loaded for the reminder sweep (see planTurnReminder). Optional so the
  // trigger paths (insert/update/chat) that don't select them keep type-checking.
  latest_move_committed_at?: string | null;
  last_turn_reminder_at?: string | null;
  turn_reminder_count?: number | null;
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
  // IANA timezone captured at subscribe time (viewer/src/hosted/push.ts). Used only for the
  // reminder sweep's quiet-hours gate; null for legacy subscriptions that predate the column.
  tz?: string | null;
};

export type ChessBoardRow = {
  game_id: string;
  fen: string;
  white_user: string | null;
  white_user_2: string | null;
  black_user: string | null;
  black_user_2: string | null;
  white_next_user: string | null;
  black_next_user: string | null;
};

export type Notification = {
  userId: string;
  title: string;
  body: string;
  tag: string;
  kind: "invite" | "turn" | "finished" | "message";
};

export type ChatMessagePayload = {
  senderId: string;
  authorName: string;
  body: string;
};

const CHAT_PREVIEW_MAX_LENGTH = 80;

// Comfortably larger than the client's own heartbeat interval (viewer/src/hosted.ts, ~20s while
// the tab is open and visible) so ordinary network/timer jitter never produces a false "they have
// it open" - but still short enough that closing the tab quickly resumes normal notifications.
export const RECENTLY_ACTIVE_MS = 45_000;

export function hasGameOpen(player: PlayerRow, now: number): boolean {
  if (!player.last_active_at) {
    return false;
  }
  return now - new Date(player.last_active_at).getTime() < RECENTLY_ACTIVE_MS;
}

function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) {
    // Preserve the old "suppress while active" behavior for legacy subscriptions that predate
    // the stored user_agent field rather than risking a surprise mobile spam regression.
    return true;
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

export function currentTurnPlayer(game: GameRow): PlayerRow | undefined {
  return game.players.find((p) => p.seat === game.current_seat);
}

// Mirrors move_chess's own "who moves next" resolution (supabase/migrations/
// 20260724185341_persist_chess_last_move.sql): the *_next_user columns exist for 2v2 relay chess
// and take priority; a solo team falls back to its single seated user.
export function chessMover(board: ChessBoardRow): string | null {
  const active = board.fen.split(" ")[1];
  return active === "w"
    ? board.white_next_user ?? board.white_user ?? board.white_user_2
    : board.black_next_user ?? board.black_user ?? board.black_user_2;
}

// The chess-panel counterpart of buildNotifications' Gaia "turn" case, fired whenever the shared
// chess board's active color actually changes (supabase/migrations/
// 20260726181703_chess_turn_notifications.sql's `chess_board_notify_update` trigger). No
// "already moved" guard is needed here the way buildNotifications checks `last_committed_by`:
// the active color only ever flips to the *other* seat, so the resolved mover is never the player
// who just made the move.
export function buildChessTurnNotification(board: ChessBoardRow, game: GameRow): Notification[] {
  const mover = chessMover(board);
  if (!mover) {
    return [];
  }
  return [
    {
      userId: mover,
      title: "GP: Fight Club",
      body: `Your chess move in ${gameLabel(game, mover)}.`,
      tag: `chess-${game.id}`,
      kind: "turn",
    },
  ];
}

// Most games never get a custom name (create-game defaults it blank), so the old flat
// "your Lost Fleet game" fallback made every such game's notifications read identically -
// useless for telling "which game" a push was actually about. Fall back to the OTHER seated
// players' names instead (excluding whoever this label is being shown to), which is almost
// always distinguishing in practice.
export function gameLabel(game: GameRow, excludeUserId?: string): string {
  if (game.name) {
    return game.name;
  }
  const otherNames = game.players
    .filter((p) => p.user_id !== excludeUserId)
    .map((p) => p.display_name)
    .filter((name) => !!name);
  return otherNames.length > 0 ? `your game with ${otherNames.join(", ")}` : "your Lost Fleet game";
}

export function buildNotifications(
  type: string,
  game: GameRow,
  hasQueuedPremove: boolean,
  chatMessage?: ChatMessagePayload,
  mutedUserIds: ReadonlySet<string> = new Set()
): Notification[] {
  if (type === "chat") {
    if (!chatMessage) {
      return [];
    }
    const preview =
      chatMessage.body.length > CHAT_PREVIEW_MAX_LENGTH
        ? `${chatMessage.body.slice(0, CHAT_PREVIEW_MAX_LENGTH - 3)}...`
        : chatMessage.body;
    // Every other seated player, same recipient set as a turn notification - spectators aren't
    // tracked anywhere durable enough to target (push_subscriptions is per-user, not per-game).
    // Anyone who's muted this specific game's chat (game_chat_mutes) is excluded entirely - a
    // mute is a hard opt-out, not just a suppression like the "recently active" mobile check
    // below, so it applies regardless of subscription type/activity.
    return game.players
      .filter((p) => p.user_id !== null && p.user_id !== chatMessage.senderId && !mutedUserIds.has(p.user_id))
      .map((p) => ({
        userId: p.user_id!,
        title: "GP: Fight Club",
        body: `${chatMessage.authorName} in ${gameLabel(game, p.user_id!)}: ${preview}`,
        tag: `chat-${game.id}`,
        kind: "message" as const,
      }));
  }
  if (type === "insert") {
    // Invite pushes reach only friends who already have an account + a
    // subscribed device; everyone else gets the link out-of-band.
    return game.players
      .filter((p) => p.user_id !== null && p.user_id !== game.created_by)
      .map((p) => ({
        userId: p.user_id!,
        title: "GP: Fight Club",
        body: `You've been invited to ${gameLabel(game, p.user_id!)}.`,
        tag: `invite-${game.id}`,
        kind: "invite" as const,
      }));
  }
  if (game.status === "finished") {
    return game.players
      .filter((p) => p.user_id !== null)
      .map((p) => ({
        userId: p.user_id!,
        title: "GP: Fight Club",
        body: `${gameLabel(game, p.user_id!)} is finished - come see the final scores.`,
        tag: `finished-${game.id}`,
        kind: "finished" as const,
      }));
  }
  const current = currentTurnPlayer(game);
  if (!current || current.user_id === null || current.user_id === game.last_committed_by || hasQueuedPremove) {
    return [];
  }
  return [
    {
      userId: current.user_id,
      title: "GP: Fight Club",
      body: `Your turn in ${gameLabel(game, current.user_id)}.`,
      tag: `turn-${game.id}`,
      kind: "turn",
    },
  ];
}

export function shouldSkipTurnPushForSubscription(
  player: PlayerRow,
  subscription: SubscriptionRow,
  now: number = Date.now()
): boolean {
  if (!hasGameOpen(player, now)) {
    return false;
  }
  return isMobileUserAgent(subscription.user_agent);
}

// ---------------------------------------------------------------------------
// Recurring "still your turn" reminders (the reminder sweep) + global notification preferences.
//
// The one-shot turn push (buildNotifications above) fires only the instant it becomes your turn.
// The sweep re-nudges a player who still hasn't moved - but only if they've opted in, on their
// chosen interval (12/24/48h), capped, and outside their configurable quiet hours. It's driven by
// an hourly pg_cron job that re-invokes this Edge Function with {type: "reminder_sweep"} (migration
// 20260721_turn_reminders); planTurnReminder is the pure per-game decision, index.ts does the IO
// (loading prefs, the candidate query, the push, and stamping the game row). All notification types
// are further gated per-user by NotificationPrefs (category toggles + snooze).
// ---------------------------------------------------------------------------

// Per-account (global) notification preferences - one row per user (public.notification_prefs),
// applied by the server to every game and every device. A missing row means "defaults", so the
// helpers below always operate on a fully-resolved NotificationPrefs (never a partial DB row).
export type NotificationPrefs = {
  turn_pushes: boolean; // the immediate "Your turn" push
  chat_pushes: boolean;
  invite_pushes: boolean;
  finished_pushes: boolean;
  reminders_enabled: boolean; // the recurring re-nudge - on by default, opt-out in settings
  reminder_interval_hours: number; // how often to re-nudge (12 / 24 / 48)
  reminder_max_count: number; // how many reminders per turn before giving up
  quiet_hours_enabled: boolean;
  quiet_start_hour: number; // local hour the nightly quiet window begins (may wrap midnight)
  quiet_end_hour: number; // local hour it ends
  snooze_until: string | null; // ISO timestamp; ALL pushes suppressed until then (null = not snoozed)
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  turn_pushes: true,
  chat_pushes: true,
  invite_pushes: true,
  finished_pushes: true,
  reminders_enabled: true, // on by default; users opt OUT in the settings modal
  reminder_interval_hours: 12,
  reminder_max_count: 3,
  quiet_hours_enabled: true,
  quiet_start_hour: 22,
  quiet_end_hour: 8,
  snooze_until: null,
};

// The smallest interval a user can pick (the UI offers 12/24/48). The sweep's SQL candidate query
// prefilters on this so it never drops a game a longer-interval user hasn't reached yet.
export const MIN_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000;

// Fills defaults over a (possibly missing/partial) DB row so callers get a complete prefs object.
export function resolvePrefs(row: Partial<NotificationPrefs> | null | undefined): NotificationPrefs {
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(row ?? {}) };
}

// All pushes are suppressed while a snooze is active.
export function isSnoozed(prefs: NotificationPrefs, now: number = Date.now()): boolean {
  if (!prefs.snooze_until) {
    return false;
  }
  const until = new Date(prefs.snooze_until).getTime();
  return Number.isFinite(until) && now < until;
}

function isCategoryEnabled(kind: Notification["kind"], prefs: NotificationPrefs): boolean {
  switch (kind) {
    case "turn":
      return prefs.turn_pushes;
    case "message":
      return prefs.chat_pushes;
    case "invite":
      return prefs.invite_pushes;
    case "finished":
      return prefs.finished_pushes;
    default:
      return true;
  }
}

// Trigger-path gate (index.ts): may this one-shot notification be delivered given the recipient's
// global prefs? Snooze suppresses everything; otherwise it's the per-category toggle.
export function isNotificationAllowed(
  notification: Notification,
  prefs: NotificationPrefs,
  now: number = Date.now()
): boolean {
  if (isSnoozed(prefs, now)) {
    return false;
  }
  return isCategoryEnabled(notification.kind, prefs);
}

// Local hour (0-23) for an IANA timezone at `now`, or null if the zone string is unusable.
export function localHourInZone(tz: string | null | undefined, now: number): number | null {
  if (!tz) {
    return null;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(new Date(now));
    const raw = parts.find((p) => p.type === "hour")?.value;
    if (raw === undefined) {
      return null;
    }
    const hour = parseInt(raw, 10) % 24; // some runtimes render midnight as "24"
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

// Whether `hour` (0-23) falls inside the quiet window [startHour, endHour), which may wrap midnight
// (e.g. 22..8 = 22:00 through 07:59). An empty window (start === end) is never quiet.
export function isQuietHour(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) {
    return false;
  }
  return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

// Whether it's an OK hour to nudge, judged across all of a player's devices. Quiet hours disabled ->
// always OK. If any device's local time is outside the quiet window we send; unknown/legacy
// timezones never suppress (better a possibly ill-timed nudge than one that can never fire).
export function isWithinReminderHours(
  subscriptions: SubscriptionRow[],
  prefs: NotificationPrefs,
  now: number = Date.now()
): boolean {
  if (!prefs.quiet_hours_enabled) {
    return true;
  }
  const zones = subscriptions.map((s) => s.tz).filter((tz): tz is string => !!tz);
  if (zones.length === 0) {
    return true;
  }
  return zones.some((tz) => {
    const hour = localHourInZone(tz, now);
    return hour === null || !isQuietHour(hour, prefs.quiet_start_hour, prefs.quiet_end_hour);
  });
}

export type ReminderDecision = {
  gameId: string;
  userId: string;
  notification: Notification;
  reminderCount: number;
};

// Decides whether the current player of `game` should get a turn reminder right now. Pure: given
// the same game row, the current player's subscriptions, their global prefs, whether they have a
// premove queued, and the clock, it always returns the same answer. Returns null whenever any gate
// fails - including when the player hasn't opted into reminders at all.
export function planTurnReminder(
  game: GameRow,
  currentPlayerSubscriptions: SubscriptionRow[],
  hasQueuedPremove: boolean,
  prefs: NotificationPrefs,
  now: number = Date.now()
): ReminderDecision | null {
  if (!prefs.reminders_enabled || isSnoozed(prefs, now)) {
    return null; // opt-in only, and never while snoozed
  }
  if (game.status !== "active" || game.current_seat === null) {
    return null;
  }
  const current = currentTurnPlayer(game);
  // No claimant, or they already moved this turn (mirrors buildNotifications' turn guard), or a
  // premove is queued that'll play for them - nothing to nudge.
  if (!current || current.user_id === null || current.user_id === game.last_committed_by || hasQueuedPremove) {
    return null;
  }

  const intervalMs = Math.max(1, prefs.reminder_interval_hours) * 60 * 60 * 1000;
  const turnStartedAt = game.latest_move_committed_at ? new Date(game.latest_move_committed_at).getTime() : null;
  if (turnStartedAt === null || now - turnStartedAt < intervalMs) {
    return null; // turn hasn't been idle long enough (or hasn't started with a committed move)
  }

  const lastReminderAt = game.last_turn_reminder_at ? new Date(game.last_turn_reminder_at).getTime() : null;
  // A reminder stamped before this turn started belongs to a previous turn: the player has since
  // moved, so the count resets implicitly (no commit_turn bookkeeping needed).
  const remindersThisTurn =
    lastReminderAt !== null && lastReminderAt >= turnStartedAt ? game.turn_reminder_count ?? 0 : 0;
  if (remindersThisTurn >= prefs.reminder_max_count) {
    return null; // capped for this turn
  }
  if (lastReminderAt !== null && lastReminderAt >= turnStartedAt && now - lastReminderAt < intervalMs) {
    return null; // already reminded within the current interval this turn
  }
  if (!isWithinReminderHours(currentPlayerSubscriptions, prefs, now)) {
    return null; // recipient's local night - the next sweep will retry in a saner hour
  }

  return {
    gameId: game.id,
    userId: current.user_id,
    notification: {
      userId: current.user_id,
      title: "GP: Fight Club",
      // Same tag as the original turn push so the OS replaces it rather than stacking a second banner.
      body: `Still your turn in ${gameLabel(game, current.user_id)}.`,
      tag: `turn-${game.id}`,
      kind: "turn",
    },
    reminderCount: remindersThisTurn + 1,
  };
}
