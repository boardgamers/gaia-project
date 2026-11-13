import { automaDifficulties } from "./automa";
import Engine from "./engine";
import { Building, Expansion, Faction, Phase, Planet, ResearchField, Round } from "./enums";

// Structural BGS protocol types: optional named exports need no runtime protocol dependency.
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
}

export interface AchievementManifest {
  revision: number;
  achievements: AchievementDefinition[];
}

export interface SeatAchievements {
  seat: number;
  earned: string[];
  outcome?: "win" | "loss" | "draw";
}

const standardBuildings = [
  Building.Mine,
  Building.TradingStation,
  Building.ResearchLab,
  Building.PlanetaryInstitute,
  Building.Academy1,
  Building.Academy2,
];

const baseColonyTypes = [
  Planet.Terra,
  Planet.Desert,
  Planet.Swamp,
  Planet.Oxide,
  Planet.Volcanic,
  Planet.Titanium,
  Planet.Ice,
  Planet.Gaia,
  Planet.Lost,
];

function displayName(id: string): string {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** The complete catalog, independent of the current game's mode or faction selection. */
export function achievementDefinitions(): AchievementManifest {
  const definitions: AchievementDefinition[] = Faction.values(Expansion.All).map((faction) => ({
    id: `win-faction-${faction}`,
    name: `${displayName(faction)} Victory`,
    description: `Win as ${displayName(faction)}. Shared first place counts; either ruleset qualifies.`,
  }));
  for (const mode of ["base", "lost-fleet"]) {
    const name = mode === "base" ? "Base Game" : "Lost Fleet";
    definitions.push({
      id: `win-mode-${mode}`,
      name: `${name} Victory`,
      description: `Win a ${name} game, including shared first place.`,
    });
    for (const threshold of [150, 200]) {
      definitions.push({
        id: `score-${mode}-${threshold}`,
        name: `${name}: ${threshold} Points`,
        description: `Finish a ${name} game with at least ${threshold} final victory points, after auction deductions. No win required.`,
      });
    }
  }
  for (const difficulty of automaDifficulties) {
    definitions.push({
      id: `win-automa-${difficulty}`,
      name: `Defeat ${displayName(difficulty)}`,
      description: `Win against Automa at exactly ${difficulty} difficulty. A tied score counts as a human win.`,
    });
  }
  definitions.push(
    {
      id: "build-all-standard",
      name: "Full Deployment",
      description:
        "Finish with all 18 standard building pieces simultaneously deployed: 8 mines, 4 trading stations, 3 research labs, the institute and both academies. Excludes Lost Planet, artifacts, Gaiaformers and space stations. No win required.",
    },
    {
      id: "federation-form-3",
      name: "Federation Builder",
      description:
        "Complete at least three federation formations in one game (extensions of the growing federation for Ivits). Token rewards and rescores do not count. No win required.",
    },
    {
      id: "explore-all-types-base",
      name: "Every World: Base Game",
      description:
        "Finish a base game with main-owned colonies on all seven ordinary planet types, Gaia and the Lost Planet. Gaiaformers and Lantids shared mines do not count. No win required.",
    },
    {
      id: "explore-all-types-lost-fleet",
      name: "Every World: Lost Fleet",
      description:
        "Finish a Lost Fleet game with main-owned colonies on all seven ordinary types, Gaia, Lost Planet, Asteroid and Protoplanet. Artifacts, Gaiaformers and Lantids shared mines do not count. No win required.",
    },
    {
      id: "faction-ivits-growing-federation",
      name: "Growing Federation",
      description: "As Ivits, complete three federation formation milestones in one game. No win required.",
    },
    {
      id: "faction-lantids-shared-civilization",
      name: "Shared Civilization",
      description: "As Lantids, finish with at least six additional mines on opponents' colonies. No win required.",
    },
    {
      id: "faction-bescods-balanced-research",
      name: "Balanced Research",
      description: "As Bescods, finish at level 3 or higher on all six research tracks. No win required.",
    }
  );
  return { revision: 1, achievements: definitions };
}

/** Evaluate authoritative completed state only; never advance play or recompute final scoring. */
export function achievements(data: Engine | Record<string, any>): SeatAchievements[] {
  // The EndGame log marker is emitted by finalScoringPhase, unlike early termination.
  if (
    data.phase !== Phase.EndGame ||
    data.round !== Round.LastRound ||
    !data.advancedLog?.some((entry) => entry.phase === Phase.EndGame)
  ) {
    return [];
  }
  // Hydration normalizes legacy options and federation caches in place. Never change the
  // caller's authoritative serialized state just to evaluate an optional reporting hook.
  const engine = data instanceof Engine ? data : Engine.fromData(JSON.parse(JSON.stringify(data)));
  const humans = engine.players.filter((player) => !player.isAutoma);
  const bestScore = Math.max(...engine.players.map((player) => player.data.victoryPoints));
  const mode = engine.options.lostFleet ? "lost-fleet" : "base";
  const requiredTypes = engine.options.lostFleet
    ? [...baseColonyTypes, Planet.Protoplanet, Planet.Asteroid]
    : baseColonyTypes;

  return humans.map((player, seat) => {
    // Preserve wrapper human-seat indexing even when a participant dropped.
    if (player.dropped) return { seat, earned: [] };
    const earned: string[] = [];
    const won = player.data.victoryPoints >= bestScore;
    if (won) {
      earned.push(`win-faction-${player.faction}`, `win-mode-${mode}`);
      if (engine.automa) earned.push(`win-automa-${engine.automa.difficulty}`);
    }
    for (const threshold of [150, 200]) {
      if (player.data.victoryPoints >= threshold) earned.push(`score-${mode}-${threshold}`);
    }
    if (standardBuildings.every((building) => player.data.buildings[building] === player.maxBuildings(building))) {
      earned.push("build-all-standard");
    }
    if (player.data.federationCount >= 3) {
      earned.push("federation-form-3");
      if (player.faction === Faction.Ivits) earned.push("faction-ivits-growing-federation");
    }
    // Unlike Condition.PlanetType, ownedPlanets excludes virtual artifact types and shared mines.
    const physicalTypes = new Set(player.ownedPlanets.map((hex) => hex.data.planet));
    if (requiredTypes.every((type) => physicalTypes.has(type))) earned.push(`explore-all-types-${mode}`);
    if (
      player.faction === Faction.Lantids &&
      [...engine.map.grid.values()].filter((hex) => hex.data.additionalMine === player.player).length >= 6
    ) {
      earned.push("faction-lantids-shared-civilization");
    }
    if (
      player.faction === Faction.Bescods &&
      ResearchField.values(engine.expansions).every((field) => player.data.research[field] >= 3)
    ) {
      earned.push("faction-bescods-balanced-research");
    }
    return { seat, earned, outcome: won ? "win" : "loss" };
  });
}
