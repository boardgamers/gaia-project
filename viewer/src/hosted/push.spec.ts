import { expect } from "chai";
import { disablePushNotifications, resolvePushTarget } from "./push";

describe("resolvePushTarget", () => {
  const inGame = "https://play.example/?game=aaa";

  it("swaps in place when a push points at another game and a game is mounted", () => {
    expect(resolvePushTarget("https://play.example/?game=bbb", inGame, true)).to.deep.equal({
      action: "swap-game",
      gameId: "bbb",
    });
  });

  it("does nothing for a push about the game already on screen", () => {
    expect(resolvePushTarget("https://play.example/?game=aaa", inGame, false)).to.deep.equal({ action: "ignore" });
  });

  it("loads the page when no game is mounted to swap into", () => {
    expect(resolvePushTarget("https://play.example/?game=bbb", "https://play.example/?lobby=1", false)).to.deep.equal({
      action: "load",
      href: "https://play.example/?game=bbb",
    });
  });

  it("loads the page for a target that isn't a game", () => {
    expect(resolvePushTarget("/?lobby=1", inGame, true)).to.deep.equal({
      action: "load",
      href: "https://play.example/?lobby=1",
    });
  });

  // The site_url the notify function builds push URLs from can differ from the origin this window
  // was opened on (a preview deployment, a renamed domain). Sessions are per-origin, so that has to
  // be a real navigation, never an in-place swap onto the wrong host's game id.
  it("loads the page for a game on another origin", () => {
    expect(resolvePushTarget("https://other.example/?game=bbb", inGame, true)).to.deep.equal({
      action: "load",
      href: "https://other.example/?game=bbb",
    });
  });
});

describe("disablePushNotifications", () => {
  const originalServiceWorker = (navigator as any).serviceWorker;
  const originalPushManager = (window as any).PushManager;
  const originalNotification = (window as any).Notification;

  afterEach(() => {
    (navigator as any).serviceWorker = originalServiceWorker;
    (window as any).PushManager = originalPushManager;
    (window as any).Notification = originalNotification;
  });

  function stubBrowserSupport() {
    (window as any).PushManager = function () {};
    (window as any).Notification = { permission: "granted" };
  }

  it("unsubscribes and deletes the stored row when a subscription exists", async () => {
    stubBrowserSupport();
    let unsubscribed = false;
    let deletedEndpoint: string | null = null;
    (navigator as any).serviceWorker = {
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: "https://push.example/abc",
            unsubscribe: async () => {
              unsubscribed = true;
              return true;
            },
          }),
        },
      }),
    };
    const client: any = {
      from: () => ({
        delete: () => ({
          eq: (col: string, value: string) => {
            deletedEndpoint = value;
            return Promise.resolve({ error: null });
          },
        }),
      }),
    };

    const message = await disablePushNotifications(client);

    expect(unsubscribed).to.equal(true);
    expect(deletedEndpoint).to.equal("https://push.example/abc");
    expect(message).to.equal("Turn notifications disabled on this device.");
  });

  it("is a no-op (no delete call) when there is no active subscription", async () => {
    stubBrowserSupport();
    (navigator as any).serviceWorker = {
      getRegistration: async () => ({
        pushManager: { getSubscription: async () => null },
      }),
    };
    let deleteCalled = false;
    const client: any = {
      from: () => ({
        delete: () => {
          deleteCalled = true;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    };

    const message = await disablePushNotifications(client);

    expect(deleteCalled).to.equal(false);
    expect(message).to.equal("Turn notifications disabled on this device.");
  });

  it("reports an error message if the delete fails", async () => {
    stubBrowserSupport();
    (navigator as any).serviceWorker = {
      getRegistration: async () => ({
        pushManager: {
          getSubscription: async () => ({
            endpoint: "https://push.example/abc",
            unsubscribe: async () => true,
          }),
        },
      }),
    };
    const client: any = {
      from: () => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { message: "boom" } }),
        }),
      }),
    };

    const message = await disablePushNotifications(client);

    expect(message).to.equal("Could not remove the subscription: boom");
  });
});
