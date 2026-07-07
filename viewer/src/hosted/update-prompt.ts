import currentRelease from "./release.json";

export type HostedReleaseEntry = {
  version: string;
  releasedAt: string;
  kind: string;
  title: string;
  impact?: string;
  changes: string[];
};

export type HostedRelease = {
  version: string;
  releasedAt: string;
  entries: HostedReleaseEntry[];
};

export const embeddedHostedRelease = currentRelease as HostedRelease;

const RELEASE_CHECK_MS = 5 * 60 * 1000;
const PROMPT_ID = "hosted-update-banner";
const STYLE_ID = "hosted-update-banner-style";

let started = false;
let dismissedVersion: string | null = null;
let intervalId: number | null = null;

function parseVersion(version: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return match ? match.slice(1).map((part) => Number(part)) : null;
}

export function isHostedReleaseNewer(currentVersion: string, candidateVersion: string): boolean {
  if (currentVersion === candidateVersion) {
    return false;
  }

  const current = parseVersion(currentVersion);
  const candidate = parseVersion(candidateVersion);
  if (!current || !candidate) {
    return candidateVersion !== currentVersion;
  }

  for (let i = 0; i < 3; i += 1) {
    if (candidate[i] > current[i]) {
      return true;
    }
    if (candidate[i] < current[i]) {
      return false;
    }
  }

  return false;
}

export async function fetchLatestHostedRelease(
  fetchImpl: typeof fetch = fetch.bind(window),
  url = `/release.json?t=${Date.now()}`
): Promise<HostedRelease | null> {
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as HostedRelease;
}

export function removeHostedUpdatePrompt(): void {
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
      right: 1rem;
      bottom: 1rem;
      z-index: 2000;
      width: min(26rem, calc(100vw - 2rem));
      border: 1px solid #b6d4fe;
      border-radius: 0.85rem;
      background: #f8fbff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.16);
      color: #0f172a;
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PROMPT_ID} .hosted-update-banner__body {
      padding: 0.9rem 1rem 0.95rem;
    }
    #${PROMPT_ID} .hosted-update-banner__eyebrow {
      margin-bottom: 0.2rem;
      color: #0b5ed7;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    #${PROMPT_ID} .hosted-update-banner__title {
      margin: 0 0 0.2rem;
      font-size: 0.98rem;
      font-weight: 700;
    }
    #${PROMPT_ID} .hosted-update-banner__text {
      margin: 0;
      color: #334155;
    }
    #${PROMPT_ID} .hosted-update-banner__actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.65rem;
      margin-top: 0.75rem;
    }
    #${PROMPT_ID} .hosted-update-banner__link {
      border: 0;
      background: transparent;
      color: #0b5ed7;
      font: inherit;
      padding: 0;
      cursor: pointer;
    }
    #${PROMPT_ID} .hosted-update-banner__primary {
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

export function showHostedUpdatePrompt(
  release: HostedRelease,
  reloadFn: () => void = () => window.location.reload()
): void {
  ensurePromptStyle();
  removeHostedUpdatePrompt();

  const root = document.createElement("div");
  root.id = PROMPT_ID;

  const body = document.createElement("div");
  body.className = "hosted-update-banner__body";

  const eyebrow = document.createElement("div");
  eyebrow.className = "hosted-update-banner__eyebrow";
  eyebrow.textContent = "Update available";

  const title = document.createElement("div");
  title.className = "hosted-update-banner__title";
  title.textContent = `Version ${release.version} - ${release.releasedAt}`;

  const text = document.createElement("p");
  text.className = "hosted-update-banner__text";
  text.textContent = "A newer build of the app was deployed while this tab was open. Reload to get the latest version.";

  const actions = document.createElement("div");
  actions.className = "hosted-update-banner__actions";

  const later = document.createElement("button");
  later.type = "button";
  later.className = "hosted-update-banner__link";
  later.textContent = "Later";
  later.addEventListener("click", () => {
    dismissedVersion = release.version;
    removeHostedUpdatePrompt();
  });

  const reload = document.createElement("button");
  reload.type = "button";
  reload.className = "hosted-update-banner__primary";
  reload.textContent = "Reload now";
  reload.addEventListener("click", () => reloadFn());

  actions.appendChild(later);
  actions.appendChild(reload);
  body.appendChild(eyebrow);
  body.appendChild(title);
  body.appendChild(text);
  body.appendChild(actions);
  root.appendChild(body);
  document.body.appendChild(root);
}

export async function probeHostedReleaseUpdate(
  fetchImpl: typeof fetch = fetch.bind(window),
  currentRelease: HostedRelease = embeddedHostedRelease
): Promise<HostedRelease | null> {
  const latest = await fetchLatestHostedRelease(fetchImpl);
  if (!latest) {
    return null;
  }
  return isHostedReleaseNewer(currentRelease.version, latest.version) ? latest : null;
}

export function startHostedUpdatePrompt(
  opts: {
    fetchImpl?: typeof fetch;
    reloadFn?: () => void;
    registrationUpdate?: () => Promise<void> | void;
    currentRelease?: HostedRelease;
  } = {}
): void {
  if (started || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  started = true;

  const fetchImpl = opts.fetchImpl ?? fetch.bind(window);
  const reloadFn = opts.reloadFn ?? (() => window.location.reload());
  const registrationUpdate = opts.registrationUpdate;
  const currentRelease = opts.currentRelease ?? embeddedHostedRelease;

  const check = async () => {
    try {
      await registrationUpdate?.();
      const latest = await probeHostedReleaseUpdate(fetchImpl, currentRelease);
      if (latest && latest.version !== dismissedVersion) {
        showHostedUpdatePrompt(latest, reloadFn);
      }
    } catch (_err) {
      // Quiet by design: failed update probes should never interrupt gameplay.
    }
  };

  check();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      check();
    }
  });
  intervalId = window.setInterval(check, RELEASE_CHECK_MS);
}

export function resetHostedUpdatePromptState(): void {
  started = false;
  dismissedVersion = null;
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  removeHostedUpdatePrompt();
  document.getElementById(STYLE_ID)?.remove();
}
