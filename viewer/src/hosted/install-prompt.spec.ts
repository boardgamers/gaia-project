import { expect } from "chai";
import {
  detectMobilePlatform,
  isRunningStandalone,
  resetHostedInstallPromptState,
  showHostedInstallPrompt,
  startHostedInstallPrompt,
} from "./install-prompt";

const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function fakeWin(ua: string, opts: { standalone?: boolean } = {}): any {
  const listeners: { [key: string]: Array<(event: any) => void> } = {};
  const win: any = {
    document: window.document,
    navigator: {
      userAgent: ua,
      maxTouchPoints: /macintosh/i.test(ua) ? 5 : 0,
      standalone: opts.standalone,
    },
    matchMedia: () => ({ matches: false }),
    localStorage: window.localStorage,
    addEventListener(type: string, fn: (event: any) => void) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener(type: string, fn: (event: any) => void) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    dispatch(type: string, event: any) {
      (listeners[type] || []).forEach((fn) => fn(event));
    },
    setTimeout(fn: () => void) {
      fn();
      return 1;
    },
    clearTimeout() {
      /* no-op */
    },
  };
  return win;
}

describe("hosted install prompt", () => {
  afterEach(() => {
    resetHostedInstallPromptState();
    window.localStorage.removeItem("hosted-install-dismissed-at");
  });

  it("classifies mobile platforms, treating touch Macs as iPads and desktops as non-mobile", () => {
    expect(detectMobilePlatform({ userAgent: ANDROID_UA } as Navigator)).to.equal("android");
    expect(detectMobilePlatform({ userAgent: IPHONE_UA } as Navigator)).to.equal("ios");
    expect(detectMobilePlatform({ userAgent: IPAD_UA, maxTouchPoints: 5 } as Navigator)).to.equal("ios");
    expect(detectMobilePlatform({ userAgent: IPAD_UA, maxTouchPoints: 0 } as Navigator)).to.equal(null);
    expect(detectMobilePlatform({ userAgent: DESKTOP_UA } as Navigator)).to.equal(null);
  });

  it("detects an installed (standalone) PWA via display-mode and iOS navigator.standalone", () => {
    expect(isRunningStandalone(fakeWin(IPHONE_UA, { standalone: true }))).to.equal(true);
    expect(isRunningStandalone(fakeWin(IPHONE_UA))).to.equal(false);
  });

  it("renders the iOS Add-to-Home-Screen instructions after a delay", () => {
    startHostedInstallPrompt({ win: fakeWin(IPHONE_UA) });

    const banner = document.getElementById("hosted-install-banner");
    expect(banner).to.not.equal(null);
    expect(banner?.getAttribute("data-platform")).to.equal("ios");
    expect(banner?.textContent).to.contain("Add to Home Screen");
    // no programmatic install is possible on iOS, so only a dismiss/acknowledge control
    expect(banner?.textContent).to.contain("Got it");
  });

  it("shows an Install button on Android and drives the captured beforeinstallprompt event", async () => {
    const win = fakeWin(ANDROID_UA);
    startHostedInstallPrompt({ win });

    // nothing until the browser signals installability
    expect(document.getElementById("hosted-install-banner")).to.equal(null);

    let prompted = false;
    win.dispatch("beforeinstallprompt", {
      preventDefault() {
        /* no-op */
      },
      prompt: async () => {
        prompted = true;
      },
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });

    const banner = document.getElementById("hosted-install-banner");
    expect(banner?.getAttribute("data-platform")).to.equal("android");
    const install = banner?.querySelector(".hosted-install-banner__primary") as HTMLButtonElement;
    expect(install.textContent).to.equal("Install");
    install.click();
    await Promise.resolve();
    expect(prompted).to.equal(true);
  });

  it("stays hidden when already installed or recently dismissed", () => {
    startHostedInstallPrompt({ win: fakeWin(IPHONE_UA, { standalone: true }) });
    expect(document.getElementById("hosted-install-banner")).to.equal(null);
    resetHostedInstallPromptState();

    window.localStorage.setItem("hosted-install-dismissed-at", String(Date.now()));
    startHostedInstallPrompt({ win: fakeWin(IPHONE_UA) });
    expect(document.getElementById("hosted-install-banner")).to.equal(null);
  });

  it("remembers a 'Not now' dismissal so it can suppress the next visit", () => {
    showHostedInstallPrompt("ios", window);
    const dismiss = document
      .getElementById("hosted-install-banner")
      ?.querySelector(".hosted-install-banner__link") as HTMLButtonElement;
    dismiss.click();

    expect(document.getElementById("hosted-install-banner")).to.equal(null);
    expect(window.localStorage.getItem("hosted-install-dismissed-at")).to.not.equal(null);
  });
});
