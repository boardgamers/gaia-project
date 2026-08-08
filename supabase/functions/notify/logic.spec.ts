import { strict as assert } from "assert";

import {
  AuctionReminderRow,
  buildChessTurnNotification,
  buildNotifications,
  buildRenjuTurnNotification,
  buildSealedBidNotifications,
  chessMover,
  ChessBoardRow,
  DEFAULT_NOTIFICATION_PREFS,
  deviceHasGameOpen,
  gameLabel,
  GameRow,
  isNotificationAllowed,
  isQuietHour,
  isTurnKind,
  isSnoozed,
  isWithinReminderHours,
  localHourInZone,
  MIN_REMINDER_INTERVAL_MS,
  Notification,
  NotificationPrefs,
  planSealedBidReminder,
  planTurnReminder,
  PlayerRow,
  RECENTLY_ACTIVE_MS,
  RenjuBoardRow,
  renjuMover,
  resolvePrefs,
  shouldSkipTurnPushForSubscription,
  SubscriptionRow,
} from "./logic";

// Reminders are opt-in; most planTurnReminder tests want them on with default cadence.
const REMINDERS_ON: NotificationPrefs = { ...DEFAULT_NOTIFICATION_PREFS, reminders_enabled: true };
function prefs(overrides: Partial<NotificationPrefs> = {}): NotificationPrefs {
  return { ...REMINDERS_ON, ...overrides };
}
function notif(kind: Notification["kind"]): Notification {
  return { userId: "user-1", title: "GP: Fight Club", body: "x", tag: `${kind}-game-1`, kind };
}

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

function makeBoard(overrides: Partial<ChessBoardRow> = {}): ChessBoardRow {
  return {
    game_id: "game-1",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    white_user: "white-1",
    white_user_2: null,
    black_user: "black-1",
    black_user_2: null,
    white_next_user: null,
    black_next_user: null,
    ...overrides,
  };
}

// An empty 15x15 renju position (black to move), matching public.renju_start_board().
const EMPTY_RENJU = ".".repeat(225);

// `board` defaults to one black stone played, so the default row is white's move - the mirror of
// makeBoard()'s "white to move" chess default being black's.
function makeRenjuBoard(overrides: Partial<RenjuBoardRow> = {}): RenjuBoardRow {
  return {
    game_id: "game-1",
    board: EMPTY_RENJU,
    black_user: "black-1",
    black_user_2: null,
    white_user: "white-1",
    white_user_2: null,
    black_next_user: null,
    white_next_user: null,
    ...overrides,
  };
}

/** The empty board with `stones` alternating from black, placed on the first free intersections. */
function renjuPosition(stones: number): string {
  let board = "";
  for (let index = 0; index < 225; index++) {
    board += index < stones ? (index % 2 === 0 ? "b" : "w") : ".";
  }
  return board;
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

    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, desktop, "game-1"), false);
    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, mobile, "game-1"), true);
  });

  it("treats legacy subscriptions with no stored user agent as mobile-safe while active", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });

    assert.equal(
      shouldSkipTurnPushForSubscription(activePlayer, makeSubscription({ user_agent: null }), "game-1"),
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
        }),
        "game-1"
      ),
      false
    );
  });

  // The owner-reported bug this replaced: `players.last_active_at` is ONE row per seat, shared by
  // every device that user is signed in on, so holding the game open in a desktop tab silenced
  // their phone too.
  it("still pushes to the phone while the same player has the game open on another device", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });
    const phone = makeSubscription({
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      // The phone itself reported, recently, that it is looking at nothing.
      active_game_id: null,
      active_at: new Date(Date.now() - 1_000).toISOString(),
    });

    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, phone, "game-1"), false);
  });

  it("suppresses the phone only for the game that phone itself has open", () => {
    const player = makePlayer();
    const phone = (activeGameId: string | null) =>
      makeSubscription({
        user_agent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
        active_game_id: activeGameId,
        active_at: new Date(Date.now() - 1_000).toISOString(),
      });

    assert.equal(shouldSkipTurnPushForSubscription(player, phone("game-1"), "game-1"), true);
    assert.equal(shouldSkipTurnPushForSubscription(player, phone("game-2"), "game-1"), false);
  });

  it("stops trusting a device report once it goes stale", () => {
    const player = makePlayer();
    const phone = makeSubscription({
      user_agent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
      active_game_id: "game-1",
      active_at: new Date(Date.now() - RECENTLY_ACTIVE_MS - 1_000).toISOString(),
    });

    assert.equal(shouldSkipTurnPushForSubscription(player, phone, "game-1"), false);
  });

  it("falls back to the per-player signal for a device that has never reported", () => {
    const activePlayer = makePlayer({ last_active_at: new Date(Date.now() - 1_000).toISOString() });
    const legacyPhone = makeSubscription({
      user_agent: "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36",
    });

    assert.equal(deviceHasGameOpen(legacyPhone, "game-1"), null);
    assert.equal(shouldSkipTurnPushForSubscription(activePlayer, legacyPhone, "game-1"), true);
  });

  it("never suppresses a desktop subscription, whatever it reports", () => {
    const desktop = makeSubscription({ active_game_id: "game-1", active_at: new Date().toISOString() });

    assert.equal(shouldSkipTurnPushForSubscription(makePlayer(), desktop, "game-1"), false);
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

  describe("chess turn notifications", () => {
    it("resolves the mover from the active color's *_next_user, falling back to the seated user", () => {
      assert.equal(chessMover(makeBoard()), "white-1");
      assert.equal(
        chessMover(makeBoard({ fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1" })),
        "black-1"
      );
      assert.equal(chessMover(makeBoard({ white_next_user: "relay-white-2" })), "relay-white-2");
    });

    it("builds a turn-kind notification for the resolved mover, tagged separately from the Gaia turn push", () => {
      const white = makePlayer({ seat: 0, user_id: "white-1", display_name: "Luke" });
      const black = makePlayer({ seat: 1, user_id: "black-1", display_name: "Sarah" });
      const game = makeGame({ name: "", players: [white, black] });

      const notifications = buildChessTurnNotification(makeBoard(), game);

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].userId, "white-1");
      // Its own category, so a player can keep Gaia turn pushes while switching chess pings off.
      assert.equal(notifications[0].kind, "chess_turn");
      assert.equal(notifications[0].body, "Your chess move in your game with Sarah.");
      assert.equal(notifications[0].tag, "chess-game-1");
    });

    it("builds no notification when the active color has no claimed player yet", () => {
      assert.deepEqual(buildChessTurnNotification(makeBoard({ white_user: null }), makeGame()), []);
    });

    it("goes quiet once the Gaia game itself is finished", () => {
      // Owner request: a finished game stops asking for attention entirely - the side boards stay
      // playable, they just stop pushing (and the game bar stops pulsing).
      assert.deepEqual(buildChessTurnNotification(makeBoard(), makeGame({ status: "finished" })), []);
    });
  });

  describe("renju turn notifications", () => {
    it("derives the active colour from the stone counts, black opening", () => {
      assert.equal(renjuMover(makeRenjuBoard()), "black-1"); // empty board - black opens
      assert.equal(renjuMover(makeRenjuBoard({ board: renjuPosition(1) })), "white-1");
      assert.equal(renjuMover(makeRenjuBoard({ board: renjuPosition(2) })), "black-1");
    });

    it("prefers the relay *_next_user over the seated user, like move_renju does", () => {
      assert.equal(renjuMover(makeRenjuBoard({ black_next_user: "relay-black-2" })), "relay-black-2");
      assert.equal(
        renjuMover(makeRenjuBoard({ board: renjuPosition(1), white_next_user: "relay-white-2" })),
        "relay-white-2"
      );
      // A team with only the second seat filled still resolves - the same coalesce chain.
      assert.equal(renjuMover(makeRenjuBoard({ black_user: null, black_user_2: "black-2" })), "black-2");
    });

    it("builds a turn-kind notification for the resolved mover, tagged separately from Gaia and chess", () => {
      const black = makePlayer({ seat: 0, user_id: "black-1", display_name: "Luke" });
      const white = makePlayer({ seat: 1, user_id: "white-1", display_name: "Sarah" });
      const game = makeGame({ name: "", players: [black, white] });

      const notifications = buildRenjuTurnNotification(makeRenjuBoard(), game);

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].userId, "black-1");
      assert.equal(notifications[0].kind, "renju_turn");
      assert.equal(notifications[0].body, "Your renju move in your game with Sarah.");
      assert.equal(notifications[0].tag, "renju-game-1");
    });

    it("builds no notification when the active colour has no claimed player, or the board is unusable", () => {
      assert.deepEqual(buildRenjuTurnNotification(makeRenjuBoard({ black_user: null }), makeGame()), []);
      assert.deepEqual(buildRenjuTurnNotification(makeRenjuBoard({ board: "..." }), makeGame()), []);
    });

    it("goes quiet once the Gaia game itself is finished", () => {
      assert.deepEqual(buildRenjuTurnNotification(makeRenjuBoard(), makeGame({ status: "finished" })), []);
    });
  });
});

describe("notification preferences", () => {
  it("fills defaults for a missing/partial row", () => {
    assert.deepEqual(resolvePrefs(null), DEFAULT_NOTIFICATION_PREFS);
    assert.equal(resolvePrefs({ reminders_enabled: false }).reminders_enabled, false); // explicit override wins
    assert.equal(resolvePrefs({ reminders_enabled: false }).turn_pushes, true); // default preserved
  });

  it("reminders are on by default (opt-out)", () => {
    assert.equal(DEFAULT_NOTIFICATION_PREFS.reminders_enabled, true);
    assert.equal(DEFAULT_NOTIFICATION_PREFS.turn_pushes, true);
  });

  it("both side games notify by default, so nothing changes until you opt out", () => {
    assert.equal(DEFAULT_NOTIFICATION_PREFS.chess_pushes, true);
    assert.equal(DEFAULT_NOTIFICATION_PREFS.renju_pushes, true);
  });

  describe("isSnoozed", () => {
    const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
    it("is false with no snooze and true while a future snooze is active", () => {
      assert.equal(isSnoozed(prefs({ snooze_until: null }), NOW), false);
      assert.equal(isSnoozed(prefs({ snooze_until: new Date(NOW + 60_000).toISOString() }), NOW), true);
      assert.equal(isSnoozed(prefs({ snooze_until: new Date(NOW - 60_000).toISOString() }), NOW), false);
    });
  });

  describe("isNotificationAllowed", () => {
    it("gates each category by its own toggle", () => {
      assert.equal(isNotificationAllowed(notif("turn"), prefs({ turn_pushes: false })), false);
      assert.equal(isNotificationAllowed(notif("message"), prefs({ chat_pushes: false })), false);
      assert.equal(isNotificationAllowed(notif("invite"), prefs({ invite_pushes: false })), false);
      assert.equal(isNotificationAllowed(notif("finished"), prefs({ finished_pushes: false })), false);
      assert.equal(isNotificationAllowed(notif("turn"), prefs()), true);
    });

    it("lets each side game be switched off without touching the Gaia turn push", () => {
      const noSideGames = prefs({ chess_pushes: false, renju_pushes: false });
      assert.equal(isNotificationAllowed(notif("chess_turn"), noSideGames), false);
      assert.equal(isNotificationAllowed(notif("renju_turn"), noSideGames), false);
      assert.equal(isNotificationAllowed(notif("turn"), noSideGames), true);
      // ...and the reverse: no Gaia turn pushes, but still ping me about the side boards.
      const gaiaOff = prefs({ turn_pushes: false });
      assert.equal(isNotificationAllowed(notif("turn"), gaiaOff), false);
      assert.equal(isNotificationAllowed(notif("chess_turn"), gaiaOff), true);
      assert.equal(isNotificationAllowed(notif("renju_turn"), gaiaOff), true);
    });

    it("treats every side game's push as a turn kind, so the same active-player suppression applies", () => {
      assert.equal(isTurnKind("turn"), true);
      assert.equal(isTurnKind("chess_turn"), true);
      assert.equal(isTurnKind("renju_turn"), true);
      assert.equal(isTurnKind("message"), false);
      assert.equal(isTurnKind("invite"), false);
      assert.equal(isTurnKind("finished"), false);
    });

    it("suppresses everything while snoozed, even an enabled category", () => {
      const snoozed = prefs({ snooze_until: new Date(Date.now() + 3_600_000).toISOString() });
      assert.equal(isNotificationAllowed(notif("turn"), snoozed), false);
      assert.equal(isNotificationAllowed(notif("message"), snoozed), false);
    });
  });

  describe("isQuietHour", () => {
    it("handles a midnight-wrapping window (22..8)", () => {
      assert.equal(isQuietHour(23, 22, 8), true);
      assert.equal(isQuietHour(3, 22, 8), true);
      assert.equal(isQuietHour(8, 22, 8), false); // end is exclusive
      assert.equal(isQuietHour(12, 22, 8), false);
    });
    it("handles a same-day window (1..6) and an empty window", () => {
      assert.equal(isQuietHour(3, 1, 6), true);
      assert.equal(isQuietHour(6, 1, 6), false);
      assert.equal(isQuietHour(5, 9, 9), false); // start === end => never quiet
    });
  });
});

describe("turn reminders", () => {
  // Noon UTC - a "daytime" instant. UTC has no DST, so localHourInZone("UTC") is deterministic.
  const NOON = Date.UTC(2026, 0, 15, 12, 0, 0);
  const THREE_AM = Date.UTC(2026, 0, 15, 3, 0, 0);
  const staleMoveIso = (now: number) => new Date(now - MIN_REMINDER_INTERVAL_MS - 60_000).toISOString();

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
      assert.equal(isWithinReminderHours([], prefs(), NOON), true);
      assert.equal(isWithinReminderHours([makeSubscription({ tz: null })], prefs(), THREE_AM), true);
    });

    it("suppresses when it's the middle of the night in the only known zone", () => {
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], prefs(), THREE_AM), false);
    });

    it("allows when it's daytime in the known zone", () => {
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], prefs(), NOON), true);
    });

    it("never suppresses when quiet hours are disabled", () => {
      assert.equal(
        isWithinReminderHours([makeSubscription({ tz: "UTC" })], prefs({ quiet_hours_enabled: false }), THREE_AM),
        true
      );
    });

    it("honors a custom quiet window", () => {
      // Quiet 10..14 (daytime nap): noon is now suppressed, 3am is fine.
      const custom = prefs({ quiet_start_hour: 10, quiet_end_hour: 14 });
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], custom, NOON), false);
      assert.equal(isWithinReminderHours([makeSubscription({ tz: "UTC" })], custom, THREE_AM), true);
    });

    it("allows when any one of a player's devices is in a daytime zone", () => {
      const subs = [
        makeSubscription({ id: "s1", tz: "UTC" }), // 03:00 - night
        makeSubscription({ id: "s2", tz: "Asia/Tokyo" }), // 12:00 - day
      ];
      assert.equal(isWithinReminderHours(subs, prefs(), THREE_AM), true);
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
      const decision = planTurnReminder(reminderGame(), [], false, prefs(), NOON);

      assert.ok(decision);
      assert.equal(decision!.userId, "user-1");
      assert.equal(decision!.gameId, "game-1");
      assert.equal(decision!.reminderCount, 1);
      assert.equal(decision!.notification.body, "Still your turn in Test game.");
      assert.equal(decision!.notification.tag, "turn-game-1"); // same tag as the original turn push
    });

    it("does nothing when the player has turned reminders off", () => {
      assert.equal(planTurnReminder(reminderGame(), [], false, prefs({ reminders_enabled: false }), NOON), null);
    });

    it("does nothing while the player is snoozed", () => {
      const snoozed = prefs({ snooze_until: new Date(NOON + 3_600_000).toISOString() });
      assert.equal(planTurnReminder(reminderGame(), [], false, snoozed, NOON), null);
    });

    it("does not remind before the turn has been idle the chosen interval", () => {
      const freshMove = new Date(NOON - MIN_REMINDER_INTERVAL_MS + 60_000).toISOString();
      assert.equal(
        planTurnReminder(reminderGame({ latest_move_committed_at: freshMove }), [], false, prefs(), NOON),
        null
      );
    });

    it("respects a longer chosen interval (24h): 13h idle is not yet due", () => {
      // staleMoveIso is ~12h+1m old; with a 24h interval that's not enough.
      assert.equal(planTurnReminder(reminderGame(), [], false, prefs({ reminder_interval_hours: 24 }), NOON), null);
    });

    it("does not remind when the current player already moved this turn", () => {
      assert.equal(planTurnReminder(reminderGame({ last_committed_by: "user-1" }), [], false, prefs(), NOON), null);
    });

    it("does not remind when a premove is queued", () => {
      assert.equal(planTurnReminder(reminderGame(), [], true, prefs(), NOON), null);
    });

    it("does not remind during the recipient's local night", () => {
      const subs = [makeSubscription({ tz: "UTC" })];
      assert.equal(planTurnReminder(reminderGame({}, THREE_AM), subs, false, prefs(), THREE_AM), null);
    });

    it("stops reminding once the per-turn cap is reached", () => {
      const capped = reminderGame({
        turn_reminder_count: DEFAULT_NOTIFICATION_PREFS.reminder_max_count,
        last_turn_reminder_at: new Date(NOON - 60_000).toISOString(), // after the turn started
      });
      assert.equal(planTurnReminder(capped, [], false, prefs(), NOON), null);
    });

    it("honors a custom cap", () => {
      const oneAndDone = reminderGame({
        turn_reminder_count: 1,
        last_turn_reminder_at: new Date(NOON - MIN_REMINDER_INTERVAL_MS - 60_000).toISOString(), // interval elapsed
      });
      assert.equal(planTurnReminder(oneAndDone, [], false, prefs({ reminder_max_count: 1 }), NOON), null);
    });

    it("throttles to one reminder per interval within a turn", () => {
      const recentlyReminded = reminderGame({
        turn_reminder_count: 1,
        last_turn_reminder_at: new Date(NOON - 60_000).toISOString(), // 1 min ago
      });
      assert.equal(planTurnReminder(recentlyReminded, [], false, prefs(), NOON), null);
    });

    it("ignores a reminder count left over from a previous turn", () => {
      const priorTurn = reminderGame({
        turn_reminder_count: DEFAULT_NOTIFICATION_PREFS.reminder_max_count,
        last_turn_reminder_at: new Date(NOON - MIN_REMINDER_INTERVAL_MS - 120_000).toISOString(),
      });
      const decision = planTurnReminder(priorTurn, [], false, prefs(), NOON);

      assert.ok(decision);
      assert.equal(decision!.reminderCount, 1); // reset - first reminder of the new turn
    });

    it("sends the next reminder once the interval has passed since the last one this turn", () => {
      const dueAgain = reminderGame({
        turn_reminder_count: 1,
        last_turn_reminder_at: new Date(NOON - MIN_REMINDER_INTERVAL_MS - 60_000).toISOString(),
      });
      const decision = planTurnReminder(dueAgain, [], false, prefs(), NOON);

      assert.ok(decision);
      assert.equal(decision!.reminderCount, 2);
    });

    it("does not remind a finished game or one with no current seat", () => {
      assert.equal(planTurnReminder(reminderGame({ status: "finished" }), [], false, prefs(), NOON), null);
      assert.equal(planTurnReminder(reminderGame({ current_seat: null }), [], false, prefs(), NOON), null);
    });
  });

  // ---------------------------------------------------------------------------
  // Preference Split Auction: the simultaneous bid phase (migration 20260808120000)
  // ---------------------------------------------------------------------------

  describe("buildSealedBidNotifications", () => {
    const auctionGame = (overrides: Partial<GameRow> = {}) =>
      makeGame({
        name: "",
        players: [
          makePlayer({ seat: 0, user_id: "user-1", display_name: "Ann" }),
          makePlayer({ seat: 1, user_id: "user-2", display_name: "Bo" }),
          makePlayer({ seat: 2, user_id: "user-3", display_name: "Cy" }),
        ],
        ...overrides,
      });

    it("notifies every seat that still owes a bid, and nobody else", () => {
      const notifications = buildSealedBidNotifications(auctionGame(), [1, 2]);

      assert.deepEqual(
        notifications.map((n) => n.userId),
        ["user-2", "user-3"]
      );
      // Deliberately the ordinary turn kind/tag: it IS the player's move, someone who turned turn
      // pushes off does not want this either, and the tag lets it replace rather than stack.
      assert.deepEqual(
        notifications.map((n) => n.kind),
        ["turn", "turn"]
      );
      assert.deepEqual(
        notifications.map((n) => n.tag),
        ["turn-game-1", "turn-game-1"]
      );
      assert.match(notifications[0].body, /^Faction auction in your game with Ann, Cy - split your bid points\.$/);
    });

    it("uses the waiting wording for a re-nudge", () => {
      const [notification] = buildSealedBidNotifications(auctionGame({ name: "Sunday" }), [0], "reminder");

      assert.equal(notification.body, "Still waiting on your auction bid in Sunday.");
    });

    it("says nothing once every seat has submitted, or for a game that is over", () => {
      assert.deepEqual(buildSealedBidNotifications(auctionGame(), []), []);
      assert.deepEqual(buildSealedBidNotifications(auctionGame({ status: "finished" }), [0, 1, 2]), []);
    });
  });

  describe("planSealedBidReminder", () => {
    const auctionGame = (announcedAgoMs: number | null, overrides: Partial<GameRow> = {}) =>
      makeGame({
        sealed_bid_announced_at: announcedAgoMs === null ? null : new Date(NOON - announcedAgoMs).toISOString(),
        ...overrides,
      });
    const reminderRow = (overrides: Partial<AuctionReminderRow> = {}): AuctionReminderRow => ({
      seat: 0,
      reminder_count: 1,
      last_reminder_at: new Date(NOON - MIN_REMINDER_INTERVAL_MS - 60_000).toISOString(),
      ...overrides,
    });

    it("re-nudges once the auction has been open longer than the interval", () => {
      const decision = planSealedBidReminder(
        auctionGame(MIN_REMINDER_INTERVAL_MS + 60_000),
        undefined,
        [],
        prefs(),
        NOON
      );

      assert.ok(decision);
      assert.equal(decision!.reminderCount, 1);
    });

    it("waits out the interval from the announcement, then from the last nudge", () => {
      assert.equal(planSealedBidReminder(auctionGame(60_000), undefined, [], prefs(), NOON), null);
      assert.equal(
        planSealedBidReminder(
          auctionGame(MIN_REMINDER_INTERVAL_MS * 3),
          reminderRow({ last_reminder_at: new Date(NOON - 60_000).toISOString() }),
          [],
          prefs(),
          NOON
        ),
        null
      );
    });

    it("counts up per seat and stops at the cap", () => {
      const due = auctionGame(MIN_REMINDER_INTERVAL_MS * 5);

      assert.equal(planSealedBidReminder(due, reminderRow(), [], prefs(), NOON)!.reminderCount, 2);
      assert.equal(planSealedBidReminder(due, reminderRow({ reminder_count: 3 }), [], prefs(), NOON), null);
    });

    it("respects reminders being off, a snooze, and the recipient's quiet hours", () => {
      const due = auctionGame(MIN_REMINDER_INTERVAL_MS + 60_000);

      assert.equal(planSealedBidReminder(due, undefined, [], prefs({ reminders_enabled: false }), NOON), null);
      assert.equal(
        planSealedBidReminder(due, undefined, [], prefs({ snooze_until: new Date(NOON + 60_000).toISOString() }), NOON),
        null
      );
      const dueAtThreeAm = makeGame({
        sealed_bid_announced_at: new Date(THREE_AM - MIN_REMINDER_INTERVAL_MS - 60_000).toISOString(),
      });
      assert.ok(planSealedBidReminder(dueAtThreeAm, undefined, [], prefs(), THREE_AM)); // no known zone
      assert.equal(
        planSealedBidReminder(dueAtThreeAm, undefined, [makeSubscription({ tz: "UTC" })], prefs(), THREE_AM),
        null
      );
    });

    it("does nothing for a game with no open auction", () => {
      assert.equal(planSealedBidReminder(auctionGame(null), undefined, [], prefs(), NOON), null);
      assert.equal(
        planSealedBidReminder(
          auctionGame(MIN_REMINDER_INTERVAL_MS * 2, { status: "finished" }),
          undefined,
          [],
          prefs(),
          NOON
        ),
        null
      );
    });
  });
});
