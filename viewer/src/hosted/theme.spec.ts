import { expect } from "chai";
import { applyTheme, getTheme, initTheme, toggleTheme } from "./theme";

const STORAGE_KEY = "gp-fight-club-theme";

describe("theme", () => {
  let themeColor: HTMLMetaElement;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  });

  afterEach(() => {
    themeColor.remove();
    window.localStorage.clear();
  });

  it("starts in light mode without creating a stored preference", () => {
    initTheme();

    expect(getTheme()).to.equal("light");
    expect(document.documentElement.getAttribute("data-theme")).to.equal("light");
    expect(document.documentElement.style.colorScheme).to.equal("light");
    expect(themeColor.content).to.equal("#ffffff");
    expect(window.localStorage.getItem(STORAGE_KEY)).to.equal(null);
  });

  it("persists an explicit dark choice and updates browser chrome colors", () => {
    applyTheme("dark");

    expect(getTheme()).to.equal("dark");
    expect(document.documentElement.getAttribute("data-theme")).to.equal("dark");
    expect(document.documentElement.style.colorScheme).to.equal("dark");
    expect(themeColor.content).to.equal("#1c2027");
    expect(window.localStorage.getItem(STORAGE_KEY)).to.equal("dark");
  });

  it("toggles both directions", () => {
    expect(toggleTheme()).to.equal("dark");
    expect(toggleTheme()).to.equal("light");
    expect(document.documentElement.getAttribute("data-theme")).to.equal("light");
  });

  it("uses the live DOM state when a theme could not be persisted", () => {
    applyTheme("dark", false);

    expect(window.localStorage.getItem(STORAGE_KEY)).to.equal(null);
    expect(toggleTheme()).to.equal("light");
  });
});
