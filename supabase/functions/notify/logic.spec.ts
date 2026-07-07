import { strict as assert } from "assert";

import {
  buildNotifications,
  GameRow,
  PlayerRow,
  RECENTLY_ACTIVE_MS,
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
} from "./logic";

function makePlayer(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    seat: 0,
    user_id: "user-1",
    invited_email: "user@example.com",
    display_name: "User",
    last_active_at: null,
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameRow> = {}): GameRow {
  return {
    id: "game-1",
    name: "Test game",
    status: "active",
    current_seat: 0,
    created_by: "creator-1",
    last_committed_by: "other-user",
    players: [makePlayer()],
    ...overrides,
  };
}

function makeSubscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "sub-1",
    user_id: "user-1",
    endpoint: "https://push.example/sub-1",
    p256dh: "p256dh",
    auth: "auth",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
    ...overrides,
  };
}

describe("notify logic", () => {
  it("still builds a turn notification even when the player looks active", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });

    const notifications = buildNotifications("update", makeGame({ players: [activePlayer] }), false);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].kind, "turn");
    assert.equal(notifications[0].userId, activePlayer.user_id);
  });

  it("still suppresses the turn notification entirely when a premove is queued", () => {
    const notifications = buildNotifications("update", makeGame(), true);

    assert.deepEqual(notifications, []);
  });

  it("skips active mobile subscriptions but not active desktop subscriptions", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });

    const desktop = makeSubscription();
    const mobile = makeSubscription({
      id: "sub-2",
      endpoint: "https://push.example/sub-2",
      user_agent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
    });

    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, desktop), false);
    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, mobile), true);
  });

  it("treats legacy subscriptions with no stored user agent as mobile-safe while active", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });

    assert.equal(
      shouldSkipTurnPushForSubscription(activePlayer, makeSubscription({ user_agent: null })),
      true
    );
  });

  it("never suppresses stale subscriptions once the active heartbeat has expired", () => {
    const stalePlayer = makePlayer({
      last_active_at: new Date(Date.now() - RECENTLY_ACTIVE_MS - 1_000).toISOString(),
    });

    assert.equal(
      shouldSkipTurnPushForSubscription(
        stalePlayer,
        makeSubscription({
          user_agent:
            "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        })
      ),
      false
    );
  });
});
