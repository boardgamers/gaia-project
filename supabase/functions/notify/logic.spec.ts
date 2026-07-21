import { strict as assert } from "assert";

import {
  buildNotifications,
  gameLabel,
  GameRow,
  isWithinReminderHours,
  localHourInZone,
  MAX_TURN_REMINDERS,
  planTurnReminder,
  PlayerRow,
  RECENTLY_ACTIVE_MS,
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
  TURN_REMINDER_AFTER_MS,
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

describe("turn reminders", () => {
  // Noon UTC - a "daytime" instant. UTC has no DST, so localHourInZone("UTC") is deterministic.
  const NOON = Date.UTC(2026, 0, 15, 12, 0, 0);
  const THREE_AM = Date.UTC(2026, 0, 15, 3, 0, 0);
  const staleMoveIso = (now: number) => new Date(now - TURN_REMINDER_AFTER_MS - 60_000).toISOString();

  describe("localHourInZone", () => {
    it("returns the UTC hour for the UTC zone", () => {
      assert.equal(localHourInZone("UTC", NOON), 12);
      assert.equal(localHourInZone("UTC", THREE_AM), 3);
    });

    it("returns null for a missing or unusable zone", () => {
      assert.equal(localHourInZone(null, NOON), null);
      assert.equal(localHourInZone(undefined, NOON), null);
      assert.equal(localHourInZone("Not/AZone", NOON), null);
    });
  });

  describe("isWithinReminderHours", () => {
    it("allows sending when no subscription reports a timezone", () => {
      assert.equal(isWithinReminderHours([], NOON), true);
      assert.equal(isWithinReminderHours([makeSubscription({ tz: null })], THREE_AM), true);
    });

    it("suppresses when it's the middle of the night in the only known zone", () => {
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], THREE_AM), false);
    });

    it("allows when it's daytime in the known zone", () => {
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], NOON), true);
    });

    it("allows when any one of a player's devices is in a daytime zone", () => {
      const subs = [
        makeSubscription({ id: "s1", tz: "UTC" }), // 03:00 - night
        makeSubscription({ id: "s2", tz: "Asia/Tokyo" }), // 12:00 - day
      ];
      assert.equal(isWithinReminderHours(subs, THREE_AM), true);
    });
  });

  describe("planTurnReminder", () => {
    const reminderGame = (overrides: Partial<GameRow> = {}, now = NOON): GameRow =>
      makeGame({
        latest_move_committed_at: staleMoveIso(now),
        turn_reminder_count: 0,
        last_turn_reminder_at: null,
        ...overrides,
      });

    it("reminds the current player of a turn idle past the threshold", () => {
      const decision = planTurnReminder(reminderGame(), [], false, NOON);

      assert.ok(decision);
      assert.equal(decision!.userId, "user-1");
      assert.equal(decision!.gameId, "game-1");
      assert.equal(decision!.reminderCount, 1);
      assert.equal(decision!.notification.body, "Still your turn in Test game.");
      assert.equal(decision!.notification.tag, "turn-game-1"); // same tag as the original turn push
    });

    it("does not remind before the turn has been idle 12h", () => {
      const freshMove = new Date(NOON - TURN_REMINDER_AFTER_MS + 60_000).toISOString();
      assert.equal(planTurnReminder(reminderGame({ latest_move_committed_at: freshMove }), [], false, NOON), null);
    });

    it("does not remind when the current player already moved this turn", () => {
      assert.equal(planTurnReminder(reminderGame({ last_committed_by: "user-1" }), [], false, NOON), null);
    });

    it("does not remind when a premove is queued", () => {
      assert.equal(planTurnReminder(reminderGame(), [], true, NOON), null);
    });

    it("does not remind during the recipient's local night", () => {
      const subs = [makeSubscription({ tz: "UTC" })];
      assert.equal(planTurnReminder(reminderGame({}, THREE_AM), subs, false, THREE_AM), null);
    });

    it("stops reminding once the per-turn cap is reached", () => {
      const capped = reminderGame({
        turn_reminder_count: MAX_TURN_REMINDERS,
        // stamped after the turn started, so it counts against this turn
        last_turn_reminder_at: new Date(NOON - 60_000).toISOString(),
      });
      assert.equal(planTurnReminder(capped, [], false, NOON), null);
    });

    it("throttles to one reminder per 12h within a turn", () => {
      const recentlyReminded = reminderGame({
        turn_reminder_count: 1,
        last_turn_reminder_at: new Date(NOON - 60_000).toISOString(), // 1 min ago
      });
      assert.equal(planTurnReminder(recentlyReminded, [], false, NOON), null);
    });

    it("ignores a reminder count left over from a previous turn", () => {
      // Player moved since (turn started at staleMoveIso), but the stale count/stamp predate it.
      const priorTurn = reminderGame({
        turn_reminder_count: MAX_TURN_REMINDERS,
        last_turn_reminder_at: new Date(NOON - TURN_REMINDER_AFTER_MS - 120_000).toISOString(),
      });
      const decision = planTurnReminder(priorTurn, [], false, NOON);

      assert.ok(decision);
      assert.equal(decision!.reminderCount, 1); // reset - this is the first reminder of the new turn
    });

    it("sends the next reminder once 12h have passed since the last one this turn", () => {
      const dueAgain = reminderGame({
        turn_reminder_count: 1,
        last_turn_reminder_at: new Date(NOON - TURN_REMINDER_AFTER_MS - 60_000).toISOString(),
      });
      const decision = planTurnReminder(dueAgain, [], false, NOON);

      assert.ok(decision);
      assert.equal(decision!.reminderCount, 2);
    });

    it("does not remind a finished game or one with no current seat", () => {
      assert.equal(planTurnReminder(reminderGame({ status: "finished" }), [], false, NOON), null);
      assert.equal(planTurnReminder(reminderGame({ current_seat: null }), [], false, NOON), null);
    });
  });
});
