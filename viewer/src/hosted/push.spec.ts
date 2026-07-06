import { expect } from "chai";
import { disablePushNotifications } from "./push";

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
