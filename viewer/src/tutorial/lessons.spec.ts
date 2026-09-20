// @vitest-environment node
import { createTutorial } from "@boardgamers/protocol/tutorial";
import Engine, {
  AdvTechTilePos,
  Booster,
  Building,
  Command,
  Phase,
  Planet,
  ResearchField,
  Resource,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { describe, expect, it } from "vitest";
import { detour, stationRoute } from "./federation-routes";
import { lessons, sections } from "./lessons";
import { copy, federationPosition, serialise } from "./position";

for (const lesson of lessons) {
  describe(`tutorial: ${lesson.id}`, () => {
    it("completes through legal engine moves and restores the same state from saved actions", async () => {
      const saved = new Map<string, string>();
      const storage = {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
      };
      const controller = await createTutorial({ ...lesson, storage });
      while (!controller.snapshot.completed) {
        const step = lesson.steps[controller.snapshot.step];
        expect(step.solution, "interactive step has a reproducible solution").toBeDefined();
        const action = step.solution!(controller.snapshot.state);
        expect(await controller.play(action), `${step.id}: ${controller.snapshot.error}`).toBe(true);
      }
      const restored = await createTutorial({ ...lesson, storage });
      expect(restored.snapshot.completed).toBe(true);
      expect(restored.snapshot.state).toEqual(controller.snapshot.state);
      await restored.previousStep();
      expect(restored.snapshot.completed).toBe(false);
      const last = lesson.steps[restored.snapshot.step];
      expect(await restored.play(last.solution!(restored.snapshot.state))).toBe(true);
      expect(restored.snapshot.completed).toBe(true);
      restored.destroy();
      controller.destroy();
    });
  });
}

function finish(id: string) {
  const lesson = lessons.find((entry) => entry.id === id)!;
  let state = lesson.initialState();
  for (const step of lesson.steps) state = lesson.move(state, step.solution!(state)) as typeof state;
  return Engine.fromData(copy(state.game));
}

describe("native controls", () => {
  for (const lesson of lessons)
    it(`${lesson.id}: accepts turn commands one at a time`, async () => {
      const controller = await createTutorial(lesson);
      while (!controller.snapshot.completed) {
        const index = controller.snapshot.step;
        const step = lesson.steps[index];
        const action = step.solution!(controller.snapshot.state);
        if (action.kind !== "move") {
          expect(await controller.play(action)).toBe(true);
          continue;
        }
        const move = action.move.replace(
          /(federation )([^ ]+)/g,
          (_match, command, location) => command + location.split(",").reverse().join(",")
        );
        const commands = move.replace(/\.$/, "").split(". ");
        const prior = controller.snapshot.state.lastMove;
        const priorCount =
          prior && !Engine.fromData(copy(controller.snapshot.state.game)).newTurn
            ? prior.replace(/\.$/, "").split(". ").length
            : 0;
        for (let i = priorCount + 1; i <= commands.length && controller.snapshot.step === index; i++) {
          const partial = commands.slice(0, i).join(". ");
          expect(
            await controller.play({ kind: "move", move: partial }),
            `${lesson.id}/${step.id}: ${controller.snapshot.error}`
          ).toBe(true);
        }
        if (controller.snapshot.step === index) {
          expect(
            await controller.play({ kind: "move", move }),
            `${lesson.id}/${step.id}: ${controller.snapshot.error}`
          ).toBe(true);
        }
        expect(controller.snapshot.step, `${lesson.id}/${step.id} advanced`).toBeGreaterThan(index);
      }
      controller.destroy();
    });
});

describe("teaching positions", () => {
  it("places every chapter in one known section", () => {
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    expect(lessons.every((lesson) => sections.some((section) => section.id === lesson.section))).toBe(true);
  });
  it("a mine pays its normal costs and reveals ore income", () => {
    const start = Engine.fromData(lessons[0].initialState().game);
    const end = finish("first-mine");
    expect(end.players[0].data.ores).toBe(start.players[0].data.ores - 1);
    expect(end.players[0].data.credits).toBe(start.players[0].data.credits - 2);
    expect(end.players[0].data.buildings[Building.Mine]).toBe(2);
    expect(end.players[0].income).not.toBe(start.players[0].income);
  });
  it("pays separately for terraforming and temporary range without changing basic range", () => {
    const lesson = lessons.find((entry) => entry.id === "terraforming")!;
    let state = lesson.initialState();
    for (const step of lesson.steps) {
      const before = Engine.fromData(copy(state.game)).players[0].data;
      state = lesson.move(state, step.solution!(state)) as typeof state;
      const after = Engine.fromData(copy(state.game)).players[0].data;
      if (step.id === "ice") {
        expect(after.ores).toBe(before.ores - 4);
        expect(after.qics).toBe(before.qics);
      }
      if (step.id === "qic-range") {
        expect(after.qics).toBe(before.qics - 1);
        expect(after.ores).toBe(before.ores - 1);
      }
      if (step.id === "booster-range") {
        expect(after.qics).toBe(before.qics);
        expect(after.ores).toBe(before.ores - 1);
        expect(after.buildings[Building.Mine]).toBe(4);
      }
      expect(after.range).toBe(1);
      expect(after.temporaryRange).toBe(0);
    }
    const end = Engine.fromData(copy(state.game));
    expect(end.map.getS("4x0").data.player).toBe(0);
    expect(
      end.findAvailableCommand(0, Command.Special)?.data.specialacts.map((action) => action.income) ?? []
    ).not.toContain("range+3");
  });
  it("waits for a held booster to become available, then scores and returns the old one", () => {
    const lesson = lessons.find((entry) => entry.id === "passing")!;
    let state = lesson.initialState();
    const start = Engine.fromData(copy(state.game));
    expect(start.players[0].data.tiles.booster).toBe(Booster.Booster6);
    expect(start.players[1].data.tiles.booster).toBe(Booster.Booster5);
    expect(start.findAvailableCommand(0, Command.Pass).data.boosters).not.toContain(Booster.Booster5);
    for (const step of lesson.steps.slice(0, 2)) state = lesson.move(state, step.solution!(state)) as typeof state;
    const before = Engine.fromData(copy(state.game));
    expect(before.passedPlayers).toEqual([1, 2]);
    expect(before.findAvailableCommand(0, Command.Pass).data.boosters).toContain(Booster.Booster5);
    expect(before.findAvailableCommand(0, Command.Pass).data.boosters).not.toContain(Booster.Booster6);
    expect(before.players[0].data.buildings[Building.Mine]).toBe(2);
    state = lesson.move(state, lesson.steps[2].solution!(state)) as typeof state;
    const after = Engine.fromData(copy(state.game));
    expect(after.players[0].data.victoryPoints).toBe(before.players[0].data.victoryPoints + 2);
    expect(after.players[0].data.tiles.booster).toBe(Booster.Booster5);
    expect(after.tiles.boosters[Booster.Booster6]).toBe(true);
    expect(after.round).toBe(before.round + 1);
    expect(after.passedPlayers[0]).toBe(1);
    expect(after.players[0].data.ores).toBe(
      before.players[0].data.ores + before.players[0].resourceIncome(Resource.Ore)
    );
    expect(after.players[0].resourceIncome(Resource.Ore)).toBe(before.players[0].resourceIncome(Resource.Ore));
  });
  it("the shorter federation forces in the station and leaves the lower mine out", () => {
    const start = federationPosition(true);
    const info = start.players[0].federationInfo(start.players[0].hexesForFederationLocation(detour, start.map));
    expect(info.powerValue).toBe(7);
    expect(info.satellites).toBe(7);
    expect(() => start.players[0].checkAndGetFederationInfo(detour, start.map, false, false)).toThrow(
      /fewer satellites/
    );
    const withStation = start.players[0].federationInfo(
      start.players[0].hexesForFederationLocation(stationRoute, start.map)
    );
    expect([withStation.powerValue, withStation.newSatellites]).toEqual([9, 6]);
    expect(() => start.players[0].checkAndGetFederationInfo(stationRoute, start.map, false, false)).toThrow(
      /outclassed/
    );
    const end = finish("federation-routes");
    expect(end.players[0].data.satellites).toBe(4);
    expect(end.map.getS("0x0").belongsToFederationOf(0)).toBe(true);
    expect(end.map.getS("0x3").belongsToFederationOf(0)).toBe(false);
    expect(end.players[0].data.federationCount).toBe(1);
  });
  it("a completed Gaia project produces a green planet and releases its Gaiaformer", () => {
    const end = finish("gaiaforming");
    expect(end.round).toBe(3);
    expect(end.map.getS("-1x0").data.planet).toBe(Planet.Gaia);
    expect(end.map.getS("-1x0").data.building).toBe(Building.Mine);
    expect(end.players[0].data.gaiaformersInGaia).toBe(0);
  });
  it("tests the selected federation route without forming it or accepting an unrelated error", async () => {
    const lesson = lessons.find((entry) => entry.id === "federation-routes")!;
    const saves = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saves.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saves.set(key, value);
      },
    };
    const controller = await createTutorial({ ...lesson, storage });
    const initial = copy(controller.snapshot.state.game);
    const engine = Engine.fromData(copy(initial));
    const valid = engine.players[0]
      .availableFederations(engine.map, false)[0]
      .hexes.map((hex) => hex.toString())
      .join(",");
    expect(await controller.play({ kind: "probe", attempt: "detour", location: "0x3" })).toBe(false);
    expect(controller.snapshot.step).toBe(0);
    expect(await controller.play({ kind: "probe", attempt: "detour", location: valid })).toBe(false);
    expect(controller.snapshot.error).toContain("That route is valid");
    expect(
      await controller.play({ kind: "probe", attempt: "detour", location: detour.split(",").reverse().join(",") })
    ).toBe(true);
    expect(controller.snapshot.state.routeRejections?.detour?.message).toContain("fewer satellites");
    expect(controller.snapshot.step).toBe(1);
    expect(controller.snapshot.state.game).toEqual(initial);
    controller.destroy();
    const restored = await createTutorial({ ...lesson, storage });
    expect(restored.snapshot.step).toBe(1);
    expect(await restored.play({ kind: "probe", attempt: "detour" })).toBe(false);
    expect(await restored.play({ kind: "probe", attempt: "station", location: detour })).toBe(false);
    expect(restored.snapshot.step).toBe(1);
    expect(await restored.play({ kind: "probe", attempt: "station" })).toBe(true);
    expect(restored.snapshot.step).toBe(2);
    expect(restored.snapshot.state.routeRejections?.station).toMatchObject({ value: 9, satellites: 6 });
    expect(restored.snapshot.state.routeRejections?.station?.message).toContain("outclassed");
    expect(restored.snapshot.state.game).toEqual(initial);
    await restored.previousStep();
    expect(restored.snapshot.step).toBe(1);
    expect(restored.snapshot.state.routeRejections?.station).toBeUndefined();
    expect(await restored.play({ kind: "probe", attempt: "station" })).toBe(true);
    expect(await restored.play(lesson.steps[2].solution!(restored.snapshot.state))).toBe(true);
    expect(restored.snapshot.completed).toBe(true);
    restored.destroy();
  });
  it("research level 5 consumes a green token", () => {
    const end = finish("green-tokens");
    expect(end.players[0].data.research[ResearchField.Science]).toBe(5);
    expect(end.players[0].data.tiles.federations[0].green).toBe(false);
  });
  it("spends knowledge on research as a separate main action without taking another tech tile", () => {
    const lesson = lessons.find((entry) => entry.id === "upgrades")!;
    let state = lesson.initialState();
    for (const step of lesson.steps.slice(0, 3)) state = lesson.move(state, step.solution!(state)) as typeof state;
    const before = Engine.fromData(copy(state.game)).players[0].data;
    expect(before.research[ResearchField.Navigation]).toBe(1);
    expect(before.range).toBe(1);
    expect(state.moves).toBe(2);
    const next = lesson.move(state, lesson.steps[3].solution!(state)) as typeof state;
    const after = Engine.fromData(copy(next.game)).players[0].data;
    expect(after.knowledge).toBe(before.knowledge - 4);
    expect(after.research[ResearchField.Navigation]).toBe(2);
    expect(after.range).toBe(2);
    expect(after.tiles.techs).toEqual(before.tiles.techs);
    expect(next.moves).toBe(3);
  });
  it("burns two tokens, converts without ending the turn, then pays for the mine", () => {
    const lesson = lessons.find((entry) => entry.id === "free-actions")!;
    let state = lesson.initialState();
    const start = Engine.fromData(copy(state.game));
    const steps = lesson.steps;
    state = lesson.move(state, steps[0].solution!(state)) as typeof state;
    let data = Engine.fromData(copy(state.game)).players[0].data;
    expect([data.power.area1, data.power.area2, data.power.area3]).toEqual([2, 0, 4]);
    expect(state.moves).toBe(0);
    state = lesson.move(state, steps[1].solution!(state)) as typeof state;
    data = Engine.fromData(copy(state.game)).players[0].data;
    expect([data.power.area1, data.power.area2, data.power.area3, data.ores]).toEqual([5, 0, 1, 1]);
    expect(state.moves).toBe(0);
    state = lesson.move(state, steps[2].solution!(state)) as typeof state;
    const converted = Engine.fromData(copy(state.game));
    data = converted.players[0].data;
    expect([data.power.area1, data.power.area2, data.power.area3, data.credits]).toEqual([6, 0, 0, 2]);
    expect(state.moves).toBe(0);
    expect(converted.currentPlayer).toBe(0);
    expect(converted.boardActions).toEqual(start.boardActions);
    const end = finish("free-actions");
    expect(end.map.getS("1x0").data.building).toBe(Building.Mine);
    expect(end.players[0].data.ores).toBe(0);
    expect(end.players[0].data.credits).toBe(0);
    expect(end.players[0].data.power).toEqual(data.power);
    expect(end.players[0].data.buildings[Building.Mine]).toBe(2);
  });
  it("an advanced tile covers the one-off reward without losing its points or the other tile’s income", () => {
    const lesson = lessons.find((entry) => entry.id === "advanced-tech")!;
    let state = lesson.initialState();
    for (const step of lesson.steps.slice(0, 2)) state = lesson.move(state, step.solution!(state)) as typeof state;
    const choosing = Engine.fromData(copy(state.game));
    expect(choosing.findAvailableCommand(0, Command.ChooseCoverTechTile).data.tiles).toHaveLength(2);
    const before = choosing.players[0];
    const covered = lesson.move(state, lesson.steps[2].solution!(state)) as typeof state;
    const after = Engine.fromData(copy(covered.game)).players[0];
    expect(after.data.tiles.techs.find((tile) => tile.tile === TechTile.Tech4)?.enabled).toBe(false);
    expect(after.data.tiles.techs.find((tile) => tile.tile === TechTile.Tech8)?.enabled).toBe(true);
    expect(after.data.tiles.techs.find((tile) => tile.pos === AdvTechTilePos.Science)?.enabled).toBe(true);
    expect(after.data.victoryPoints).toBe(before.data.victoryPoints);
    expect(after.resourceIncome(Resource.Credit)).toBe(before.resourceIncome(Resource.Credit));
    expect(after.data.tiles.federations[0].green).toBe(false);
    const research = Engine.fromData(copy(covered.game)).findAvailableCommand(0, Command.UpgradeResearch);
    expect(research.data.tracks.some((track) => track.field === ResearchField.Science)).toBe(false);
    const end = finish("advanced-tech").players[0];
    expect(end.data.research[ResearchField.Intelligence]).toBe(1);
    expect(end.data.research[ResearchField.Science]).toBe(4);
    expect(end.data.knowledge).toBe(before.data.knowledge);
  });
  it.each(["grey token", "research level 3", "no uncovered tile"])(
    "cannot take the advanced tile with %s",
    (missing) => {
      const lesson = lessons.find((entry) => entry.id === "advanced-tech")!;
      const engine = Engine.fromData(copy(lesson.initialState().game));
      const player = engine.players[0];
      if (missing === "grey token") player.data.tiles.federations[0].green = false;
      if (missing === "research level 3") player.data.research[ResearchField.Science] = 3;
      if (missing === "no uncovered tile")
        for (const tile of player.data.tiles.techs) player.coverTechTile(tile.pos as TechTilePos);
      expect(() => engine.move("terrans build lab 0x0. tech adv-sci")).toThrow(/Impossible to get adv-sci tile/);
    }
  );
  it("restores the unfinished tech choice and rejects covering the income tile in this lesson", async () => {
    const lesson = lessons.find((entry) => entry.id === "advanced-tech")!;
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    const controller = await createTutorial({ ...lesson, storage });
    for (const step of lesson.steps.slice(0, 2)) await controller.play(step.solution!(controller.snapshot.state));
    const restored = await createTutorial({ ...lesson, storage });
    expect(restored.snapshot.step).toBe(2);
    expect(restored.snapshot.state).toEqual(controller.snapshot.state);
    const before = copy(restored.snapshot.state);
    const cover = lesson.steps[2];
    const solution = cover.solution!(before);
    if (solution.kind !== "move") throw new Error("Covering a tech tile needs a game move");
    const incomeTile = Engine.fromData(copy(before.game)).players[0].data.tiles.techs.find(
      (tile) => tile.tile === TechTile.Tech8
    )!;
    expect(
      await restored.play({ kind: "move", move: solution.move.replace(/cover \S+/, `cover ${incomeTile.pos}`) })
    ).toBe(false);
    expect(restored.snapshot.state).toEqual(before);
    expect(restored.snapshot.error).toContain("remove your 4-credit income");
    expect(await restored.play(cover.solution!(before))).toBe(true);
    restored.destroy();
    controller.destroy();
  });
  it("Ivits start with only a planetary institute and can place a station once per round", () => {
    const lesson = lessons.find((l) => l.id === "ivits")!;
    let state = lesson.initialState();
    const start = Engine.fromData(copy(state.game));
    expect(start.round).toBe(1);
    expect(new Set(start.players.map((player) => player.planet)).size).toBe(3);
    expect(start.players[0].data.buildings[Building.PlanetaryInstitute]).toBe(1);
    expect(start.players[0].data.buildings[Building.Mine]).toBe(0);
    expect(start.players[0].data.occupied).toHaveLength(1);
    expect(start.map.getS("0x0").data.planet).toBe(Planet.Oxide);
    // Without the station, this planet is beyond basic range and needs QIC.
    start.players[0].data.qics = 0;
    start.availableCommands = null;
    expect(() => start.move("ivits build m 2x0.")).toThrow();
    state = lesson.move(state, lesson.steps[0].solution!(state)) as typeof state;
    const placed = Engine.fromData(copy(state.game));
    expect(placed.players[0].data.buildings[Building.SpaceStation]).toBe(1);
    expect(placed.players[0].buildingValue(placed.map.getS("1x0"), { federation: true })).toBe(1);
    expect(() => placed.move("ivits special space-station. build sp 1x1.")).toThrow();
    const qics = Engine.fromData(copy(state.game)).players[0].data.qics;
    state = lesson.move(state, lesson.steps[1].solution!(state)) as typeof state;
    const mine = Engine.fromData(copy(state.game));
    expect(mine.map.getS("2x0").data.building).toBe(Building.Mine);
    expect(mine.players[0].data.qics).toBe(qics);
    state = lesson.move(state, lesson.steps[2].solution!(state)) as typeof state;
    const laterTurn = Engine.fromData(copy(state.game));
    expect(laterTurn.round).toBe(1);
    expect(() => laterTurn.move("ivits special space-station. build sp 1x1.")).toThrow();
    state = lesson.move(state, lesson.steps[3].solution!(state)) as typeof state;
    expect(Engine.fromData(copy(state.game)).round).toBe(2);
    state = lesson.move(state, lesson.steps[4].solution!(state)) as typeof state;
    expect(Engine.fromData(copy(state.game)).players[0].data.buildings[Building.SpaceStation]).toBe(2);
  });
  it("Ivits stations add federation value and connect the lesson's network without satellites", () => {
    const lesson = lessons.find((l) => l.id === "ivits")!;
    let state = lesson.initialState();
    for (const step of lesson.steps.slice(0, 5)) state = lesson.move(state, step.solution!(state)) as typeof state;
    const before = Engine.fromData(copy(state.game));
    const player = before.players[0];
    const info = player.checkAndGetFederationInfo("0x0,1x0,2x0,1x1", before.map, false, false);
    expect(info.powerValue).toBe(7);
    expect(info.newSatellites).toBe(0);
    expect(info.planets).toBe(2);
    const formed = lesson.move(state, lesson.steps[5].solution!(state)) as typeof state;
    const end = Engine.fromData(copy(formed.game));
    expect(end.players[0].data.satellites).toBe(0);
    expect(end.players[0].data.qics).toBe(player.data.qics + 1);
    expect(end.players[0].data.power).toEqual(player.data.power);
    expect(end.players[0].federationCost).toBe(14);
    for (const coords of ["0x0", "1x0", "2x0", "1x1"]) expect(end.map.getS(coords).belongsToFederationOf(0)).toBe(true);
  });
  it("finishes round six instead of only announcing the end", () => {
    expect(finish("scoring").phase).toBe(Phase.EndGame);
  });
  it("normal asteroid colonisation consumes a Gaiaformer", () => {
    expect(finish("new-planets").players[0].data.gaiaformersUsedForAsteroid).toBe(1);
  });
  it("wrong quiz answers leave both the step and the game unchanged", async () => {
    const controller = await createTutorial(lessons[0]);
    const before = copy(controller.snapshot.state);
    expect(await controller.play({ kind: "answer", answer: "Most credits" })).toBe(false);
    expect(controller.snapshot.step).toBe(0);
    expect(controller.snapshot.state).toEqual(before);
    expect(controller.snapshot.error).toContain("Victory points");
    controller.destroy();
  });
});

describe.each([1, 10])("asteroid tutorial choices with %i Q.I.C.", (qics) => {
  const original = lessons.find((lesson) => lesson.id === "new-planets")!;
  const lesson = {
    ...original,
    initialState() {
      const state = original.initialState();
      expect(state.game.players[0].data.qics).toBe(1);
      const engine = Engine.fromData(copy(state.game));
      engine.players[0].data.qics = qics;
      engine.generateAvailableCommands();
      const game = serialise(engine);
      return { ...state, game, turn: copy(game) };
    },
  };
  const initial = Engine.fromData(copy(lesson.initialState().game));
  const builds = initial.findAvailableCommand(0, Command.Build).data.buildings;
  const asteroids = builds.filter(
    (build) => build.building === Building.Mine && initial.map.getS(build.coordinates).data.planet === Planet.Asteroid
  );

  it("offers reachable asteroids", () => {
    expect(asteroids.length).toBeGreaterThan(qics === 1 ? 0 : 1);
  });

  for (const target of asteroids) {
    it(`accepts ${target.coordinates}, completes the chapter and restores progress`, async () => {
      const saved = new Map<string, string>();
      const storage = {
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => {
          saved.set(key, value);
        },
      };
      const controller = await createTutorial({ ...lesson, storage });
      await controller.play(lesson.steps[0].solution!(controller.snapshot.state));
      const move = `${initial.players[0].faction} build m ${target.coordinates}`;
      expect(await controller.play({ kind: "move", move })).toBe(true);
      expect(await controller.play({ kind: "move", move: move + "." })).toBe(true);
      expect(controller.snapshot.step).toBe(2);
      await controller.play(lesson.steps[2].solution!(controller.snapshot.state));
      expect(controller.snapshot.completed).toBe(true);
      const restored = await createTutorial({ ...lesson, storage });
      expect(restored.snapshot.completed).toBe(true);
      expect(restored.snapshot.state).toEqual(controller.snapshot.state);
      controller.destroy();
      restored.destroy();
    });
  }

  it("rejects a legal mine on another planet without changing the game", async () => {
    const controller = await createTutorial(lesson);
    await controller.play(lesson.steps[0].solution!(controller.snapshot.state));
    const before = copy(controller.snapshot.state.game);
    const target = builds.find(
      (build) => build.building === Building.Mine && initial.map.getS(build.coordinates).data.planet !== Planet.Asteroid
    )!;
    expect(target).toBeDefined();
    expect(
      await controller.play({ kind: "move", move: `${initial.players[0].faction} build m ${target.coordinates}.` })
    ).toBe(false);
    expect(controller.snapshot.step).toBe(1);
    expect(controller.snapshot.state.game).toEqual(before);
    controller.destroy();
  });
});
