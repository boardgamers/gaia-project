import { difference } from "lodash";
import shuffleSeed from "shuffle-seed";
import { Expansion, Faction, Planet, Player as PlayerEnum, TinkeringTile } from "./enums";

type TerraformingCost3Player = { player: PlayerEnum; faction: Faction };

const lostFleetTerraformingBoardPlanets = [
  Planet.Terra,
  Planet.Oxide,
  Planet.Volcanic,
  Planet.Desert,
  Planet.Swamp,
  Planet.Titanium,
  Planet.Ice,
] as const;

const factions: { [key in Faction]: { planet: Planet } } = {
  [Faction.Terrans]: {
    planet: Planet.Terra,
  },
  [Faction.Lantids]: {
    planet: Planet.Terra,
  },
  [Faction.Xenos]: {
    planet: Planet.Desert,
  },
  [Faction.Gleens]: {
    planet: Planet.Desert,
  },
  [Faction.Taklons]: {
    planet: Planet.Swamp,
  },
  [Faction.Ambas]: {
    planet: Planet.Swamp,
  },
  [Faction.HadschHallas]: {
    planet: Planet.Oxide,
  },
  [Faction.Ivits]: {
    planet: Planet.Oxide,
  },
  [Faction.Geodens]: {
    planet: Planet.Volcanic,
  },
  [Faction.BalTaks]: {
    planet: Planet.Volcanic,
  },
  [Faction.Firaks]: {
    planet: Planet.Titanium,
  },
  [Faction.Bescods]: {
    planet: Planet.Titanium,
  },
  [Faction.Nevlas]: {
    planet: Planet.Ice,
  },
  [Faction.Itars]: {
    planet: Planet.Ice,
  },
  [Faction.Tinkeroids]: {
    planet: Planet.Asteroid,
  },
  // No home terrain planet (Lost Fleet) - `planet` here only drives the same-color
  // oppositeFaction() exclusivity below, not terraforming (see terraformingStepsRequired()
  // in planets.ts, which special-cases these factions instead of reading factionPlanet()).
  [Faction.Darkanians]: {
    planet: Planet.Asteroid,
  },
  [Faction.Moweyds]: {
    planet: Planet.Protoplanet,
  },
  [Faction.SpaceGiants]: {
    planet: Planet.Protoplanet,
  },
} as const;

export function isTerraformingBoardFaction(faction: Faction): boolean {
  return faction === Faction.Tinkeroids || faction === Faction.Moweyds;
}

export function isBaseGameFaction(faction: Faction): boolean {
  return ![Faction.Tinkeroids, Faction.Darkanians, Faction.Moweyds, Faction.SpaceGiants].includes(faction);
}

export function lostFleetTerraformingBoard(seed: string): Planet[] {
  return shuffleSeed.shuffle([...lostFleetTerraformingBoardPlanets], `${seed}-lost-fleet-terraforming-board`);
}

export function lostFleetTerraformingCost3Planets(
  players: TerraformingCost3Player[],
  turnOrder: PlayerEnum[],
  board: Planet[]
): Partial<Record<PlayerEnum, Planet[]>> {
  const specialPlayers = turnOrder
    .map((player) => players.find((pl) => pl.player === player))
    .filter((pl): pl is TerraformingCost3Player => !!pl && isTerraformingBoardFaction(pl.faction));

  if (specialPlayers.length === 0) {
    return {};
  }

  const counts = board.map(() => 1);
  const baseGamePlanets = players.filter((pl) => isBaseGameFaction(pl.faction)).map((pl) => factionPlanet(pl.faction));

  if (specialPlayers.length === 2) {
    for (const planet of baseGamePlanets) {
      const idx = board.findIndex((entry) => entry === planet);
      if (idx !== -1) {
        counts[idx] += 1;
      }
    }
  }

  const ret: Partial<Record<PlayerEnum, Planet[]>> = {};

  for (const player of specialPlayers) {
    ret[player.player] = [...baseGamePlanets];
  }

  for (const planet of baseGamePlanets) {
    let remainingMandatory = specialPlayers.length;

    while (remainingMandatory > 0) {
      const idx = board.findIndex((entry, index) => entry === planet && counts[index] > 0);
      if (idx === -1) {
        break;
      }
      counts[idx] -= 1;
      remainingMandatory -= 1;
    }
  }

  for (const player of specialPlayers) {
    const selected = ret[player.player];

    while (selected.length < 3) {
      const idx = counts.findIndex((count) => count > 0);
      if (idx === -1) {
        break;
      }
      selected.push(board[idx]);
      counts[idx] -= 1;
    }
  }

  return ret;
}

export function tinkeringTilesForRound(round: number): TinkeringTile[] {
  if (round <= 3) {
    return [TinkeringTile.Step1, TinkeringTile.Power4, TinkeringTile.Qic1];
  }
  return [TinkeringTile.Step3, TinkeringTile.Knowledge3, TinkeringTile.Qic2];
}

export function tinkeringTileSpec(tile: TinkeringTile): string {
  switch (tile) {
    case TinkeringTile.Step1:
      return "step";
    case TinkeringTile.Power4:
      return "4pw";
    case TinkeringTile.Qic1:
      return "q";
    case TinkeringTile.Step3:
      return "3step";
    case TinkeringTile.Knowledge3:
      return "3k";
    case TinkeringTile.Qic2:
      return "2q";
  }
}

function oppositeFaction(faction: Faction): Faction {
  const allFactions = Faction.values(Expansion.All);

  if (!allFactions.includes(faction)) {
    return null;
  }

  for (const fct of allFactions) {
    if (fct !== faction && factions[fct].planet === factions[faction].planet) {
      return fct;
    }
  }
}

export function remainingFactions(chosenFactions: Faction[], expansions: Expansion) {
  return difference(
    Faction.values(expansions),
    chosenFactions.map((f) => f),
    chosenFactions.map((f) => oppositeFaction(f))
  );
}

export function factionPlanet(faction: Faction): Planet {
  const fact = factions[faction];

  if (fact) {
    return fact.planet;
  }
  return Planet.Lost;
}

export function startingSetupPlacements(faction: Faction): number {
  switch (faction) {
    case Faction.Ivits:
    case Faction.Tinkeroids:
    case Faction.Darkanians:
    case Faction.Moweyds:
    case Faction.SpaceGiants:
      return 1;
    case Faction.Xenos:
      return 3;
    default:
      return 2;
  }
}

export function lostFleetSetupStage(faction: Faction): 1 | 2 | 3 {
  switch (faction) {
    case Faction.Tinkeroids:
    case Faction.Darkanians:
    case Faction.Moweyds:
    case Faction.SpaceGiants:
      return 2;
    case Faction.Ivits:
      return 3;
    default:
      return 1;
  }
}
