import type { TutorialMount, TutorialSnapshot } from "@boardgamers/protocol/tutorial";
import { createTutorial } from "@boardgamers/protocol/tutorial";
import { mountTutorialGuide } from "@boardgamers/protocol/tutorial/dom";
import { Command } from "@gaia-project/engine";
import type { CreateElement } from "vue";
import Vue from "vue";
import Game from "../components/Game.vue";
import { installBoardTouch } from "../logic/board-touch";
import { parseCommands } from "../logic/recent";
import { makeStore } from "../store";
import { renderRouteComparison, routeExamples, routeRefusals } from "./federation-routes";
import type { Action, State } from "./lessons";
import { lessons } from "./lessons";
import { copy } from "./position";
import { createResourceText } from "./resource-text";
import "./tutorial.css";

export const mountTutorial: TutorialMount = async (target, { chapter, onProgress, nextChapter, locale }) => {
  const lesson = lessons.find((entry) => entry.id === chapter);
  if (!lesson) throw new Error(`Unknown Gaia Project chapter: ${chapter}`);
  target.className = "gaia-tutorial";
  const guide = document.createElement("section");
  const choices = document.createElement("div");
  choices.className = "tutorial-choices";
  choices.setAttribute("aria-label", "Lesson answers");
  const diagram = document.createElement("div");
  diagram.className = "tutorial-route";
  const routeResult = document.createElement("p");
  routeResult.className = "tutorial-route-result";
  routeResult.setAttribute("role", "status");
  routeResult.hidden = true;
  const board = document.createElement("div");
  board.className = "tutorial-board";
  target.append(guide, routeResult, choices, diagram, board);
  let storage: Storage | undefined;
  try {
    storage = localStorage;
  } catch {
    /* Saving is optional. */
  }
  const controller = await createTutorial({ ...lesson, storage, onProgress });
  const store = makeStore();
  store.commit("player", { index: 0 });
  store.commit("highlightMove", "");
  store.commit("preferences", { highlightRecentActions: false, locale });
  const resourceText = createResourceText(store);
  const view = Vue.observable({ disabled: false });
  const appOptions = {
    store,
    render: (h: CreateElement) =>
      h("div", { class: "container-fluid py-2" }, [
        h(Game, { props: { tutorial: true, interactionDisabled: view.disabled } }),
      ]),
  };
  const app = new Vue(appOptions).$mount(board.appendChild(document.createElement("div")));
  const removeTouch = installBoardTouch(app.$el, () => app.$emit("bv::hide::tooltip"));
  let latest: TutorialSnapshot<State>;
  let previous: State | undefined;
  let destroyed = false;
  let routeStep = -1;
  let previousRouteState: State | undefined;
  const send = async (action: Action) => {
    if (destroyed || latest.busy || latest.completed) return;
    const accepted = await controller.play(action);
    if (!accepted && !destroyed) await store.dispatch("externalData", copy(latest.state.game));
  };
  const removeMoves = store.subscribeAction(({ type, payload }) => {
    if (type !== "move") return;
    const command = parseCommands(payload)[0];
    if (lesson.id === "federation-routes" && latest.step < 2 && command?.command === Command.FormFederation)
      send({ kind: "probe", attempt: latest.step === 0 ? "detour" : "station", location: command.args[0] });
    else send({ kind: "move", move: payload });
  });
  // Subscribe after the guide so its plain text is refreshed before we add the game's symbols.
  const removeGuide = mountTutorialGuide(guide, controller, { nextChapter });
  const remove = controller.subscribe((snapshot) => {
    latest = snapshot;
    view.disabled = snapshot.busy || snapshot.completed || !!lesson.steps[snapshot.step]?.choices;
    if (previous !== snapshot.state) {
      previous = snapshot.state;
      store.commit("highlightMove", snapshot.state.lastMove ?? "");
      void store.dispatch("externalData", copy(snapshot.state.game));
    }
    choices.replaceChildren();
    if (!snapshot.completed)
      for (const choice of lesson.steps[snapshot.step].choices?.(snapshot.state) ?? []) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = choice.label;
        resourceText(button);
        button.disabled = snapshot.busy;
        button.onclick = () => send(choice.action);
        choices.append(button);
      }
    if (lesson.id === "federation-routes" && !snapshot.completed) {
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = "Restore this attempt";
      restore.disabled = snapshot.busy;
      restore.onclick = () => void store.dispatch("selectFederation", routeExamples[snapshot.step].location);
      choices.append(restore);
    }
    choices.hidden = !choices.childElementCount;
    for (const text of guide.querySelectorAll<HTMLElement>(
      ".bgs-tutorial-heading strong, .bgs-tutorial-body > p, .bgs-tutorial-feedback"
    ))
      resourceText(text);
    const federationRoutes = lesson.id === "federation-routes";
    diagram.hidden = !federationRoutes;
    if (federationRoutes)
      renderRouteComparison(diagram, snapshot.step, snapshot.completed, snapshot.state.routeRejections ?? {});
    const refusedAttempt = snapshot.state.routeRejections?.station
      ? "station"
      : snapshot.state.routeRejections?.detour
        ? "detour"
        : undefined;
    const refusal =
      federationRoutes && refusedAttempt && snapshot.state.moves === 0 ? routeRefusals[refusedAttempt] : "";
    const revealRefusal = !!refusal && routeResult.textContent !== refusal;
    routeResult.hidden = !refusal;
    routeResult.textContent = refusal;
    if (revealRefusal) routeResult.scrollIntoView({ block: "center", behavior: "smooth" });
    if (
      federationRoutes &&
      !snapshot.busy &&
      !snapshot.completed &&
      (routeStep !== snapshot.step || previousRouteState !== snapshot.state)
    )
      void Vue.nextTick().then(() => {
        if (destroyed || latest !== snapshot) return;
        routeStep = snapshot.step;
        previousRouteState = snapshot.state;
        void store.dispatch("selectFederation", routeExamples[snapshot.step].location);
      });
  });
  return () => {
    destroyed = true;
    removeGuide();
    remove();
    removeMoves();
    removeTouch();
    controller.destroy();
    app.$destroy();
    target.replaceChildren();
  };
};
