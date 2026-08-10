import BootstrapVue from "bootstrap-vue";
import { expect } from "chai";
import Vue from "vue";
import { mount } from "@vue/test-utils";
import AdminUsers from "./AdminUsers.vue";

Vue.use(BootstrapVue);

describe("AdminUsers", () => {
  const adminSession = { user: { id: "user-admin", email: "kim.pham.nguyen2@gmail.com" } } as any;
  const otherSession = { user: { id: "user-other", email: "someone-else@example.com" } } as any;

  /** Table cells wrap across lines, so compare on whitespace-collapsed text. */
  function flatten(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  function makeClient() {
    const deleted: any[] = [];
    const listedUsers = [
      {
        id: "user-a",
        email: "alice@example.com",
        display_name: "Alice",
        nickname: "AliceInSpace",
        created_at: "2026-07-01T10:00:00Z",
        last_sign_in_at: "2026-07-07T10:00:00Z",
        invited_seats: 2,
        claimed_seats: 1,
        games_created: 1,
        active_games: 1,
        subscription_count: 1,
      },
      {
        id: "user-b",
        email: "bob@example.com",
        display_name: "Bob",
        nickname: "Bobbles",
        created_at: "2026-07-02T10:00:00Z",
        last_sign_in_at: null,
        invited_seats: 1,
        claimed_seats: 0,
        games_created: 0,
        active_games: 0,
        subscription_count: 0,
      },
    ];
    const approvals = [
      {
        user_id: "user-b",
        email: "bob@example.com",
        display_name: "Bob",
        status: "pending",
        created_at: "2026-07-02T10:00:00Z",
      },
    ];
    const client = {
      from: (table: string) => {
        if (table !== "user_approvals") {
          throw new Error(`unexpected table ${table}`);
        }
        return { select: () => ({ order: async () => ({ data: approvals, error: null }) }) };
      },
      functions: {
        invoke: async (_name: string, { body }: any) => {
          if (body.action === "list") {
            return { data: { users: listedUsers }, error: null };
          }
          if (body.action === "delete") {
            deleted.push(body);
            return { data: { ok: true, message: "User deleted." }, error: null };
          }
          throw new Error(`unexpected action ${body.action}`);
        },
      },
    };
    return { client, deleted };
  }

  it("shows admin-only warning to non-admins and does not load users", async () => {
    const { client } = makeClient();
    const wrapper = mount(AdminUsers, { propsData: { client, session: otherSession } });
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Admin only.");
    expect(wrapper.text()).to.not.contain("Alice");
  });

  it("loads and renders managed users for the admin", async () => {
    const { client } = makeClient();
    const wrapper = mount(AdminUsers, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(wrapper.text()).to.contain("Alice");
    expect(wrapper.text()).to.contain("alice@example.com");
    expect(wrapper.text()).to.contain("Bob");
    expect(wrapper.findAll(".admin-users-all tbody tr").length).to.equal(2);
  });

  it("shows each user's nickname next to their account name", async () => {
    const { client } = makeClient();
    const wrapper = mount(AdminUsers, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    const rows = wrapper.findAll(".admin-users-all tbody tr");
    expect(flatten(rows.at(0).text())).to.contain("Alice (AliceInSpace)");
    expect(flatten(rows.at(1).text())).to.contain("Bob (Bobbles)");
  });

  it("shows the nickname for a pending approval too", async () => {
    const { client } = makeClient();
    const wrapper = mount(AdminUsers, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    expect(flatten(wrapper.find(".admin-users-pending tbody tr").text())).to.contain("Bob (Bobbles)");
  });

  it("filters users by nickname", async () => {
    const { client } = makeClient();
    const wrapper = mount(AdminUsers, { propsData: { client, session: adminSession } });
    await Vue.nextTick();
    await Vue.nextTick();

    wrapper.setData({ query: "bobbles" });
    await Vue.nextTick();

    const rows = wrapper.findAll(".admin-users-all tbody tr");
    expect(rows.length).to.equal(1);
    expect(rows.at(0).text()).to.contain("Bob");
  });

  it("soft-deletes a selected user and reloads the list", async () => {
    const { client, deleted } = makeClient();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      const wrapper = mount(AdminUsers, { propsData: { client, session: adminSession } });
      await Vue.nextTick();
      await Vue.nextTick();

      const deleteButton = wrapper
        .findAll("button")
        .filter((b) => b.text() === "Delete")
        .at(0);
      await deleteButton.trigger("click");
      await Vue.nextTick();
      await Vue.nextTick();

      expect(deleted).to.deep.equal([{ action: "delete", userId: "user-a" }]);
      expect(wrapper.text()).to.contain("User deleted.");
    } finally {
      window.confirm = originalConfirm;
    }
  });
});
