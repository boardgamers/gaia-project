import { expect } from "chai";
import {
  formatUnreadCount,
  lastSeenIdFromReadTime,
  loadLastSeenId,
  newestMessageId,
  saveLastSeenId,
  unreadCount,
  unreadSummary,
} from "./chat-unread";

function msg(id: number, userId: string, createdAt = "2026-08-10T10:00:00Z") {
  return { id, user_id: userId, created_at: createdAt };
}

describe("chat-unread", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  describe("unreadCount", () => {
    // The bug this module exists for: sending a message used to light up your own chat button,
    // because unread was "the newest message is newer than the last time I opened the panel" and
    // closing the panel never moved that mark.
    it("never counts my own messages as unread", () => {
      const messages = [msg(1, "me"), msg(2, "me"), msg(3, "me")];
      expect(unreadCount(messages, 0, "me")).to.equal(0);
    });

    it("counts only other people's messages after the last seen id", () => {
      const messages = [msg(1, "them"), msg(2, "me"), msg(3, "them"), msg(4, "other")];
      expect(unreadCount(messages, 1, "me")).to.equal(2);
      expect(unreadCount(messages, 3, "me")).to.equal(1);
      expect(unreadCount(messages, 4, "me")).to.equal(0);
    });

    it("counts everything from others when nothing has been seen yet", () => {
      expect(unreadCount([msg(1, "them"), msg(2, "me")], 0, "me")).to.equal(1);
    });
  });

  describe("newestMessageId", () => {
    it("is 0 for an empty thread and the highest id otherwise, regardless of order", () => {
      expect(newestMessageId([])).to.equal(0);
      expect(newestMessageId([msg(4, "a"), msg(9, "a"), msg(2, "a")])).to.equal(9);
    });
  });

  describe("formatUnreadCount / unreadSummary", () => {
    it("caps the badge at 9+ and singularises the spelled-out summary", () => {
      expect(formatUnreadCount(1)).to.equal("1");
      expect(formatUnreadCount(9)).to.equal("9");
      expect(formatUnreadCount(10)).to.equal("9+");
      expect(unreadSummary(1)).to.equal("1 new message");
      expect(unreadSummary(4)).to.equal("4 new messages");
    });
  });

  describe("lastSeenIdFromReadTime", () => {
    const messages = [
      msg(1, "a", "2026-08-10T10:00:00Z"),
      msg(2, "a", "2026-08-10T10:05:00Z"),
      msg(3, "a", "2026-08-10T10:10:00Z"),
    ];

    it("maps a timestamp receipt to the newest message that already existed then", () => {
      expect(lastSeenIdFromReadTime(messages, Date.parse("2026-08-10T10:07:00Z"))).to.equal(2);
      expect(lastSeenIdFromReadTime(messages, Date.parse("2026-08-10T10:05:00Z"))).to.equal(2);
      expect(lastSeenIdFromReadTime(messages, Date.parse("2026-08-10T09:00:00Z"))).to.equal(0);
      expect(lastSeenIdFromReadTime(messages, Date.parse("2026-08-10T23:00:00Z"))).to.equal(3);
    });

    it("treats a missing or unparseable receipt as 'seen nothing'", () => {
      expect(lastSeenIdFromReadTime(messages, 0)).to.equal(0);
      expect(lastSeenIdFromReadTime(messages, Number.NaN)).to.equal(0);
    });
  });

  describe("loadLastSeenId / saveLastSeenId", () => {
    const messages = [msg(1, "a", "2026-08-10T10:00:00Z"), msg(2, "a", "2026-08-10T10:05:00Z")];

    it("reads the stored id when there is one", () => {
      window.localStorage.setItem("id-key", "7");
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(7);
    });

    it("falls back to translating the legacy timestamp receipt exactly once", () => {
      window.localStorage.setItem("time-key", String(Date.parse("2026-08-10T10:01:00Z")));
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(1);

      // Saving writes the id key only, so the stale legacy key stops being consulted.
      saveLastSeenId("id-key", 2);
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(2);
    });

    it("is 0 for a device that has never read this thread", () => {
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(0);
    });

    it("never rewinds a stored position", () => {
      saveLastSeenId("id-key", 5);
      saveLastSeenId("id-key", 2);
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(5);
    });

    it("ignores an empty thread rather than storing a 0 that would look like 'never read'", () => {
      saveLastSeenId("id-key", 5);
      saveLastSeenId("id-key", 0);
      expect(loadLastSeenId("id-key", "time-key", messages)).to.equal(5);
    });
  });
});
