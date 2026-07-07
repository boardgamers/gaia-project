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
  kind: "invite" | "turn" | "finished";
};

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

export function gameLabel(game: GameRow): string {
  return game.name || "your Lost Fleet game";
}

export function buildNotifications(type: string, game: GameRow, hasQueuedPremove: boolean): Notification[] {
  if (type === "insert") {
    // Invite pushes reach only friends who already have an account + a
    // subscribed device; everyone else gets the link out-of-band.
    return game.players
      .filter((p) => p.user_id !== null && p.user_id !== game.created_by)
      .map((p) => ({
        userId: p.user_id!,
        title: "The Lost Fleet",
        body: `You've been invited to ${gameLabel(game)}.`,
        tag: `invite-${game.id}`,
        kind: "invite" as const,
      }));
  }
  if (game.status === "finished") {
    return game.players
      .filter((p) => p.user_id !== null)
      .map((p) => ({
        userId: p.user_id!,
        title: "The Lost Fleet",
        body: `${gameLabel(game)} is finished - come see the final scores.`,
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
      title: "The Lost Fleet",
      body: `Your turn in ${gameLabel(game)}.`,
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
