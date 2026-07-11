import { strict as assert } from "assert";

import {
  buildNotifications,
  gameLabel,
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

    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, makeSubscription({ user_agent: null })), true);
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

  it("notifies every other seated player of a new chat message, not the sender", () => {
    const sender = makePlayer({ seat: 0, user_id: "user-1" });
    const other = makePlayer({ seat: 1, user_id: "user-2" });
    const unclaimed = makePlayer({ seat: 2, user_id: null });
    const game = makeGame({ players: [sender, other, unclaimed] });

    const notifications = buildNotifications("chat", game, false, {
      senderId: "user-1",
      authorName: "Luke",
      body: "gg",
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "user-2");
    assert.equal(notifications[0].kind, "message");
    assert.equal(notifications[0].body, "Luke in Test game: gg");
    assert.equal(notifications[0].tag, `chat-${game.id}`);
  });

  it("truncates a long chat message preview", () => {
    const game = makeGame({ players: [makePlayer({ user_id: "user-2" })] });
    const longBody = "a".repeat(120);

    const notifications = buildNotifications("chat", game, false, {
      senderId: "someone-else",
      authorName: "Luke",
      body: longBody,
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].body, `Luke in Test game: ${"a".repeat(77)}...`);
  });

  it("builds no chat notifications without a chat message payload", () => {
    assert.deepEqual(buildNotifications("chat", makeGame(), false), []);
  });

  it("excludes a recipient who has muted this game's chat", () => {
    const sender = makePlayer({ seat: 0, user_id: "user-1" });
    const mutedPlayer = makePlayer({ seat: 1, user_id: "user-2" });
    const unmutedPlayer = makePlayer({ seat: 2, user_id: "user-3" });
    const game = makeGame({ players: [sender, mutedPlayer, unmutedPlayer] });

    const notifications = buildNotifications(
      "chat",
      game,
      false,
      { senderId: "user-1", authorName: "Luke", body: "gg" },
      new Set(["user-2"])
    );

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "user-3");
  });

  it("defaults to notifying everyone when no muted set is passed", () => {
    const sender = makePlayer({ seat: 0, user_id: "user-1" });
    const other = makePlayer({ seat: 1, user_id: "user-2" });
    const game = makeGame({ players: [sender, other] });

    const notifications = buildNotifications("chat", game, false, {
      senderId: "user-1",
      authorName: "Luke",
      body: "gg",
    });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].userId, "user-2");
  });

  it("falls back to the other players' names when a game has no custom name", () => {
    const luke = makePlayer({ seat: 0, user_id: "user-1", display_name: "Luke" });
    const sarah = makePlayer({ seat: 1, user_id: "user-2", display_name: "Sarah" });
    const game = makeGame({ name: "", players: [luke, sarah] });

    assert.equal(gameLabel(game, "user-1"), "your game with Sarah");
    assert.equal(gameLabel(game, "user-2"), "your game with Luke");
  });

  it("prefers a game's custom name over the player-names fallback", () => {
    const game = makeGame({ name: "Friday Night Game" });
    assert.equal(gameLabel(game, game.players[0].user_id!), "Friday Night Game");
  });

  it("uses the generic fallback when no other player has a display name either", () => {
    const game = makeGame({ name: "", players: [makePlayer({ user_id: "user-1", display_name: "" })] });
    assert.equal(gameLabel(game, "user-1"), "your Lost Fleet game");
  });

  it("labels the turn notification with the other players, distinguishing unnamed games", () => {
    const current = makePlayer({ seat: 0, user_id: "user-1", display_name: "Luke" });
    const other = makePlayer({ seat: 1, user_id: "user-2", display_name: "Sarah" });
    const game = makeGame({ name: "", current_seat: 0, last_committed_by: "user-2", players: [current, other] });

    const notifications = buildNotifications("update", game, false);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].title, "GP: Fight Club");
    assert.equal(notifications[0].body, "Your turn in your game with Sarah.");
  });
});
