// Prompts mobile-browser visitors to install the app to their home screen (as a PWA) instead of
// living inside a browser tab. On Android/Chromium we can drive the native install flow via the
// `beforeinstallprompt` event; iOS Safari exposes no such API, so we show the manual "Share -> Add
// to Home Screen" instructions instead. Deliberately quiet: it never shows when already installed
// (standalone display mode / iOS `navigator.standalone`), and a dismissal is remembered for a
// cooldown window so it never nags.

const PROMPT_ID = "hosted-install-banner";
const STYLE_ID = "hosted-install-banner-style";
const DISMISS_KEY = "hosted-install-dismissed-at";
// How long a "Not now" dismissal suppresses the banner before it may appear again.
const DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
// Small delay before showing on iOS (no native event to wait on) so it doesn't slam up during the
// initial paint.
const IOS_SHOW_DELAY_MS = 1500;

export type MobilePlatform = "ios" | "android";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let started = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let beforeInstallListener: ((event: Event) => void) | null = null;
let appInstalledListener: (() => void) | null = null;
let iosTimer: number | null = null;

/** True when the app is already running as an installed PWA (so there's nothing to prompt). */
export function isRunningStandalone(win: Window = window): boolean {
  const displayModeStandalone = win.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  // iOS Safari doesn't support the display-mode media query; it flags installed apps here instead.
  const iosStandalone = (win.navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayModeStandalone || iosStandalone;
}

/** Classifies the current device as a mobile platform we can prompt on, or null for anything else. */
export function detectMobilePlatform(nav: Navigator = navigator): MobilePlatform | null {
  const ua = nav.userAgent || "";
  if (/android/i.test(ua)) {
    return "android";
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return "ios";
  }
  // iPadOS 13+ masquerades as desktop Safari ("Macintosh"); a touch-capable Mac is really an iPad.
  if (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) {
    return "ios";
  }
  return null;
}

function isDismissed(now: number, storage: Storage | null): boolean {
  if (!storage) {
    return false;
  }
  const raw = storage.getItem(DISMISS_KEY);
  if (!raw) {
    return false;
  }
  const at = Number(raw);
  return Number.isFinite(at) && now - at < DISMISS_COOLDOWN_MS;
}

function safeStorage(win: Window): Storage | null {
  try {
    return win.localStorage;
  } catch (_err) {
    // Some privacy modes throw on access; treat as "no persisted dismissal".
    return null;
  }
}

export function removeHostedInstallPrompt(): void {
  document.getElementById(PROMPT_ID)?.remove();
}

function ensurePromptStyle(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PROMPT_ID} {
      position: fixed;
      left: 1rem;
      right: 1rem;
      bottom: 1rem;
      z-index: 2000;
      max-width: 30rem;
      margin: 0 auto;
      border: 1px solid #b6d4fe;
      border-radius: 0.85rem;
      background: #f8fbff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      color: #0f172a;
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PROMPT_ID} .hosted-install-banner__body {
      padding: 0.9rem 1rem 0.95rem;
    }
    #${PROMPT_ID} .hosted-install-banner__eyebrow {
      margin-bottom: 0.2rem;
      color: #0b5ed7;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    #${PROMPT_ID} .hosted-install-banner__title {
      margin: 0 0 0.2rem;
      font-size: 0.98rem;
      font-weight: 700;
    }
    #${PROMPT_ID} .hosted-install-banner__text {
      margin: 0;
      color: #334155;
    }
    #${PROMPT_ID} .hosted-install-banner__share {
      display: inline-block;
      padding: 0 0.25rem;
      font-weight: 700;
    }
    #${PROMPT_ID} .hosted-install-banner__actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.65rem;
      margin-top: 0.75rem;
    }
    #${PROMPT_ID} .hosted-install-banner__link {
      border: 0;
      background: transparent;
      color: #0b5ed7;
      font: inherit;
      padding: 0;
      cursor: pointer;
    }
    #${PROMPT_ID} .hosted-install-banner__primary {
      border: 0;
      border-radius: 999px;
      background: #0b5ed7;
      color: #fff;
      font: inherit;
      font-weight: 600;
      padding: 0.45rem 0.85rem;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

function rememberDismissal(win: Window): void {
  const storage = safeStorage(win);
  try {
    storage?.setItem(DISMISS_KEY, String(Date.now()));
  } catch (_err) {
    // Non-fatal: worst case the banner may reappear next visit.
  }
}

/**
 * Renders the install banner. On Android an active "Install" button drives the captured
 * `beforeinstallprompt` event; on iOS (no such event) it shows the Share -> Add to Home Screen
 * instructions with a dismiss button only.
 */
export function showHostedInstallPrompt(platform: MobilePlatform, win: Window = window): void {
  ensurePromptStyle();
  removeHostedInstallPrompt();

  const root = document.createElement("div");
  root.id = PROMPT_ID;
  root.setAttribute("data-platform", platform);

  const body = document.createElement("div");
  body.className = "hosted-install-banner__body";

  const eyebrow = document.createElement("div");
  eyebrow.className = "hosted-install-banner__eyebrow";
  eyebrow.textContent = "Install app";

  const title = document.createElement("div");
  title.className = "hosted-install-banner__title";
  title.textContent = "Add Fight Club to your home screen";

  const text = document.createElement("p");
  text.className = "hosted-install-banner__text";

  const actions = document.createElement("div");
  actions.className = "hosted-install-banner__actions";

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "hosted-install-banner__link";
  dismiss.textContent = "Not now";
  dismiss.addEventListener("click", () => {
    rememberDismissal(win);
    removeHostedInstallPrompt();
  });

  if (platform === "android" && deferredPrompt) {
    text.textContent = "Install the app for a faster, full-screen experience - no browser tab needed.";
    const install = document.createElement("button");
    install.type = "button";
    install.className = "hosted-install-banner__primary";
    install.textContent = "Install";
    install.addEventListener("click", async () => {
      const promptEvent = deferredPrompt;
      removeHostedInstallPrompt();
      if (!promptEvent) {
        return;
      }
      deferredPrompt = null;
      try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
      } catch (_err) {
        // The user closing the native sheet is not an error we need to surface.
      }
    });
    actions.appendChild(dismiss);
    actions.appendChild(install);
  } else {
    // iOS Safari (or Android without a captured event): manual instructions only.
    text.innerHTML =
      'Tap the Share button <span class="hosted-install-banner__share">&#x2191;</span> then ' +
      '<strong>"Add to Home Screen"</strong> to install this app.';
    const gotIt = document.createElement("button");
    gotIt.type = "button";
    gotIt.className = "hosted-install-banner__primary";
    gotIt.textContent = "Got it";
    gotIt.addEventListener("click", () => {
      rememberDismissal(win);
      removeHostedInstallPrompt();
    });
    actions.appendChild(dismiss);
    actions.appendChild(gotIt);
  }

  body.appendChild(eyebrow);
  body.appendChild(title);
  body.appendChild(text);
  body.appendChild(actions);
  root.appendChild(body);
  win.document.body.appendChild(root);
}

/**
 * Wires up the mobile install prompt. No-op on desktop, when already installed, or while a recent
 * dismissal is still in its cooldown window. On Android it waits for `beforeinstallprompt` (so the
 * banner only appears when the browser deems the app installable); on iOS it shows after a short
 * delay.
 */
export function startHostedInstallPrompt(
  opts: {
    win?: Window;
    showFn?: (platform: MobilePlatform, win: Window) => void;
    now?: number;
  } = {}
): void {
  const win = opts.win ?? (typeof window !== "undefined" ? window : undefined);
  if (started || !win || typeof win.document === "undefined") {
    return;
  }
  started = true;

  const show = opts.showFn ?? showHostedInstallPrompt;
  const now = opts.now ?? Date.now();

  const platform = detectMobilePlatform(win.navigator);
  if (!platform) {
    return;
  }
  if (isRunningStandalone(win) || isDismissed(now, safeStorage(win))) {
    return;
  }

  if (platform === "android") {
    beforeInstallListener = (event: Event) => {
      // Stop Chrome's default mini-infobar so our own banner is the single install affordance.
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      if (!isRunningStandalone(win) && !isDismissed(Date.now(), safeStorage(win))) {
        show("android", win);
      }
    };
    win.addEventListener("beforeinstallprompt", beforeInstallListener);
  } else {
    iosTimer = win.setTimeout(() => {
      if (!isRunningStandalone(win) && !isDismissed(Date.now(), safeStorage(win))) {
        show("ios", win);
      }
    }, IOS_SHOW_DELAY_MS);
  }

  // Once the app actually gets installed, retire any banner still on screen.
  appInstalledListener = () => {
    deferredPrompt = null;
    removeHostedInstallPrompt();
  };
  win.addEventListener("appinstalled", appInstalledListener);
}

/** Test hook: undoes {@link startHostedInstallPrompt} so each case starts from a clean slate. */
export function resetHostedInstallPromptState(win: Window = window): void {
  started = false;
  deferredPrompt = null;
  if (beforeInstallListener) {
    win.removeEventListener("beforeinstallprompt", beforeInstallListener);
    beforeInstallListener = null;
  }
  if (appInstalledListener) {
    win.removeEventListener("appinstalled", appInstalledListener);
    appInstalledListener = null;
  }
  if (iosTimer !== null) {
    win.clearTimeout(iosTimer);
    iosTimer = null;
  }
  removeHostedInstallPrompt();
  document.getElementById(STYLE_ID)?.remove();
}
