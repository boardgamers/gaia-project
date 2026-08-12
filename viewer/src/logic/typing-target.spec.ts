import { expect } from "chai";
import { isTypingTarget } from "./typing-target";

describe("isTypingTarget", () => {
  const element = (html: string): HTMLElement => {
    const host = document.createElement("div");
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  };

  it("shields text entry", () => {
    expect(isTypingTarget(element("<textarea></textarea>"))).to.be.true;
    expect(isTypingTarget(element("<input>"))).to.be.true;
    expect(isTypingTarget(element('<input type="text">'))).to.be.true;
    expect(isTypingTarget(element('<input type="number">'))).to.be.true;
    expect(isTypingTarget(element('<input type="search">'))).to.be.true;
    expect(isTypingTarget(element("<select></select>"))).to.be.true;
    expect(isTypingTarget(element('<div contenteditable="true"></div>'))).to.be.true;
  });

  it("leaves buttons and toggles to the shortcuts", () => {
    expect(isTypingTarget(element("<button></button>"))).to.be.false;
    expect(isTypingTarget(element("<div></div>"))).to.be.false;
    expect(isTypingTarget(element('<input type="checkbox">'))).to.be.false;
    expect(isTypingTarget(element('<input type="radio">'))).to.be.false;
    expect(isTypingTarget(element('<input type="submit">'))).to.be.false;
    expect(isTypingTarget(element('<div contenteditable="false"></div>'))).to.be.false;
  });

  it("survives a target that is not an element", () => {
    expect(isTypingTarget(null)).to.be.false;
    expect(isTypingTarget(undefined)).to.be.false;
    // `window` and `document` are both legitimate event targets with no tagName.
    expect(isTypingTarget(document)).to.be.false;
  });
});
