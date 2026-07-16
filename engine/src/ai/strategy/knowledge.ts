/**
 * Traceable strategy knowledge for offline AI work.
 *
 * This registry is deliberately not an evaluator-weight table. Internet advice is noisy and often
 * contradictory; each normalized principle therefore records how it is allowed to affect the AI.
 */

export const STRATEGY_KNOWLEDGE_SCHEMA = "gaia-ai-strategy-knowledge/v1" as const;

export type StrategySourceKind = "official" | "owner-expert" | "expert-forum" | "community" | "secondary";
export type StrategyConfidence = "owner-confirmed" | "multi-source" | "single-source" | "contested";
export type StrategyApplicationKind =
  | "active-feature"
  | "active-plan"
  | "qualitative-fixture"
  | "context-modifier"
  | "documented-hypothesis"
  | "rejected-universal";

export interface StrategySource {
  id: string;
  title: string;
  url: string | null;
  kind: StrategySourceKind;
}

export interface StrategyApplication {
  kind: StrategyApplicationKind;
  target: string;
}

export interface StrategyPrinciple {
  id: string;
  domain:
    | "setup"
    | "opening"
    | "economy"
    | "tempo"
    | "power"
    | "research"
    | "technology"
    | "federation"
    | "scoring"
    | "lost-fleet"
    | "faction";
  statement: string;
  scope: "general" | "lost-fleet" | "challenge-factions" | "future-factions";
  confidence: StrategyConfidence;
  sourceIds: readonly string[];
  applications: readonly StrategyApplication[];
  contraryEvidence?: string;
}

export const STRATEGY_SOURCES: readonly StrategySource[] = [
  {
    id: "owner-ai7",
    title: "Owner expert labels supplied during AI-7",
    url: null,
    kind: "owner-expert",
  },
  {
    id: "official-lost-fleet",
    title: "Gaia Project: The Lost Fleet official product and rules context",
    url: "https://capstone-games.com/products/gaia-project-the-lost-fleet",
    kind: "official",
  },
  {
    id: "bgg-milan",
    title: "Strategic considerations after the Milan tournament",
    url: "https://boardgamegeek.com/thread/3533221/strategic-considerations-after-the-milan-tournamen",
    kind: "expert-forum",
  },
  {
    id: "bgg-expansion-tips",
    title: "Strategy tips for the game with the expansion",
    url: "https://boardgamegeek.com/thread/3520828/strategy-tips-for-the-game-with-the-expansion",
    kind: "expert-forum",
  },
  {
    id: "bgg-dream-openings",
    title: "Dream openings",
    url: "https://boardgamegeek.com/thread/3533518/dream-openings",
    kind: "expert-forum",
  },
  {
    id: "bgg-advanced-tech",
    title: "Advanced tech tier discussion",
    url: "https://boardgamegeek.com/thread/3410541/advanced-tech-tier-list",
    kind: "expert-forum",
  },
  {
    id: "bgg-ship-access",
    title: "Ship access and colour differences",
    url: "https://boardgamegeek.com/thread/3533630/access-to-ships-colour-difference",
    kind: "expert-forum",
  },
  {
    id: "bgg-new-factions",
    title: "Openings for the new factions",
    url: "https://boardgamegeek.com/thread/3444360/lets-talk-about-openings-for-new-factions",
    kind: "expert-forum",
  },
  {
    id: "bgg-setup-loss",
    title: "Was this game lost at setup?",
    url: "https://boardgamegeek.com/thread/3708930/was-this-game-lost-at-setup",
    kind: "expert-forum",
  },
  {
    id: "bgg-academy",
    title: "Should you always build an Academy at Round 1?",
    url: "https://boardgamegeek.com/thread/2871643/should-you-always-build-an-academy-at-r1",
    kind: "expert-forum",
  },
  {
    id: "bgg-opening",
    title: "Opening discussion",
    url: "https://boardgamegeek.com/thread/3173378/opening",
    kind: "expert-forum",
  },
  {
    id: "bgg-standard-openings",
    title: "Standard openings",
    url: "https://boardgamegeek.com/thread/1974293/standard-openings",
    kind: "expert-forum",
  },
  {
    id: "bgg-economy",
    title: "Getting the economy rolling",
    url: "https://boardgamegeek.com/thread/2764434/i-cant-get-my-economy-rolling",
    kind: "expert-forum",
  },
  {
    id: "bgg-xenos",
    title: "Xenos strategy discussion series",
    url: "https://boardgamegeek.com/thread/2592514/lets-talk-about-xenos-a-strategy-discussion-series",
    kind: "expert-forum",
  },
  {
    id: "bgg-federation-faq",
    title: "Designer-approved Federation FAQ",
    url: "https://boardgamegeek.com/wiki/page/Federation_FAQ",
    kind: "official",
  },
  {
    id: "bgg-pbf-summary",
    title: "Play-by-forum game write-ups and setup-dependent faction discussion",
    url: "https://boardgamegeek.com/thread/1997564/post-pbf-game-write-upsummaries/page/2",
    kind: "expert-forum",
  },
  {
    id: "reddit-general",
    title: "How do you play Gaia Project? community strategy discussion",
    url: "https://www.reddit.com/r/boardgames/comments/uqr157/how_the_do_you_play_gaia_project/",
    kind: "community",
  },
  {
    id: "reddit-starting",
    title: "Help for starting Gaia Project",
    url: "https://www.reddit.com/r/boardgames/comments/shw5bt/help_for_starting_gaia_project/",
    kind: "community",
  },
  {
    id: "reddit-lost-fleet",
    title: "Anyone played the Gaia Project expansion yet?",
    url: "https://www.reddit.com/r/boardgames/comments/1e4jnz2/anyone_played_the_gaia_project_expansion_yet/",
    kind: "community",
  },
  {
    id: "victory-factions",
    title: "Gaia Project factions: overview and strategies",
    url: "https://victoryconditions.com/gaia-project-factions/",
    kind: "secondary",
  },
] as const;

const activePlan = (target: string): StrategyApplication => ({ kind: "active-plan", target });
const activeFeature = (target: string): StrategyApplication => ({ kind: "active-feature", target });
const fixture = (target: string): StrategyApplication => ({ kind: "qualitative-fixture", target });
const context = (target: string): StrategyApplication => ({ kind: "context-modifier", target });
const hypothesis = (target: string): StrategyApplication => ({ kind: "documented-hypothesis", target });
const rejected = (target: string): StrategyApplication => ({ kind: "rejected-universal", target });

/** Deduplicated principles, not verbatim excerpts. */
export const STRATEGY_PRINCIPLES: readonly StrategyPrinciple[] = [
  {
    id: "setup-overlapping-opportunities",
    domain: "setup",
    statement:
      "Starting structures should combine close ship, opponent-colour, Gaia, Asteroid, cheap-terrain, planet-density, and connectivity opportunities.",
    scope: "lost-fleet",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-expansion-tips", "bgg-ship-access", "bgg-setup-loss"],
    applications: [
      activeFeature("setup-placement-opportunity"),
      fixture("dynamic setup ranking; the locked coordinate order is regression evidence only"),
    ],
  },
  {
    id: "setup-complementary-mines",
    domain: "setup",
    statement:
      "The complete starting pair should create complementary expansion corridors, Federation geometry, interaction, and range rather than maximize each Mine independently.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "bgg-setup-loss", "victory-factions"],
    applications: [hypothesis("joint-placement lookahead after the setup-only single-placement prior")],
  },
  {
    id: "setup-faction-fit",
    domain: "setup",
    statement:
      "Faction strength is setup-dependent: map colours, neighbours, boosters, round/final scoring, techs, advanced techs, and contest must be assessed together.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-pbf-summary", "bgg-setup-loss", "victory-factions", "reddit-starting"],
    applications: [context("future faction/setup plan selector; never use a permanent global faction tier")],
  },
  {
    id: "opening-choose-coherent-engine",
    domain: "opening",
    statement:
      "Round 1 should select a coherent engine package—Academy, PI, Lab flexibility, Mine spread, or an early Federation/advanced-tech route—not isolated rewards.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-dream-openings", "bgg-academy", "bgg-opening", "bgg-standard-openings"],
    applications: [activePlan("opening-plan selector and persistent plan report")],
  },
  {
    id: "opening-academy-strong-contextual",
    domain: "opening",
    statement:
      "A Round-1 Academy is a strong engine plan, but PI, Labs, or Mine spread can be superior in the actual setup.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-academy", "bgg-opening", "bgg-dream-openings"],
    applications: [activePlan("academy-engine archetype"), rejected("unconditional Academy bonus")],
  },
  {
    id: "opening-pi-faction-payback",
    domain: "opening",
    statement:
      "An early PI is justified when its faction ability or Federation timing repays the delayed alternative infrastructure.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-opening", "bgg-new-factions", "bgg-xenos", "victory-factions"],
    applications: [activePlan("planetary-institute-engine archetype"), context("faction-specific PI payback")],
  },
  {
    id: "opening-mine-spread",
    domain: "opening",
    statement:
      "Several cheap, connected Mines can be the correct opening when breadth improves income, scoring, access, and future Federations.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-dream-openings", "reddit-general"],
    applications: [activePlan("mine-spread archetype")],
  },
  {
    id: "opening-round-two-readiness",
    domain: "opening",
    statement:
      "Judge an opening by Round-2 income, power, knowledge/tech access, reach, and a feasible next productive action—not Round-1 VP alone.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-economy", "bgg-dream-openings", "reddit-general", "victory-factions"],
    applications: [fixture("opening-plan completion must leave a functioning Round-2 economy")],
  },
  {
    id: "economy-compatible-engines",
    domain: "economy",
    statement:
      "Mines/Trading Stations, Economy research, power cycling, and scientific buildings with income tech are alternative economic engines; choose a compatible mix.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-economy", "reddit-general", "victory-factions"],
    applications: [activeFeature("projected incomes and building-supply income"), context("opening-plan payoff")],
  },
  {
    id: "economy-plan-resource-budget",
    domain: "economy",
    statement:
      "Budget the round's desired actions and reserve the resources needed for the next prerequisite before spending on unrelated actions.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "reddit-general", "bgg-dream-openings"],
    applications: [activePlan("per-plan resource reserve and reserve-violation transition score")],
  },
  {
    id: "economy-spend-productively",
    domain: "economy",
    statement:
      "Spend resources early when doing so creates income, capacity, or scoring; do not empty the wallet through meaningless conversions.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "reddit-general", "bgg-economy"],
    applications: [activePlan("progress and affordability deltas"), rejected("literal resource-depletion rule")],
  },
  {
    id: "economy-avoid-expensive-routine-costs",
    domain: "economy",
    statement:
      "Prefer cheap terrain, Gaia/QIC, terraforming actions, and opponent-adjacent Trading Stations over routine ore-heavy terraforming or isolated six-credit upgrades.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["reddit-general", "owner-ai7", "bgg-economy"],
    applications: [
      activeFeature("setup terrain/opponent access and Trading Station marginal"),
      fixture("costly actions require compensating plan value"),
    ],
    contraryEvidence:
      "Expensive builds remain correct when they unlock a scarce or high-value plan; this is not a legality filter.",
  },
  {
    id: "tempo-pass-only-without-productive-action",
    domain: "tempo",
    statement:
      "Pass only when no meaningful plan-compatible action remains, while preserving useful future resources and bowl-3 power.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-economy"],
    applications: [
      activePlan("plan-aware Pass penalty"),
      activeFeature("non-terminal Pass opportunity cost"),
      rejected("unconditional productive-action Pass guard; values 4 and 8 reduced the final diagnostic score"),
    ],
  },
  {
    id: "tempo-contested-actions",
    domain: "tempo",
    statement:
      "Shared actions, boosters, ships, techs, advanced techs, and Federation tokens gain timing value when an opponent can take them first.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-milan", "bgg-dream-openings", "reddit-general", "victory-factions"],
    applications: [
      activeFeature("shared action availability and booster/pass order"),
      hypothesis("opponent contest probability"),
    ],
  },
  {
    id: "tempo-stall-purposefully",
    domain: "tempo",
    statement:
      "A low-cost stall is valuable only when it improves information, contest timing, or booster order without damaging the engine.",
    scope: "general",
    confidence: "single-source",
    sourceIds: ["bgg-pbf-summary", "reddit-general"],
    applications: [
      hypothesis("future explicit stall/tempo plan term"),
      rejected("rewarding free conversions as stalls"),
    ],
  },
  {
    id: "power-charge-marginal",
    domain: "power",
    statement:
      "Power charging is usually strongest early, but accept it by comparing bowl progress and future uses against its exact VP cost.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["reddit-general", "victory-factions", "bgg-economy"],
    applications: [activeFeature("exact leech-marginal report")],
    contraryEvidence: "Always accepting charge can lose more VP than the resulting power returns, especially late.",
  },
  {
    id: "power-preserve-cycle",
    domain: "power",
    statement:
      "Preserve useful bowl-3 power and charging capacity across income; burn or spend only with a productive destination.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "reddit-general"],
    applications: [
      activeFeature("power-bowl capacity and resource stock"),
      fixture("reserve discipline does not force bowl-3 waste"),
    ],
  },
  {
    id: "research-path-not-step",
    domain: "research",
    statement:
      "Value research as a path to thresholds, income, actions, advanced tech, and endgame position rather than as an isolated step.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "reddit-general", "bgg-advanced-tech", "victory-factions"],
    applications: [
      activeFeature("research races and advanced-tech prerequisites"),
      activePlan("persistent research/Advanced Tech target and four-knowledge reserve"),
    ],
  },
  {
    id: "research-focused-but-adaptive",
    domain: "research",
    statement:
      "Concentrating steps on a few valuable tracks is normally better than shallow spread, but the chosen tracks must follow setup rewards and contest.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["reddit-general", "victory-factions", "bgg-xenos"],
    applications: [
      activePlan("setup-aware research target ranking and material-switch threshold"),
      rejected("fixed track minimums or universal track order"),
    ],
  },
  {
    id: "technology-enables-plan",
    domain: "technology",
    statement:
      "Immediate-resource and income tech tiles are valuable when they complete or sustain a plan; tile value is not separable from its track and timing.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-dream-openings", "reddit-general"],
    applications: [
      activePlan("opening feasibility and research-plan Standard/Advanced Tech progress"),
      rejected("permanent Standard Tech tier"),
    ],
  },
  {
    id: "advanced-tech-remaining-uses",
    domain: "technology",
    statement:
      "Advanced-tech value depends on earliest acquisition, remaining triggers, affordable uses, faction/plan synergy, cover cost, and contest.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "bgg-advanced-tech", "bgg-milan", "victory-factions"],
    applications: [
      activeFeature("advanced-tech prerequisites and cover opportunity cost"),
      activePlan("seeded tile reward/trigger/remaining-use target utility"),
      rejected("permanent Advanced Tech tier"),
    ],
  },
  {
    id: "federation-snowball",
    domain: "federation",
    statement:
      "Early Federations can snowball resources, track tops, and advanced tech, but only if geometry and satellite/power costs leave a functioning economy.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "bgg-milan", "bgg-federation-faq", "victory-factions"],
    applications: [
      activeFeature("federation current option value"),
      activePlan("research-plan Federation-readiness transition"),
      hypothesis("early Federation plan archetype"),
    ],
  },
  {
    id: "federation-efficient-geometry",
    domain: "federation",
    statement:
      "Plan structures and links to form legal Federations with minimal stranded buildings and satellite/power cost while respecting final scoring.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["bgg-federation-faq", "owner-ai7", "victory-factions"],
    applications: [
      activeFeature("federation progress"),
      hypothesis("Phase-3 exact Federation solver; out of AI-7 scope"),
    ],
  },
  {
    id: "scoring-engine-then-convert",
    domain: "scoring",
    statement:
      "Early rounds normally emphasize engine growth; later rounds convert that engine through round scoring, boosters, advanced tech, and endgame goals.",
    scope: "general",
    confidence: "multi-source",
    sourceIds: ["reddit-general", "victory-factions", "bgg-economy"],
    applications: [
      activeFeature("round-tile timing and final-scoring projection"),
      fixture("full-game VP attribution by channel"),
    ],
  },
  {
    id: "scoring-cover-all-channels",
    domain: "scoring",
    statement:
      "Repeated zero Federation, research/endgame, or final-category contribution indicates strategic failure even if immediate VP is nonzero.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "victory-factions", "reddit-general"],
    applications: [fixture("full-game absolute-score and VP-channel report")],
  },
  {
    id: "scoring-final-balance",
    domain: "scoring",
    statement:
      "Do not sacrifice the whole engine to win both final categories, but maintain credible progress and deny runaway margins where efficient.",
    scope: "general",
    confidence: "single-source",
    sourceIds: ["victory-factions", "reddit-general"],
    applications: [activeFeature("exact current final-scoring projection"), context("future opponent contest term")],
  },
  {
    id: "lost-fleet-ship-access-compounds",
    domain: "lost-fleet",
    statement:
      "Early ship access compounds because it adds economic/action options; outer setup positions can therefore gain value.",
    scope: "lost-fleet",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "bgg-expansion-tips", "bgg-ship-access", "official-lost-fleet"],
    applications: [activeFeature("setup ship access and explored-ship value")],
  },
  {
    id: "lost-fleet-ship-context",
    domain: "lost-fleet",
    statement:
      "Ship value must use its actual action, seeded rewards, access cost, expected uses, resource fit, scoring synergy, and contest—not a fixed global rank.",
    scope: "lost-fleet",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-milan", "bgg-expansion-tips"],
    applications: [
      activeFeature("dynamic setup ship reward value and ship action availability"),
      rejected("permanent ship tier"),
    ],
  },
  {
    id: "lost-fleet-two-synergistic-ships",
    domain: "lost-fleet",
    statement:
      "Repeatedly exploiting two synergistic ships is often stronger than shallow access to three, while some boards justify the third.",
    scope: "lost-fleet",
    confidence: "single-source",
    sourceIds: ["bgg-milan"],
    applications: [hypothesis("ship-action engine plan; count expected uses and cross-ship synergy")],
  },
  {
    id: "lost-fleet-asteroid-gaia-value",
    domain: "lost-fleet",
    statement:
      "Asteroids and instant Gaiaforming expand efficient build options and can compound scoring, making Gaia-track steps more useful than in some base setups.",
    scope: "lost-fleet",
    confidence: "multi-source",
    sourceIds: ["owner-ai7", "bgg-milan", "bgg-expansion-tips", "reddit-lost-fleet"],
    applications: [
      activeFeature("setup Asteroid/Gaia access and Gaia pipeline"),
      hypothesis("Gaia/Asteroid expansion plan"),
    ],
  },
  {
    id: "lost-fleet-qic-and-credit-actions",
    domain: "lost-fleet",
    statement:
      "QIC actions now depend on ships and new credit-funded actions increase the value of access and faction-specific credit production.",
    scope: "lost-fleet",
    confidence: "multi-source",
    sourceIds: ["official-lost-fleet", "bgg-expansion-tips", "reddit-lost-fleet"],
    applications: [activeFeature("ship-action availability"), context("Hadsch Hallas and ship-action engine payoff")],
  },
  {
    id: "lost-fleet-track-balance-shift",
    domain: "lost-fleet",
    statement:
      "Lost Fleet may increase knowledge/Gaiaforming value and reduce the universality of Economy/Navigation routes because ships supply new actions and range options.",
    scope: "lost-fleet",
    confidence: "contested",
    sourceIds: ["reddit-lost-fleet", "bgg-milan", "bgg-expansion-tips"],
    applications: [
      hypothesis("measure track value from actual actions and setup; do not apply a flat track buff/nerf"),
    ],
  },
  {
    id: "faction-identity-modifies-plans",
    domain: "faction",
    statement:
      "Faction abilities change plan feasibility and payoff but should not force one scripted opening across setups.",
    scope: "general",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-new-factions", "bgg-pbf-summary", "victory-factions"],
    applications: [context("faction plan modifiers"), rejected("hard-coded faction move sequences")],
  },
  {
    id: "faction-xenos-flexible-ai-federation",
    domain: "faction",
    statement:
      "Xenos can use the extra Mine, cheaper Federations, and QIC/AI access for research, expansion, or early Federation plans; timing decides the route.",
    scope: "challenge-factions",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "bgg-xenos", "victory-factions"],
    applications: [context("Xenos PI, AI-track, Federation, and Mine-spread plan payoffs")],
  },
  {
    id: "faction-hadsch-flexible-credit",
    domain: "faction",
    statement:
      "Hadsch Hallas credit income and PI conversion support flexible plans, resource timing, and Lost Fleet credit actions; PI timing remains contextual.",
    scope: "challenge-factions",
    confidence: "owner-confirmed",
    sourceIds: ["owner-ai7", "victory-factions", "reddit-general"],
    applications: [context("Hadsch Hallas PI and ship/Asteroid plan payoffs")],
    contraryEvidence:
      "Base-game advice often delays the PI, while the owner identifies a Lost Fleet Round-2 Gaia/advanced-tech line; evaluate the actual setup.",
  },
  {
    id: "faction-base-fourteen-context",
    domain: "faction",
    statement:
      "Terrans/Gaiaforming, Lantids/opponent mines, Gleens/Gaia, Taklons/Nevlas/power, Ambas/Ivits/Firaks/Bescods/Federations, Geodens/planet types, Bal T'aks/QIC, and Itars/tech are contextual modifier families.",
    scope: "future-factions",
    confidence: "single-source",
    sourceIds: ["victory-factions", "reddit-starting"],
    applications: [hypothesis("future per-faction plan modifiers after challenge-faction validation")],
  },
  {
    id: "faction-new-four-no-universal-opening",
    domain: "faction",
    statement:
      "The four Lost Fleet factions have unusual starts and costs, so their openings must be derived from actual board, scoring, boosters, and tech rather than copied base-game routes.",
    scope: "future-factions",
    confidence: "multi-source",
    sourceIds: ["official-lost-fleet", "bgg-new-factions", "reddit-lost-fleet"],
    applications: [hypothesis("future Lost Fleet faction plan modifiers; outside fixed AI-7 challenge")],
  },
] as const;

export interface StrategyCoverageReport {
  schemaVersion: typeof STRATEGY_KNOWLEDGE_SCHEMA;
  sourceCount: number;
  principleCount: number;
  byApplication: Record<StrategyApplicationKind, number>;
  byConfidence: Record<StrategyConfidence, number>;
}

export function strategyCoverageReport(): StrategyCoverageReport {
  const byApplication: Record<StrategyApplicationKind, number> = {
    "active-feature": 0,
    "active-plan": 0,
    "qualitative-fixture": 0,
    "context-modifier": 0,
    "documented-hypothesis": 0,
    "rejected-universal": 0,
  };
  const byConfidence: Record<StrategyConfidence, number> = {
    "owner-confirmed": 0,
    "multi-source": 0,
    "single-source": 0,
    contested: 0,
  };
  for (const principle of STRATEGY_PRINCIPLES) {
    byConfidence[principle.confidence] += 1;
    for (const application of principle.applications) {
      byApplication[application.kind] += 1;
    }
  }
  return {
    schemaVersion: STRATEGY_KNOWLEDGE_SCHEMA,
    sourceCount: STRATEGY_SOURCES.length,
    principleCount: STRATEGY_PRINCIPLES.length,
    byApplication,
    byConfidence,
  };
}
