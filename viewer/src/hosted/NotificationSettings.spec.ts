/* eslint-disable @typescript-eslint/camelcase */
// Assertions intentionally use the notification_prefs column names.
import { expect } from "chai";
import { mount } from "@vue/test-utils";
import NotificationSettings from "./NotificationSettings.vue";

// Minimal stand-in for the two Supabase calls this modal makes: one read of the caller's own
// notification_prefs row, and one whole-row upsert per change.
function makeClient(stored: Record<string, unknown> | null = null) {
  const upserts: Record<string, unknown>[] = [];
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: stored, error: null }),
    upsert: async (row: Record<string, unknown>) => {
      upserts.push(row);
      return { error: null };
    },
  };
  return { client: { from: () => query } as any, upserts };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function mountSettings(client: any) {
  return mount(NotificationSettings as any, { propsData: { open: true, client, userId: "user-1" } });
}

function rowLabels(wrapper: any): string[] {
  return wrapper
    .findAll("section.notif-sect")
    .at(1)
    .findAll(".notif-row")
    .wrappers.map((row: any) => row.text());
}

describe("NotificationSettings", () => {
  it("offers each game's 'your move' push as its own category", async () => {
    // Owner request: opting out of renju pings must not cost you the Gaia turn push, so chess and
    // renju are separate rows rather than folded into "Your turn".
    const { client } = makeClient();
    const wrapper = mountSettings(client);
    await settle();

    // Each side-game row carries the same little glyph the game bar pulses with, so a row here and
    // a badge there are recognisably the same thing.
    const labels = rowLabels(wrapper);
    expect(labels.slice(0, 3)).to.deep.equal(["⬢Your Gaia turn", "♟Your chess move", "⬤Your renju move"]);
    expect(labels).to.include("New chat messages");
    wrapper.destroy();
  });

  it("defaults both side games to on, and saves the toggle that was flipped", async () => {
    const { client, upserts } = makeClient();
    const wrapper = mountSettings(client);
    await settle();

    const switches = wrapper.findAll("section.notif-sect").at(1).findAll('.notif-row input[type="checkbox"]');
    expect((switches.at(1).element as HTMLInputElement).checked).to.equal(true); // chess
    expect((switches.at(2).element as HTMLInputElement).checked).to.equal(true); // renju

    (switches.at(2).element as HTMLInputElement).checked = false;
    await switches.at(2).trigger("change");
    await settle();

    expect(upserts).to.have.length(1);
    expect(upserts[0]).to.include({ user_id: "user-1", renju_pushes: false });
    // Only the flipped category changes - the others keep their saved/default value.
    expect(upserts[0]).to.include({ turn_pushes: true, chess_pushes: true });
    wrapper.destroy();
  });

  it("shows a stored opt-out rather than the default", async () => {
    const { client } = makeClient({ chess_pushes: false });
    const wrapper = mountSettings(client);
    await settle();

    const switches = wrapper.findAll("section.notif-sect").at(1).findAll('.notif-row input[type="checkbox"]');
    expect((switches.at(1).element as HTMLInputElement).checked).to.equal(false);
    expect((switches.at(0).element as HTMLInputElement).checked).to.equal(true);
    wrapper.destroy();
  });
});
