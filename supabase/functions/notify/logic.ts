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
// Recurring "still your turn" reminders (the reminder sweep).
//
// The one-shot turn push (buildNotifications above) fires only the instant it becomes your turn.
// The sweep re-nudges a player who still hasn't moved: every 12h, capped, and never during their
// local night. It's driven by an hourly pg_cron job that re-invokes this Edge Function with
// {type: "reminder_sweep"} (migration 20260721_turn_reminders); planTurnReminder is the pure
// per-game decision, index.ts does the IO (candidate query, push, and stamping the game row).
// ---------------------------------------------------------------------------

export const TURN_REMINDER_AFTER_MS = 12 * 60 * 60 * 1000;
// Cap: at most this many reminders per turn (so ~36h of nudging after the last move, then silence
// so a genuinely abandoned game stops pinging).
export const MAX_TURN_REMINDERS = 3;
// Quiet hours in the recipient's local time: only remind while the local hour is in
// [REMINDER_DAY_START_HOUR, REMINDER_DAY_END_HOUR). A reminder due during the night is simply
// deferred by the hourly sweep until the next in-window hour, never dropped.
export const REMINDER_DAY_START_HOUR = 8;
export const REMINDER_DAY_END_HOUR = 22;

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

// Whether it's an OK hour to nudge, judged across all of a player's devices. If any device's
// timezone says it's daytime we send; unknown/legacy timezones never suppress (better a possibly
// ill-timed nudge than a reminder that can never fire).
export function isWithinReminderHours(subscriptions: SubscriptionRow[], now: number = Date.now()): boolean {
  const zones = subscriptions.map((s) => s.tz).filter((tz): tz is string => !!tz);
  if (zones.length === 0) {
    return true;
  }
  return zones.some((tz) => {
    const hour = localHourInZone(tz, now);
    return hour === null || (hour >= REMINDER_DAY_START_HOUR && hour < REMINDER_DAY_END_HOUR);
  });
}

export type ReminderDecision = {
  gameId: string;
  userId: string;
  notification: Notification;
  reminderCount: number;
};

// Decides whether the current player of `game` should get a turn reminder right now. Pure: given
// the same game row, the current player's subscriptions, whether they have a premove queued, and
// the clock, it always returns the same answer. Returns null (no reminder) whenever any gate fails.
export function planTurnReminder(
  game: GameRow,
  currentPlayerSubscriptions: SubscriptionRow[],
  hasQueuedPremove: boolean,
  now: number = Date.now()
): ReminderDecision | null {
  if (game.status !== "active" || game.current_seat === null) {
    return null;
  }
  const current = currentTurnPlayer(game);
  // No claimant, or they already moved this turn (mirrors buildNotifications' turn guard), or a
  // premove is queued that'll play for them - nothing to nudge.
  if (!current || current.user_id === null || current.user_id === game.last_committed_by || hasQueuedPremove) {
    return null;
  }

  const turnStartedAt = game.latest_move_committed_at ? new Date(game.latest_move_committed_at).getTime() : null;
  if (turnStartedAt === null || now - turnStartedAt < TURN_REMINDER_AFTER_MS) {
    return null; // turn hasn't been idle long enough (or hasn't started with a committed move)
  }

  const lastReminderAt = game.last_turn_reminder_at ? new Date(game.last_turn_reminder_at).getTime() : null;
  // A reminder stamped before this turn started belongs to a previous turn: the player has since
  // moved, so the count resets implicitly (no commit_turn bookkeeping needed).
  const remindersThisTurn =
    lastReminderAt !== null && lastReminderAt >= turnStartedAt ? game.turn_reminder_count ?? 0 : 0;
  if (remindersThisTurn >= MAX_TURN_REMINDERS) {
    return null; // capped for this turn
  }
  if (lastReminderAt !== null && lastReminderAt >= turnStartedAt && now - lastReminderAt < TURN_REMINDER_AFTER_MS) {
    return null; // already reminded within the last 12h this turn
  }
  if (!isWithinReminderHours(currentPlayerSubscriptions, now)) {
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
