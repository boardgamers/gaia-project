import { Resource } from "@gaia-project/engine";
import BootstrapVue from "bootstrap-vue";
import { describe, expect, it } from "vitest";
import Vue from "vue";
import { makeStore } from "../store";
import { createResourceText, resourceTextParts } from "./resource-text";

Vue.use(BootstrapVue);

describe("tutorial resource text", () => {
  it("keeps the original labels, quantities and punctuation without matching parts of other words", () => {
    const text = "Spend 3 ore, 2 credits and 1 Q.I.C. Keep the 4-credit income and 7 VP. Before a powerful action.";
    const parts = resourceTextParts(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.kind).map((part) => part.kind)).toEqual([
      Resource.Ore,
      Resource.Credit,
      Resource.Qic,
      Resource.Credit,
      Resource.VictoryPoint,
    ]);
  });

  it("uses the board’s actual shapes and keeps button names unchanged", () => {
    const format = createResourceText(makeStore());
    const button = document.createElement("button");
    button.textContent = "3 ore, 1 Q.I.C. and 4 knowledge";
    format(button);
    expect(button.textContent).toBe("3 ore, 1 Q.I.C. and 4 knowledge");
    expect(button.querySelector('[data-resource="o"] rect.ore')).not.toBeNull();
    expect(button.querySelector('[data-resource="q"] .qic image')).not.toBeNull();
    expect(button.querySelector('[data-resource="k"] polygon.knowledge')).not.toBeNull();
    expect(button.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
    format(button);
    expect(button.querySelectorAll("svg")).toHaveLength(3);
    expect(button.textContent).toBe("3 ore, 1 Q.I.C. and 4 knowledge");
  });

  it("leaves text as text when decorating feedback", () => {
    const feedback = document.createElement("p");
    feedback.textContent = "<img src=x onerror=alert(1)> Gain knowledge, power tokens or victory points.";
    createResourceText(makeStore())(feedback);
    expect(feedback.querySelector("img")).toBeNull();
    expect(feedback.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(
      [...feedback.querySelectorAll<HTMLElement>(".tutorial-resource")].map((node) => node.dataset.resource)
    ).toEqual([Resource.Knowledge, Resource.BowlToken, Resource.VictoryPoint]);
  });
});
