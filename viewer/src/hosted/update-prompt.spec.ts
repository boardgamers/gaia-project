import { expect } from "chai";
import {
  fetchLatestHostedRelease,
  isHostedReleaseNewer,
  probeHostedReleaseUpdate,
  resetHostedUpdatePromptState,
  showHostedUpdatePrompt,
} from "./update-prompt";

describe("hosted update prompt", () => {
  afterEach(() => {
    resetHostedUpdatePromptState();
  });

  it("detects newer semantic versions", () => {
    expect(isHostedReleaseNewer("5.12.0", "5.12.1")).to.equal(true);
    expect(isHostedReleaseNewer("5.12.0", "5.13.0")).to.equal(true);
    expect(isHostedReleaseNewer("5.12.0", "6.0.0")).to.equal(true);
    expect(isHostedReleaseNewer("5.12.0", "5.12.0")).to.equal(false);
    expect(isHostedReleaseNewer("5.12.0", "5.11.9")).to.equal(false);
  });

  it("fetches the public release file without requiring a specific URL shape", async () => {
    let requestedUrl = "";
    const latest = await fetchLatestHostedRelease((async (url: string) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ version: "5.13.0", releasedAt: "2026-07-08", entries: [] }),
      } as Response;
    }) as typeof fetch);

    expect(requestedUrl.startsWith("/release.json?t=")).to.equal(true);
    expect(latest?.version).to.equal("5.13.0");
  });

  it("returns null when the fetched release is not newer than the embedded one", async () => {
    const latest = await probeHostedReleaseUpdate((async () => {
      return {
        ok: true,
        json: async () => ({ version: "5.12.0", releasedAt: "2026-07-07", entries: [] }),
      } as Response;
    }) as typeof fetch);

    expect(latest).to.equal(null);
  });

  it("renders a reload prompt and wires the reload button", async () => {
    let reloaded = false;
    showHostedUpdatePrompt(
      { version: "5.13.0", releasedAt: "2026-07-08", entries: [] },
      () => (reloaded = true)
    );

    const prompt = document.getElementById("hosted-update-banner");
    expect(prompt?.textContent).to.contain("Version 5.13.0");
    expect(prompt?.textContent).to.contain("Reload now");

    const reloadButton = prompt?.querySelector(".hosted-update-banner__primary") as HTMLButtonElement;
    reloadButton.click();
    expect(reloaded).to.equal(true);
  });
});
