import type { TutorialOptions, TutorialStep } from "@boardgamers/protocol/tutorial";
import Engine, {
  AdvTechTile,
  AdvTechTilePos,
  Booster,
  Building,
  Command,
  Faction,
  Federation,
  Phase,
  Planet,
  Power,
  ResearchField,
  TechTile,
  TechTilePos,
} from "@gaia-project/engine";
import { loadScenarioEngine } from "../self-contained-scenarios";
import type { RejectedRoute, RouteRejections } from "./federation-routes";
import { detour, reducedRoute, routeExamples, stationRoute } from "./federation-routes";
import type { GameData } from "./position";
import {
  building,
  copy,
  federationPosition,
  home,
  ivitsOpening,
  planet,
  position,
  prepareBoosters,
  serialise,
  setBoosters,
} from "./position";

export type Action =
  | { kind: "move"; move: string }
  | { kind: "answer"; answer: string }
  | { kind: "probe"; attempt: RejectedRoute; location?: string };
export interface State {
  game: GameData;
  turn: GameData;
  moves: number;
  lastMove?: string;
  answer?: string;
  routeRejections?: RouteRejections;
}
export interface Choice {
  label: string;
  action: Action;
}
type Step = TutorialStep<State, Action> & { choices?: (state: State) => Choice[]; solution?: (state: State) => Action };
export interface Lesson extends TutorialOptions<State, Action> {
  section: string;
  title: string;
  description: string;
  steps: Step[];
}
export const sections = [
  {
    id: "basics",
    title: "The basics",
    description: "Expand, improve your economy and turn six rounds into victory points.",
  },
  {
    id: "federations",
    title: "Federations",
    description: "Connect buildings, plan legal routes and unlock advanced technologies.",
  },
  {
    id: "factions",
    title: "Faction differences",
    description: "Three examples of rules that change with your faction.",
  },
  {
    id: "lost-fleet",
    title: "The Lost Fleet",
    description: "Explore spaceships, use their actions and discover artifacts.",
  },
];
const engineOf = (state: State) => Engine.fromData(copy(state.game));
const coords = (engine: Engine, value: string) =>
  value.replace(/-?\d+x-?\d+|\d+[ABC]\d*/g, (coord) => engine.map.getS(coord)?.toString() ?? coord);
const normalise = (engine: Engine, move: string) =>
  coords(engine, move)
    .replace(/(federation )([^ ]+)/g, (_match, command, location) => command + location.split(",").sort().join(","))
    .trim()
    .replace(/\s*\.\s*/g, ". ")
    .trim()
    .replace(/\.$/, "")
    .trim();

function opponents(engine: Engine) {
  for (let guard = 0; guard < 30 && engine.phase !== Phase.EndGame; guard++) {
    engine.generateAvailableCommandsIfNeeded();
    const income = engine.findAvailableCommand(engine.playerToMove, Command.ChooseIncome);
    if (income) {
      engine.move(`${engine.players[engine.playerToMove].faction} income ${income.data.join(",")}`);
      continue;
    }
    if (engine.playerToMove === 0) return;
    const seat = engine.playerToMove;
    const prefix = engine.players[seat].faction;
    const commands = engine.generateAvailableCommands();
    if (commands.some((command) => command.name === Command.Decline)) engine.move(`${prefix} decline`);
    else {
      const pass = engine.findAvailableCommand(seat, Command.Pass);
      if (pass) engine.move(`${prefix} pass ${pass.data.boosters?.[0] ?? ""}`.trim());
      else if (!engine.autoMove())
        throw new Error(
          `The scripted opponent needs an unsupported decision: ${engine.phase} / ${JSON.stringify(commands)}`
        );
    }
  }
}

export function apply(state: State, action: Action): State {
  const next = copy(state);
  next.answer = undefined;
  if (action.kind === "answer") next.answer = action.answer;
  else if (action.kind === "probe") {
    const engine = engineOf(state);
    const location = action.location ?? (action.attempt === "detour" ? detour : stationRoute);
    const hexes = engine.players[0].hexesForFederationLocation(location, engine.map);
    const info = engine.players[0].federationInfo(hexes);
    try {
      engine.players[0].checkAndGetFederationInfo(location, engine.map, false, false);
    } catch (error) {
      next.routeRejections = {
        ...next.routeRejections,
        [action.attempt]: {
          message: error instanceof Error ? error.message : String(error),
          coordinates: hexes.map((hex) => `${hex.q}x${hex.r}`),
          value: info.powerValue,
          satellites: info.newSatellites,
        },
      };
      return next;
    }
    throw new Error("This route should be rejected; the lesson position needs updating.");
  } else {
    const engine = Engine.fromData(copy(state.turn));
    engine.move(action.move);
    next.lastMove = action.move;
    if (engine.newTurn) {
      next.moves++;
      opponents(engine);
      next.turn = serialise(engine);
    }
    next.game = serialise(engine);
  }
  return next;
}
function probeRoute(attempt: RejectedRoute, title: string, text: string, error: string): Step {
  const example = routeExamples[attempt === "detour" ? 0 : 1];
  return {
    id: attempt,
    title,
    text,
    complete: (state) => !!state.routeRejections?.[attempt],
    validateMove(state, action) {
      if (action.kind !== "probe" || action.attempt !== attempt)
        return "Use End Selection in the game controls, then choose a federation token.";
      const engine = engineOf(state);
      try {
        engine.players[0].checkAndGetFederationInfo(action.location ?? example.location, engine.map, false, false);
        return "That route is valid. Use Restore this attempt to see why this example is refused.";
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!message.includes(error)) return `${message}. Use Restore this attempt to test the example.`;
      }
    },
    solution: () => ({ kind: "probe", attempt }),
  };
}
function question(id: string, title: string, text: string, answers: string[], correct: string, feedback: string): Step {
  return {
    id,
    title,
    text,
    complete: (state) => state.answer === correct,
    validateMove: (_state, action) => (action.kind === "answer" && action.answer === correct ? undefined : feedback),
    success: `Correct. ${feedback}`,
    choices: () => answers.map((answer) => ({ label: answer, action: { kind: "answer", answer } })),
    solution: () => ({ kind: "answer", answer: correct }),
  };
}
function play(
  id: string,
  title: string,
  text: string | ((s: State) => string),
  command: string | ((s: State) => string),
  count: number | ((state: State) => boolean),
  hint: string
): Step {
  const move = (state: State) => (typeof command === "function" ? command({ ...state, game: state.turn }) : command);
  return {
    id,
    title,
    text: (state) => {
      const explanation = typeof text === "function" ? text({ ...state, game: state.turn }) : text;
      const location = /\bbuild \S+ (-?\d+x-?\d+|\d+[ABC]\d*)/.exec(move(state))?.[1];
      return location ? `${explanation} Select ${coords(engineOf(state), location)} on the map.` : explanation;
    },
    hint,
    target: "game-controls",
    complete: typeof count === "function" ? count : (state) => state.moves >= count,
    validateMove(state, action) {
      if (action.kind !== "move") return "Use the action described in this step.";
      const engine = engineOf(state);
      const wanted = normalise(engine, move(state));
      const actual = normalise(engine, action.move);
      if (!actual || !(wanted === actual || wanted.startsWith(actual + ". ")))
        return "Follow this step’s action using the game controls below.";
    },
    solution: (state) => ({ kind: "move", move: move(state) }),
  };
}
function lesson(
  id: string,
  section: string,
  title: string,
  description: string,
  setup: () => Engine,
  steps: Step[],
  conclusion: string,
  version = 1
): Lesson {
  return {
    game: "gaia-project",
    id,
    version,
    section,
    title,
    description,
    initialState() {
      const engine = setup();
      for (const player of engine.players) player.loadEvents(engine.currentRoundScoringEvents);
      const game = serialise(engine);
      return { game, turn: copy(game), moves: 0 };
    },
    move: apply,
    steps,
    completion: { title: "Chapter complete", text: conclusion },
  };
}
const federationMove = (state: State, token = "fed2") => {
  const engine = engineOf(state);
  const option = engine.players[0].availableFederations(engine.map, false)[0];
  if (!option) throw new Error("No federation in this teaching position.");
  return `${engine.players[0].faction} federation ${option.hexes.map((h) => h.toString()).join(",")} ${token}.`;
};
const passMove = (state: State) => {
  const engine = engineOf(state);
  return `${engine.players[0].faction} pass ${engine.findAvailableCommand(0, Command.Pass).data.boosters?.[0] ?? ""}`.trim();
};
const advancedTechCoverMove = (state: State, tile = TechTile.Tech4) => {
  const base = "terrans build lab 0x0. tech adv-sci";
  const owned = engineOf(state).players[0].data.tiles.techs.find((entry) => entry.tile === tile);
  if (!owned) throw new Error("Missing standard tile in the advanced technology lesson.");
  return `${base}. cover ${owned.pos}`;
};

export const lessons: Lesson[] = [
  lesson(
    "first-mine",
    "basics",
    "Your first mine",
    "Learn the goal, pay for a mine and see how buildings grow your income.",
    home,
    [
      question(
        "goal",
        "Six rounds to score",
        "A game lasts six rounds. Buildings provide income; round tiles, research, federations and the two final objectives earn victory points. What decides the winner after final scoring?",
        ["Most credits", "Most victory points", "Most planets"],
        "Most victory points",
        "Victory points decide the winner. A large empire helps only when it earns points."
      ),
      play(
        "mine",
        "Settle a home-type planet",
        "You are the Terrans. The blue planet next to your mine needs no terraforming and is within range. Build a mine for 1 ore and 2 credits. Choose End turn when you have finished.",
        "terrans build m 1x0.",
        1,
        "Build the blue-planet mine"
      ),
      question(
        "income",
        "The income is for later",
        "Your new mine uncovers ore income on your faction board. You do not receive that income immediately. When will you receive it?",
        ["Immediately", "At the start of the next round"],
        "At the start of the next round",
        "Income is collected at the start of a round. Check the exposed income icons before choosing your next building."
      ),
    ],
    "You built a mine and improved future income. Each turn normally takes one main action, with free conversions before or after it."
  ),
  lesson(
    "terraforming",
    "basics",
    "Terraforming and range",
    "Read your range, reach farther with Q.I.C. or a booster, and pay for terraforming.",
    () => {
      const e = home();
      planet(e, "-1x0", Planet.Ice);
      planet(e, "4x0", Planet.Terra);
      setBoosters(
        e,
        [Booster.Booster5, Booster.Booster6, Booster.Booster3],
        [Booster.Booster1, Booster.Booster2, Booster.Booster4]
      );
      return e;
    },
    [
      {
        ...question(
          "basic-range",
          "Find your range",
          "Your current range is shown beside the range arrow at the top right of your faction board. Count hexes from your nearest building to the destination. A range of 1 reaches an adjacent hex. What is your range now?",
          ["1", "2", "3"],
          "1",
          "Your basic range is 1, so more distant planets need a range boost."
        ),
        target: "player-range-0",
      },
      question(
        "cost",
        "A different planet type",
        "The nearby white ice planet is one step from the Terrans’ blue home type. At terraforming level 0, one step costs 3 ore. The mine itself costs 1 ore and 2 credits. How much ore is needed in total?",
        ["1 ore", "3 ore", "4 ore"],
        "4 ore",
        "3 ore for terraforming plus 1 ore for the mine makes 4 ore."
      ),
      play(
        "ice",
        "Terraform and build",
        "Build the mine on the adjacent ice planet. The engine pays the terraforming and building costs together.",
        "terrans build m -1x0.",
        1,
        "Terraform ice and build"
      ),
      play(
        "qic-range",
        "Reach farther with Q.I.C.",
        "The blue planet beyond your new mine is 2 hexes away. Each Q.I.C. spent adds 2 range for this action only. Build there: the game charges 1 Q.I.C. for range, plus the mine’s 1 ore and 2 credits. Its blue planet needs no terraforming.",
        "terrans build m -3x0.",
        2,
        "Build the distant blue-planet mine with 1 Q.I.C."
      ),
      question(
        "navigation",
        "Improve your basic range",
        "Navigation research increases basic range to 2 at level 2, to 3 at level 4 and to 4 at level 5. These increases last for the rest of the game. The Q.I.C. you just spent helped only that build. What is your basic range still?",
        ["1", "2", "3"],
        "1",
        "Your basic range remains 1. A later lesson lets you research Navigation to increase it."
      ),
      play(
        "booster-range",
        "Use the +3 range booster",
        "Your round booster has a +3 range special action, usable once this round. Choose Special Action, then +3 range, and build on the blue planet 4 hexes to the right of your central mine. Basic range 1 + 3 reaches it without Q.I.C. You still pay 1 ore and 2 credits for the mine. This action can also send a Gaiaformer, which we will cover later.",
        "terrans special range+3. build m 4x0.",
        3,
        "Use the booster’s special action, then build the mine"
      ),
    ],
    "Check range, terraforming and mine cost separately. Navigation improves your basic range; Q.I.C. adds 2 for one action; the booster’s special action adds 3 once per round.",
    2
  ),
  lesson(
    "upgrades",
    "basics",
    "Trading stations and research",
    "Upgrade a mine, take a tech tile and spend knowledge to advance research.",
    home,
    [
      play(
        "station",
        "Build near a neighbour",
        "A trading station replaces one of your mines. It costs 2 ore and 6 credits, reduced to 3 credits when an opponent has a building within distance 2. Ada is nearby, so upgrade your central mine for 2 ore and 3 credits.",
        "terrans build ts 0x0.",
        1,
        "Upgrade to a trading station"
      ),
      play(
        "lab",
        "A lab brings a technology tile",
        "Upgrade that station to a research lab for 3 ore and 5 credits. Take the tech tile below Navigation, then advance Navigation for free. A tech tile under a track advances that track; a tile from the free row lets you choose.",
        "terrans build lab 0x0. tech nav. up nav.",
        2,
        "Build a lab and take Navigation’s tile"
      ),
      question(
        "replace",
        "Upgrades change your income",
        "The old building goes back to your board. Its exposed income space is covered again, while the new building exposes a different income. Does an upgrade keep both buildings’ income?",
        ["Yes", "No"],
        "No",
        "You exchange one building’s income for another. Keep enough ore income to fund future upgrades."
      ),
      play(
        "knowledge",
        "Spend knowledge to research",
        "You can also spend 4 knowledge to advance one level on an available research track. This uses your main action and does not give you a tech tile. Choose Research, then Navigation: moving from level 1 to 2 increases your basic range from 1 to 2. Choose End turn when you have finished.",
        "terrans up nav.",
        3,
        "Spend 4 knowledge to advance Navigation"
      ),
    ],
    "The tech tile gave you one free research advance. On a later turn, you spent 4 knowledge to advance again. Labs provide knowledge income at the start of each round, helping you fund more research.",
    2
  ),
  lesson(
    "power",
    "basics",
    "Charging and spending power",
    "Follow the three bowls and spend power without losing the tokens.",
    home,
    [
      question(
        "bowls",
        "Power circulates",
        "Charging first moves tokens from bowl I to II. Only when I is empty does charging move tokens from II to III. Which bowl can pay for power actions?",
        ["Bowl I", "Bowl II", "Bowl III"],
        "Bowl III",
        "Only bowl III contains spendable power. Spending returns those tokens to bowl I."
      ),
      play(
        "action",
        "Use a shared power action",
        "Spend 4 power for the shared action that grants 2 ore. The action becomes unavailable to everyone for the rest of this round.",
        "terrans action power3.",
        1,
        "Spend 4 power for 2 ore"
      ),
      question(
        "charge",
        "Your neighbours can help",
        "When another player builds or upgrades within distance 2, you may charge power based on your highest-value nearby building. Charging 3 power normally costs how many victory points?",
        ["0 VP", "2 VP", "3 VP"],
        "2 VP",
        "A charge costs one fewer VP than the power you actually charge. You may decline. Burning moves one token from II to III and permanently discards another token from II."
      ),
    ],
    "Power spent on an action cycles back to bowl I. Burning and paying for satellites remove tokens instead, so they have a lasting cost."
  ),
  lesson(
    "free-actions",
    "basics",
    "Burn power and convert resources",
    "Get the resources you are missing without using up your main action.",
    () => {
      const e = home();
      const data = e.players[0].data;
      data.ores = 0;
      data.credits = 1;
      data.knowledge = 0;
      data.qics = 0;
      data.power = new Power(2, 4, 2, 0);
      return e;
    },
    [
      play(
        "burn",
        "Make power available now",
        "The nearby blue-planet mine costs 1 ore and 2 credits. You are short 1 ore and 1 credit. Burning takes two tokens from bowl II: discard one permanently and move the other to III. Do this twice to raise your spendable power from 2 to 4. Bowl I does not need to be empty.",
        "terrans burn 2",
        (state) => engineOf(state).players[0].data.power.area3 === 4,
        "Burn: discard 2 tokens and move 2 to bowl III"
      ),
      play(
        "ore",
        "Convert power into ore",
        "Spend 3 power from bowl III to gain 1 ore. These spent tokens return to bowl I; they are not discarded. This free conversion remains available even if someone has already used the shared action that gives 2 ore for 4 power.",
        "terrans burn 2. spend 3pw for 1o",
        (state) => engineOf(state).players[0].data.ores === 1,
        "Convert 3 power → 1 ore"
      ),
      play(
        "credit",
        "Get the missing credit",
        "Spend your last 1 power from bowl III to gain 1 credit. You may repeat free conversions as often as you can pay for them. They do not block a shared action space.",
        "terrans burn 2. spend 3pw for 1o. spend 1pw for 1c",
        (state) => engineOf(state).players[0].data.credits === 2,
        "Convert 1 power → 1 credit"
      ),
      question(
        "turn",
        "Free means no main action",
        "Burning and conversions cost resources, but do not use your main action. You can do them before or after your main action on your turn, but not in the middle of it or after passing. Can you still build your mine this turn?",
        ["Yes, my main action is still available", "No, the conversions used my turn"],
        "Yes, my main action is still available",
        "You now have 1 ore and 2 credits, and have not used your main action."
      ),
      play(
        "mine",
        "Now use your main action",
        "Build the blue-planet mine with the resources you just obtained. Burning reduced your total number of power tokens; converting only moved the spent tokens back to bowl I.",
        "terrans burn 2. spend 3pw for 1o. spend 1pw for 1c. build m 1x0.",
        1,
        "Build the mine for 1 ore and 2 credits"
      ),
      question(
        "direction",
        "Conversions go one way",
        "Other basic rates include 4 power → 1 knowledge and 4 power → 1 Q.I.C. Conversion arrows are one-way. Can the Terrans reverse 1 power → 1 credit to buy power back with a credit?",
        ["Yes", "No"],
        "No",
        "Only the indicated direction is allowed. Some factions add their own conversions."
      ),
    ],
    "You burned and converted before building, all in one turn. Burning permanently loses tokens; spending power sends them back to bowl I. Other basic conversions are 1 Q.I.C. → 1 ore, 1 ore or 1 knowledge → 1 credit, and 1 ore → 1 new power token in bowl I."
  ),
  lesson(
    "passing",
    "basics",
    "Passing and choosing a booster",
    "Trade your remaining actions for next round’s booster, or wait for another player to return one.",
    () => {
      const e = home();
      setBoosters(
        e,
        [Booster.Booster6, Booster.Booster5, Booster.Booster3],
        [Booster.Booster1, Booster.Booster2, Booster.Booster4]
      );
      return e;
    },
    [
      question(
        "held-booster",
        "Which boosters can you take?",
        "Passing ends your actions for this round. Choose one of the three available boosters, then return your old one. Ada currently holds the +3 range booster you want for next round. Can you take it while she still holds it?",
        ["Yes", "No"],
        "No",
        "Only available boosters can be chosen. You must wait for Ada to pass and return hers."
      ),
      play(
        "wait",
        "Build while you wait",
        "You still have a useful action: build the adjacent blue-planet mine for 1 ore and 2 credits, then end your turn. In this example, Ada will then pass and return her +3 range booster; Leo will pass too. Waiting means taking another action, not skipping your turn.",
        "terrans build m 1x0.",
        1,
        "Build the mine and let Ada return her booster"
      ),
      play(
        "swap",
        "Take the returned booster",
        "Ada’s +3 range booster is now available. Choose Pass, select that booster, then confirm. Your old booster gives 1 VP per mine when you pass, so your two mines earn 2 VP before you return it. You cannot keep the same booster for consecutive rounds. Everyone has now passed, so the next round begins and you collect income.",
        "terrans pass booster5",
        2,
        "Pass and choose the +3 range booster"
      ),
      question(
        "timing",
        "Pass early or wait?",
        "Waiting let you take Ada’s returned booster. But if a booster you want is already available, someone else may take it first. Passing early secures it, at the cost of your remaining actions this round. The first player to pass also starts the next round. When should you consider passing early?",
        [
          "When securing an available booster is worth giving up further actions",
          "Always, because passing gives an extra turn",
        ],
        "When securing an available booster is worth giving up further actions",
        "Weigh this round’s useful actions against the booster you want for next round."
      ),
    ],
    "Choose an available booster, then return yours and score any passing reward on it. Passing early can secure a tile; waiting can make a returned tile available. In round 6, return your booster without taking a new one."
  ),
  lesson(
    "gaiaforming",
    "basics",
    "Turn a purple planet green",
    "Send a Gaiaformer, wait for the next round, then build a mine.",
    () => {
      const e = home();
      planet(e, "-1x0", Planet.Transdim);
      return e;
    },
    [
      play(
        "former",
        "Start a Gaia project",
        "Purple transdim planets cannot be settled directly. Your Gaia Project research gives you a Gaiaformer. Send it to the nearby purple planet and commit 6 power tokens to the Gaia area.",
        "terrans build gf -1x0.",
        1,
        "Send a Gaiaformer"
      ),
      play(
        "pass",
        "Give the project time",
        "The Gaiaformer occupies the planet while the project develops. Choose Pass, then the first available booster. Ada and Leo have passed too, so the game advances to the next round.",
        passMove,
        2,
        "Pass and begin the next round"
      ),
      play(
        "green",
        "Build on your completed project",
        "The planet is now green. Replace your Gaiaformer with a mine for 1 ore and 2 credits. A mine on your own completed project does not cost the extra Q.I.C. normally needed for an unoccupied Gaia planet.",
        "terrans build m -1x0.",
        3,
        "Replace the Gaiaformer with a mine"
      ),
    ],
    "Gaia projects take time. Keep power tokens available for the project and resources ready for the mine in the following round. Terrans recover Gaia-area tokens into bowl II."
  ),
  lesson(
    "scoring",
    "basics",
    "Score the round and the game",
    "Read the objectives before choosing an action, then see final scoring.",
    () => {
      const e = home();
      e.round = 6;
      return e;
    },
    [
      question(
        "round",
        "Timing earns points",
        "The six round tiles reward different actions. A mine built in a mine-scoring round gives that round’s points immediately. Building it a round earlier does not earn those later points. When does an action earn a round tile’s reward?",
        ["Any mine earns every round’s reward", "Only the action in the matching round scores"],
        "Only the action in the matching round scores",
        "Round scoring rewards what you do during that round. Plan your upgrades and federations around it."
      ),
      play(
        "end",
        "Finish the sixth round",
        "Pass. The scripted opponents pass too. The engine adds the two final objectives, research points and leftover-resource points to the score.",
        passMove,
        1,
        "Pass and see final scoring"
      ),
      question(
        "research",
        "Research also scores",
        "At game end, each research track scores 4 VP per level above level 2. A track at level 4 therefore scores how many points?",
        ["4 VP", "8 VP", "16 VP"],
        "8 VP",
        "Level 4 is two levels above level 2, worth 8 VP. Credits, ore and knowledge also convert at 3 resources per VP in total."
      ),
    ],
    "The highest final VP total wins. Use both round scoring and the two final objectives to decide which expansion is worth paying for."
  ),
  lesson(
    "first-federation",
    "federations",
    "Connect your first federation",
    "Reach 7 building value, pay for satellites and claim a token.",
    () => federationPosition(),
    [
      question(
        "value",
        "Count building value, not buildings",
        "For a normal federation, mines have value 1; trading stations and labs have value 2; planetary institutes and academies have value 3. Here you have a planetary institute, an academy and a mine. What is their total?",
        ["3", "6", "7"],
        "7",
        "3 + 3 + 1 = 7. Seven is the normal minimum building value for a federation."
      ),
      play(
        "connect",
        "Link the group with satellites",
        (state) => {
          const e = engineOf(state);
          const f = e.players[0].availableFederations(e.map, false)[0];
          return `Connect your planetary institute, academy and mine using ${f.newSatellites} satellites. Each new satellite permanently removes one power token from your bowls. Take the green token worth 8 VP and 1 Q.I.C.`;
        },
        (state) => federationMove(state),
        1,
        "Form the federation: 8 VP + 1 Q.I.C."
      ),
      question(
        "reuse",
        "These buildings are committed",
        "The federation’s buildings and satellites stay on the map. Can a normal faction reuse these buildings in another federation?",
        ["Yes", "No"],
        "No",
        "Normally each building belongs to only one federation. A new building connected to an existing federation joins it without awarding another token."
      ),
    ],
    "Plan several separate groups, each with enough value. Ivits are a faction exception: they extend one federation instead."
  ),
  lesson(
    "federation-routes",
    "federations",
    "The tempting detour",
    "Try two rejected routes, then reduce the group to a legal federation.",
    () => federationPosition(true),
    [
      probeRoute(
        "detour",
        "Attempt 1: avoid the station",
        "Your planetary institute, academy and lower mine total 7. The preselected detour links them with 7 satellites, avoiding your trading station. Use End Selection in the game controls, then choose a federation token to test it. In a normal game, open Form federation → Custom location to select your own route.",
        "fewer satellites"
      ),
      probeRoute(
        "station",
        "Attempt 2: add the station, keep the mine",
        "The map now takes the shortcut through your trading station, keeping all three original buildings. This uses 6 satellites instead of 7. The station adds 2 value, bringing the total to 9. Is the shorter route legal now? Use End Selection again, then choose a federation token.",
        "outclassed"
      ),
      play(
        "short",
        "Attempt 3: remove the unnecessary branch",
        "Even the shorter route was refused. The planetary institute (3), station (2) and academy (3) already total 8, enough without the mine. Remove its branch and save 2 more satellites: only 4 remain. This reduced group is selected on the map. Use End Selection and take the token worth 8 VP and 1 Q.I.C. Then end your turn.",
        `terrans federation ${reducedRoute} fed2.`,
        1,
        "Form the reduced federation"
      ),
    ],
    "7 satellites → 6 → 4. Going through your station adds building value, making the mine’s branch unnecessary. The final federation costs 4 power tokens; the mine remains available for a future federation.",
    2
  ),
  lesson(
    "green-tokens",
    "federations",
    "Reaching research level 5",
    "Use a green federation token to claim the top space of a research track.",
    () => {
      const e = home();
      e.players[0].data.research[ResearchField.Science] = 4;
      e.players[0].data.tiles.federations.push({ tile: Federation.Fed2, green: true });
      return e;
    },
    [
      question(
        "green",
        "Keep a green token for the top level",
        "A federation token gives its printed rewards when you receive it. To advance from research level 4 to 5, you must also flip a green token to grey. The 12-VP token starts grey. Which token can unlock level 5?",
        ["A green token", "A grey token"],
        "A green token",
        "Flip a green token to grey. This does not give its printed rewards again."
      ),
      play(
        "level5",
        "Reach the top of Science",
        "You have 4 knowledge and a green federation token. Advance Science from level 4 to 5: pay the knowledge and flip the token. Only one player can occupy level 5 of each track.",
        "terrans up sci.",
        1,
        "Spend 4 knowledge to reach Science 5"
      ),
    ],
    "Your token is now grey, and Science level 5 is yours. Other players cannot reach that space. Keep a green token ready when planning a climb to the top of another track.",
    2
  ),
  lesson(
    "advanced-tech",
    "federations",
    "Taking an advanced technology",
    "Flip a green federation token and choose which standard tile to cover.",
    () => {
      const e = position();
      for (const [coords, kind] of [
        ["0x0", Building.TradingStation],
        ["1x0", Building.ResearchLab],
        ["-3x0", Building.ResearchLab],
      ] as [string, Building][]) {
        planet(e, coords, Planet.Terra);
        building(e, coords, kind);
      }
      const player = e.players[0];
      player.data.research[ResearchField.Science] = 4;
      player.data.tiles.federations.push({ tile: Federation.Fed2, green: true });
      for (const tile of [TechTile.Tech4, TechTile.Tech8]) {
        const entry = Object.entries(e.tiles.techs).find(([, supply]) => supply.tile === tile);
        if (!entry) throw new Error("Missing standard tile in the tutorial supply.");
        const [pos, supply] = entry;
        player.gainTechTile({ pos: pos as TechTilePos, tile });
        supply.count--;
      }
      const advanced = Object.entries(e.tiles.techs).find(([, entry]) => entry.tile === AdvTechTile.AdvTech3);
      if (advanced) e.tiles.techs[advanced[0]] = e.tiles.techs[AdvTechTilePos.Science];
      e.tiles.techs[AdvTechTilePos.Science] = { tile: AdvTechTile.AdvTech3, count: 1 };
      return e;
    },
    [
      question(
        "requirements",
        "Research alone is not enough",
        "To take an advanced tile above a research track, you need level 4 or 5 on that track, a green federation token to flip, and an uncovered standard tile to cover. Here you have all three. Does reaching level 4 automatically give you the advanced tile?",
        ["Yes", "No, I still need an action that grants a tech tile"],
        "No, I still need an action that grants a tech tile",
        "A lab or academy upgrade grants a tech tile. You may then choose an available advanced tile instead of a standard one."
      ),
      play(
        "take",
        "Upgrade and select the advanced tile",
        "Upgrade the central trading station to a lab for 3 ore and 5 credits. Choose the advanced tile above Science. Its orange action lets you gain 1 Q.I.C. and 5 credits once per round. Next, choose what it will cover.",
        "terrans build lab 0x0. tech adv-sci",
        (state) => !!engineOf(state).findAvailableCommand(0, Command.ChooseCoverTechTile),
        "Build the lab and select the advanced tile"
      ),
      {
        ...play(
          "cover",
          "Keep your income tile",
          "An advanced tile covers one uncovered standard tile. The covered tile loses its ongoing effects, but you keep rewards already received. Cover the tile that already gave you 7 VP, so your other tile keeps producing 4 credits each round.",
          (state) => advancedTechCoverMove(state),
          (state) =>
            engineOf(state).players[0].data.tiles.techs.some((tile) => tile.tile === TechTile.Tech4 && !tile.enabled),
          "Cover the 7-VP tile"
        ),
        validateMove(state, action) {
          return action.kind === "move" &&
            normalise(engineOf(state), action.move) === normalise(engineOf(state), advancedTechCoverMove(state))
            ? undefined
            : "That would remove your 4-credit income. Cover the 7-VP tile here: those points are already yours.";
        },
        success: "The 7-VP tile is covered, your 4-credit income stays, and your federation token is now grey.",
      },
      play(
        "research",
        "Choose a research advance",
        "An advanced tile also grants one free research advance on any track. Your green token was used for the tile, so reaching Science 5 would require another green token. Advance Artificial Intelligence to level 1 instead.",
        (state) => `${advancedTechCoverMove(state)}. up int.`,
        1,
        "Advance Artificial Intelligence for free"
      ),
      question(
        "covered",
        "What did covering the tile cost?",
        "The advanced tile now replaces the 7-VP tile’s effects. Your other standard tile still gives 4 credits each round. Do you lose the 7 VP you received earlier?",
        ["Yes, lose 7 VP", "No, keep the 7 VP"],
        "No, keep the 7 VP",
        "Past rewards stay yours. Covering stops future effects; it does not undo earlier gains."
      ),
    ],
    "An advanced tile uses one green federation token and covers one standard tile. Choose what you cover carefully: losing income or a useful action can be costly. The covered tile cannot be taken again or hold a second advanced tile."
  ),
  lesson(
    "xenos",
    "factions",
    "Xenos: a smaller threshold",
    "Use the planetary institute’s six-value federation rule.",
    () => federationPosition(false, Faction.Xenos),
    [
      question(
        "six",
        "The planetary institute changes the threshold",
        "Xenos normally follow the 7-value rule. After building their planetary institute, they can form federations with only 6 building value. Their planetary institute and academy already total how much?",
        ["5", "6", "7"],
        "6",
        "The planetary institute and academy each have value 3. With the Xenos planetary institute built, those two buildings can be enough."
      ),
      play(
        "fed",
        "Use the faction ability",
        "Form the available federation and take the green token worth 8 VP and 1 Q.I.C. The Xenos threshold lets you leave the lower mine for a later group.",
        (state) => federationMove(state),
        1,
        "Form the Xenos federation"
      ),
    ],
    "Always check the faction board before planning a federation. The lower threshold applies only while the Xenos planetary institute is built."
  ),
  lesson(
    "ivits",
    "factions",
    "Ivits: one growing federation",
    "Start with a planetary institute, place space stations and connect a federation without satellites.",
    ivitsOpening,
    [
      play(
        "station",
        "Start with your planetary institute",
        "Ivits start with a planetary institute on a red planet and no mines. Its special action places one space station per round, using your main action. Place it in the empty space beside your planetary institute. This space is within range, so placement costs no resources.",
        "ivits special space-station. build sp 1x0.",
        1,
        "Place the first space station"
      ),
      play(
        "mine",
        "Use the station to reach a planet",
        "You can measure range from a space station. The red planet is now within your basic range of 1: build your first mine for 1 ore and 2 credits, without spending Q.I.C. The station itself is not a colonized planet and gives no mine income, but adds 1 federation value.",
        "ivits build m 2x0.",
        2,
        "Build your first mine beyond the station"
      ),
      play(
        "upgrade",
        "Build up your network",
        "Upgrade the mine to a trading station for 2 ore and 3 credits; Ada’s nearby mine gives the discount. Your planetary institute (3), trading station (2) and space station (1) will total 6 federation value. You need 7.",
        "ivits build ts 2x0.",
        3,
        "Upgrade the mine to a trading station"
      ),
      play(
        "next-round",
        "One space station per round",
        "Your space-station action is used for this round. Taking another turn does not reset it. Choose Pass, then the first available booster and confirm it. This finishes the round, collects income and makes the special action available again.",
        passMove,
        4,
        "Pass and start the next round"
      ),
      play(
        "second-station",
        "Add another connection and value",
        "Place a second space station beside your existing station and trading station. Each station adds 1 federation value. Your connected network now totals 7: planetary institute 3 + trading station 2 + two space stations 2.",
        "ivits special space-station. build sp 1x1.",
        5,
        "Place the second space station"
      ),
      play(
        "first",
        "A federation with no satellites",
        "All four pieces are connected, so form your federation without placing any satellites. Take the green token worth 8 VP and 1 Q.I.C. Space stations add value and bridge gaps. If you still need satellites, Ivits pay 1 Q.I.C. for each instead of discarding power tokens.",
        "ivits federation 0x0,1x0,2x0,1x1 fed2.",
        6,
        "Form the federation with 0 satellites"
      ),
      question(
        "grow",
        "The next threshold is 14",
        "Ivits keep one growing federation. For a second token, extend this network to at least 14 total federation value, including its space stations. For the third, reach 21. May you instead create an unrelated 7-value group?",
        ["Yes", "No"],
        "No",
        "Ivits extend the original network. Their thresholds are 7, then 14, then 21, and so on."
      ),
    ],
    "You started with no mines and formed a federation using two space stations and no satellites. Plan a useful station each round to extend your reach and save Q.I.C. Keep growing the same federation toward 14, then 21 value.",
    2
  ),
  lesson(
    "terrans",
    "factions",
    "Terrans: recover Gaia power",
    "Understand why Gaia projects fit the Terrans’ economy.",
    () => {
      const e = home();
      planet(e, "-1x0", Planet.Transdim);
      return e;
    },
    [
      play(
        "project",
        "Commit power to a Gaia project",
        "Send your Gaiaformer to the nearby purple planet. This temporarily moves tokens out of your power bowls.",
        "terrans build gf -1x0.",
        1,
        "Start the Gaia project"
      ),
      play(
        "recover",
        "Recover into bowl II",
        "Choose Pass, then the first available booster and confirm it to start the next round. Terrans return their Gaia-area tokens to bowl II instead of bowl I, bringing them closer to spendable power.",
        passMove,
        2,
        "Pass and recover the tokens"
      ),
      question(
        "pi",
        "The planetary institute adds conversions",
        "With their planetary institute built, Terrans can convert Gaia-area tokens into resources during the Gaia phase. Those tokens still return to bowl II. Is this a normal action that replaces building a mine?",
        ["Yes", "No, it happens in the Gaia phase"],
        "No, it happens in the Gaia phase",
        "The conversion happens in the Gaia phase, before the round’s normal action turns."
      ),
    ],
    "Terrans benefit from repeated Gaia projects. Other factions have their own exceptions; these faction lessons complement the shared rules."
  ),
];

function expansionPosition(id: string) {
  const engine = loadScenarioEngine(id);
  engine.players.forEach((player, index) => (player.name = ["You", "Ada", "Leo"][index]));
  prepareBoosters(engine);
  return engine;
}
lessons.push(
  lesson(
    "exploration",
    "lost-fleet",
    "Explore a spaceship",
    "Spend a turn exploring and unlock a spaceship’s actions.",
    () => expansionPosition("lost-fleet-explore-ready"),
    [
      question(
        "ships",
        "New destinations on the map",
        "Lost Fleet adds spaceship sectors, new planet types, factions and rewards. To explore a spaceship, your network must be in range and you pay the cost shown for the available slot. Is exploration a free action or your main action?",
        ["Exploration is a free action", "Exploration is a main action"],
        "Exploration is a main action",
        "Exploration uses your main action. Q.I.C. can help with range; the spaceship’s own cost is separate."
      ),
      play(
        "explore",
        "Visit Twilight",
        "Your mine is in range of Twilight. Pay 5 victory points to explore it, place your exploration ship and unlock its actions.",
        (state) => {
          const e = engineOf(state);
          const c = e.findAvailableCommand(0, Command.Explore);
          return `${e.players[0].faction} explore ${c.data.ships[0].ship}.`;
        },
        1,
        "Explore Twilight for 5 victory points"
      ),
      question(
        "access",
        "Keep access to several ships",
        "Your shuttle stays on Twilight for the rest of the game. You can explore up to 3 different ships (2 in a two-player game), using a separate action and paying the exploration cost each time. Does exploring another ship remove your access to Twilight?",
        ["Yes", "No"],
        "No",
        "You keep access to every ship you explore. Using a ship action still takes a later action and its printed cost."
      ),
    ],
    "The spaceship boards replace the base game’s shared Q.I.C. actions. Plan which ship offers the actions and rewards your economy needs."
  ),
  lesson(
    "ship-actions",
    "lost-fleet",
    "Use Twilight’s range action",
    "Use a ship action to reach a planet beyond your normal navigation range.",
    () => expansionPosition("lost-fleet-twilight-range-plus-3"),
    [
      play(
        "range",
        "A temporary reach",
        "You already explored Twilight and keep access to it even after exploring other ships. Its knowledge action lets you build a mine with +3 range. The mine and any terraforming still cost resources. Choose Twilight’s knowledge action, then select the distant planet and end your turn.",
        (state) => {
          const e = Engine.fromData(copy(state.turn));
          const prefix = e.players[0].faction;
          const start = e.players[0].data.occupied[0];
          const partial = Engine.fromData(copy(state.turn));
          partial.move(`${prefix} spaceshipAction twilight knowledge`);
          const c = partial.findAvailableCommand(0, Command.Build);
          const target = c.data.buildings.find(
            (b) =>
              b.building === Building.Mine && e.map.distance(start, e.map.getS(b.coordinates)) > e.players[0].data.range
          );
          if (!target) throw new Error("No tutorial range target");
          return `${prefix} spaceshipAction twilight knowledge. build m ${target.coordinates}.`;
        },
        1,
        "Use Twilight and build the distant mine"
      ),
      question(
        "temporary",
        "Only this action gains range",
        "The ship action’s +3 range helped this mine. Does it permanently raise your Navigation research?",
        ["Yes", "No"],
        "No",
        "Temporary range expires after the action. Navigation research is a separate, lasting improvement."
      ),
    ],
    "Ship actions create new ways to expand. Check their resource costs, temporary bonuses and any once-per-round limits before using them."
  ),
  lesson(
    "artifacts",
    "lost-fleet",
    "Examine an artifact",
    "Take an artifact reward and distinguish it from a federation token.",
    () => expansionPosition("lost-fleet-artifact-choice"),
    [
      play(
        "artifact",
        "Choose a discovery",
        "You have already explored Twilight. Discard 6 power tokens from any combination of bowls I, II and III to examine an artifact, then choose the credit reward. These tokens return to the supply; this is not spending 6 power from bowl III.",
        "terrans examineArtifact. chooseArtifactToken artifact-credit.",
        1,
        "Discard 6 power tokens and choose credits"
      ),
      question(
        "different",
        "Different rewards have different rules",
        "Artifact tokens and federation tokens are different rewards. An artifact does not automatically give you a green federation token to spend on research. Which token can you flip to reach research level 5?",
        ["Any artifact pays a level-5 requirement", "Only a green federation token pays it"],
        "Only a green federation token pays it",
        "Check the actual reward: some artifacts provide resources or a special effect, rather than a spendable green federation token."
      ),
    ],
    "Lost Fleet adds several reward systems. Read the selected token’s effect before paying for it; the base federation and research requirements still apply unless a specific effect changes them."
  )
);

function asteroidMoves(state: State): string[] {
  const engine = Engine.fromData(copy(state.turn));
  const command = engine.findAvailableCommand(0, Command.Build);
  return command.data.buildings
    .filter(
      (building) =>
        building.building === Building.Mine && engine.map.getS(building.coordinates).data.planet === Planet.Asteroid
    )
    .map((building) => `${engine.players[0].faction} build m ${building.coordinates}.`);
}

lessons.push(
  lesson(
    "new-planets",
    "lost-fleet",
    "Asteroids and protoplanets",
    "Settle an asteroid, then compare the cost and reward of a protoplanet.",
    () => {
      const engine = expansionPosition("lost-fleet-eclipse-asteroid-mine");
      engine.players[0].data.qics = 1;
      engine.generateAvailableCommands();
      return engine;
    },
    [
      question(
        "asteroid",
        "An asteroid is not a Gaia project",
        "Normally, settling an asteroid consumes one available Gaiaformer permanently. The mine itself costs no ore or credits, though reaching it may still cost Q.I.C. Do you get that Gaiaformer back next round?",
        ["Yes", "No"],
        "No",
        "Asteroid colonisation permanently consumes the Gaiaformer. You keep the mine and its income."
      ),
      {
        id: "settle",
        title: "Settle an asteroid",
        text: "Use the normal mine action on any available asteroid and confirm any range cost. Your pool of available Gaiaformers shrinks by one.",
        hint: "Settle any available asteroid",
        target: "game-controls",
        complete: (state) => state.moves >= 1,
        validateMove(state, action) {
          if (action.kind !== "move") return "Build a mine on any available asteroid using the game controls.";
          const engine = Engine.fromData(copy(state.turn));
          const actual = normalise(engine, action.move);
          if (!asteroidMoves(state).some((move) => normalise(engine, move) === actual))
            return "Choose an available asteroid for your mine. Other planet types do not consume a Gaiaformer this way.";
        },
        solution: (state) => ({ kind: "move", move: asteroidMoves(state)[0] }),
      },
      question(
        "protoplanet",
        "Three terraforming steps, plus the mine",
        "Turquoise protoplanets require 3 terraforming steps for every faction, plus the normal mine cost. At the basic rate of 3 ore per step, that is 9 ore for terraforming, then 1 ore and 2 credits for the mine. Building there earns 6 victory points. How much ore is that in total, without discounts?",
        ["3 ore", "9 ore", "10 ore"],
        "10 ore",
        "9 ore for terraforming + 1 ore for the mine = 10 ore, plus 2 credits. Terraforming research and free steps can reduce the ore cost; extra range may cost Q.I.C. The 6 victory points are immediate, but starting buildings do not earn them."
      ),
    ],
    "Asteroids consume a Gaiaformer and waive the mine’s ore and credit cost. Protoplanets require 3 terraforming steps plus the mine’s cost, and award 6 victory points. Extra range can cost Q.I.C. for either type.",
    3
  )
);
