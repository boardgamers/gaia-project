import { expect } from "chai";
import { applyReceipt, ChatReadReceipt, readSummary, readerInitials, readersByMessage } from "./chat-reads";

describe("chat-reads", () => {
  function receipt(overrides: Partial<ChatReadReceipt> = {}): ChatReadReceipt {
    return {
      user_id: "user-2",
      reader_name: "Luke Skywalker",
      last_read_message_id: 2,
      last_read_at: "2026-08-04T10:00:00Z",
      ...overrides,
    };
  }

  describe("readerInitials", () => {
    it("takes one letter from each of the first two words", () => {
      expect(readerInitials("Luke Skywalker")).to.equal("LS");
      expect(readerInitials("han solo the smuggler")).to.equal("HS");
    });

    it("takes two letters from a single-word name", () => {
      expect(readerInitials("Leia")).to.equal("LE");
      expect(readerInitials("R")).to.equal("R");
    });

    it("never returns an empty chip", () => {
      expect(readerInitials("   ")).to.equal("?");
      expect(readerInitials("")).to.equal("?");
    });
  });

  describe("readersByMessage", () => {
    it("buckets each reader under the message they stopped at", () => {
      const grouped = readersByMessage(
        [
          receipt({ user_id: "user-2", reader_name: "Luke", last_read_message_id: 1 }),
          receipt({ user_id: "user-3", reader_name: "Leia", last_read_message_id: 3 }),
        ],
        [1, 2, 3],
        "user-1"
      );
      expect(Object.keys(grouped)).to.deep.equal(["1", "3"]);
      expect(grouped[1].map((r) => r.name)).to.deep.equal(["Luke"]);
      expect(grouped[3].map((r) => r.name)).to.deep.equal(["Leia"]);
    });

    it("excludes my own receipt", () => {
      const grouped = readersByMessage([receipt({ user_id: "user-1", last_read_message_id: 2 })], [1, 2], "user-1");
      expect(grouped).to.deep.equal({});
    });

    it("falls back to the newest loaded message at or below the read position", () => {
      // The reader is caught up past everything this client has loaded (their exact message is not
      // in the window, or arrived after this list was fetched) - they still show on the newest one.
      const grouped = readersByMessage([receipt({ last_read_message_id: 99 })], [4, 5], "user-1");
      expect(Object.keys(grouped)).to.deep.equal(["5"]);
    });

    it("drops a reader whose whole read range is older than the loaded window", () => {
      const grouped = readersByMessage([receipt({ last_read_message_id: 2 })], [10, 11], "user-1");
      expect(grouped).to.deep.equal({});
    });

    it("sorts readers on the same message by name and defaults a blank name", () => {
      const grouped = readersByMessage(
        [
          receipt({ user_id: "user-3", reader_name: "Zoe" }),
          receipt({ user_id: "user-4", reader_name: "Ana" }),
          receipt({ user_id: "user-5", reader_name: "  " }),
        ],
        [1, 2],
        "user-1"
      );
      expect(grouped[2].map((r) => r.name)).to.deep.equal(["Ana", "Player", "Zoe"]);
    });
  });

  describe("applyReceipt", () => {
    it("replaces that reader's row and leaves the others alone", () => {
      const existing = [receipt({ user_id: "user-2", last_read_message_id: 1 }), receipt({ user_id: "user-3" })];
      const next = applyReceipt(existing, receipt({ user_id: "user-2", last_read_message_id: 5 }));
      expect(next.length).to.equal(2);
      expect(next.filter((r) => r.user_id === "user-2").map((r) => r.last_read_message_id)).to.deep.equal([5]);
      expect(next.find((r) => r.user_id === "user-3")).to.not.equal(undefined);
    });
  });

  describe("readSummary", () => {
    it("reads as a sentence for one, two, and many readers", () => {
      const reader = (name: string) => ({ userId: name, name, initials: "XX", readAt: "" });
      expect(readSummary([])).to.equal("");
      expect(readSummary([reader("Luke")])).to.equal("Read by Luke");
      expect(readSummary([reader("Luke"), reader("Leia")])).to.equal("Read by Luke and Leia");
      expect(readSummary([reader("Luke"), reader("Leia"), reader("Han")])).to.equal("Read by Luke, Leia and Han");
    });
  });
});
