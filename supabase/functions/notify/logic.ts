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
};

export type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string | null;
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
