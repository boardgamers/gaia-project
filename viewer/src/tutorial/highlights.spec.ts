import { createTutorial } from "@boardgamers/protocol/tutorial";
import Engine, { Faction, ResearchField } from "@gaia-project/engine";
import { describe, expect, it } from "vitest";
import { makeStore } from "../store";
import type { State } from "./lessons";
import { lessons } from "./lessons";
import { copy } from "./position";

describe("tutorial last-move highlights", () => {
  it("keeps the learner's move through quizzes and reloads, then follows rewind and restart", async () => {
    const lesson = lessons.find((entry) => entry.id === "upgrades")!;
    const saves = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saves.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saves.set(key, value);
      },
    };
    const store = makeStore();
    store.commit("player", { index: 0 });
    const show = (state: State) => {
      store.commit("receiveData", Engine.fromData(copy(state.game)));
      store.commit("highlightMove", state.lastMove ?? "");
    };
    const tutorial = await createTutorial({ ...lesson, storage });
    show(tutorial.snapshot.state);
    expect(store.getters.recentOpponentCommands).toEqual([]);
    for (const step of lesson.steps.slice(0, 2)) await tutorial.play(step.solution!(tutorial.snapshot.state));
    show(tutorial.snapshot.state);
    expect([...store.getters.recentOpponentHexes.keys()]).toEqual([store.state.data.map.getS("0x0")]);
    expect(store.getters.recentOpponentResearch.get(Faction.Terrans)).toEqual(new Set([ResearchField.Navigation]));
    expect(store.getters.recentOpponentTechTiles.get("nav")).toEqual(new Set([Faction.Terrans]));
    const labMove = tutorial.snapshot.state.lastMove;
    expect(await tutorial.play({ kind: "answer", answer: "Yes" })).toBe(false);
    expect(tutorial.snapshot.state.lastMove).toBe(labMove);
    await tutorial.play({ kind: "answer", answer: "No" });
    expect(tutorial.snapshot.state.lastMove).toBe(labMove);
    await tutorial.play(lesson.steps[3].solution!(tutorial.snapshot.state));
    show(tutorial.snapshot.state);
    expect(store.getters.recentOpponentHexes.size).toBe(0);
    expect(store.getters.recentOpponentTechTiles.size).toBe(0);
    expect(store.getters.recentOpponentResearch.get(Faction.Terrans)).toEqual(new Set([ResearchField.Navigation]));
    tutorial.destroy();
    const restored = await createTutorial({ ...lesson, storage });
    expect(restored.snapshot.state.lastMove).toBe("terrans up nav.");
    await restored.previousStep();
    expect(restored.snapshot.state.lastMove).toBe(labMove);
    await restored.restart();
    show(restored.snapshot.state);
    expect(store.getters.recentOpponentCommands).toEqual([]);
    restored.destroy();
  });

  it("suppresses the prepared position's history and leaves other viewers' recap mode alone", () => {
    const lesson = lessons.find((entry) => entry.id === "exploration")!;
    const store = makeStore();
    store.commit("receiveData", Engine.fromData(copy(lesson.initialState().game)));
    const ordinaryCommands = store.getters.recentOpponentCommands;
    store.commit("highlightMove", "");
    expect(store.getters.recentOpponentCommands).toEqual([]);
    expect(makeStore().state.highlightedMove).toBeNull();
    store.commit("highlightMove", null);
    expect(store.getters.recentOpponentCommands).toEqual(ordinaryCommands);
  });
});
