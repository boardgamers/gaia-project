import { Building, Faction, FactionBoard, Operator, Player, Reward } from "@gaia-project/engine";
import { TinkeringTile } from "@gaia-project/engine/src/enums";
import { explorationCost } from "@gaia-project/engine/src/exploration";
import { tinkeringTilesForRound, tinkeringTileSpec } from "@gaia-project/engine/src/factions";

/**
 * Supplemental faction-overview data for the pick/ban window (`FactionInfoCard.vue`). Everything
 * here surfaces something the reused in-game faction board can't show on its own: costs and
 * building-granted actions that only exist once a building is placed, plus per-faction notes.
 */

// Factions native to the Lost Fleet expansion. They have no "changed by the expansion" delta (they
// only exist under it), so they get no "Lost Fleet changes" section - unlike the base factions.
export const EXPANSION_FACTIONS: Faction[] = [
  Faction.Tinkeroids,
  Faction.Darkanians,
  Faction.Moweyds,
  Faction.SpaceGiants,
];

export function isExpansionFaction(faction: Faction): boolean {
  return EXPANSION_FACTIONS.includes(faction);
}

// The flat Explore deploy cost (5 VP for most, 7 VP for Bal T'aks, plus the Nevlas/Itars token) -
// NOT the range Q.I.C., which depends on board position and so isn't meaningful before the game.
export function exploreDeployCost(player: Player): Reward[] {
  return explorationCost(player);
}

// The extra cost to build a mine on a Gaia planet: 1 Q.I.C. normally, 1 ore for Gleens, and a
// 2-Q.I.C. surcharge for Darkanians and Space Giants.
export function gaiaMineExtraCost(player: Player): Reward {
  return player.gaiaFormingCost();
}

export type BuildingSpecialAction = { building: Building; income: string };

// Once-per-round special actions a building grants once it is built (Operator.Activate). These are
// invisible on an empty faction board, so we surface them here: Academy II's `q` for most factions,
// Bal T'aks' Academy II `4c`, and Ivits' Planetary Institute space-station action.
export function buildingSpecialActions(board: FactionBoard): BuildingSpecialAction[] {
  const result: BuildingSpecialAction[] = [];
  const buildings = [
    Building.PlanetaryInstitute,
    Building.Academy1,
    Building.Academy2,
    Building.TradingStation,
    Building.ResearchLab,
    Building.Mine,
  ];
  for (const building of buildings) {
    const seen = new Set<string>();
    for (const level of board.buildings[building].income) {
      for (const ev of level) {
        if (ev.operator === Operator.Activate) {
          const income = ev.rewards.toString();
          if (!seen.has(income)) {
            seen.add(income);
            result.push({ building, income });
          }
        }
      }
    }
  }
  return result;
}

// Space Giants: the Planetary Institute grants an immediate tech tile of choice (a `tech` gain in
// the PI's own income). Normal factions' PIs grant none - the on-upgrade tech tile of labs and
// academies is a separate, expected mechanic and is not surfaced here.
export function piGrantsTechTile(board: FactionBoard): boolean {
  return board.buildings[Building.PlanetaryInstitute].income.some((level) =>
    level.some((ev) => ev.operator === Operator.Once && ev.rewards.toString() === "tech")
  );
}

export type TinkeringRound = { label: string; rewards: Reward[][] };

// Tinkeroids only: the per-round Tinkering tile options, in real reward iconography. Rounds 1-3 and
// 4-6 each offer a different set of three tiles (one used per round).
export function tinkeringRounds(): TinkeringRound[] {
  const toRewards = (tiles: TinkeringTile[]) => tiles.map((tile) => Reward.parse(tinkeringTileSpec(tile)));
  return [
    { label: "Rounds 1-3", rewards: toRewards(tinkeringTilesForRound(1)) },
    { label: "Rounds 4-6", rewards: toRewards(tinkeringTilesForRound(4)) },
  ];
}

// Pieces already on the board (or off it) at game start that the empty preview board can't depict -
// surfaced as a short text note per the owner's request.
export function startingBuildingNote(faction: Faction): string | null {
  switch (faction) {
    case Faction.Tinkeroids:
      return "Starts with the Planetary Institute already built, instead of two mines.";
    case Faction.Moweyds:
      return "Starts with one mine and an Exploration Shuttle already deployed on T F Mars.";
    case Faction.Darkanians:
    case Faction.SpaceGiants:
      return "Starts with one mine, instead of two.";
    case Faction.Ivits:
      return "Places no starting mines - places the Planetary Institute on any red planet after everyone else.";
    case Faction.Xenos:
      return "Places a third starting mine after all other factions have placed theirs.";
    default:
      return null;
  }
}

// Only base-game factions genuinely changed by Lost Fleet get a "changes" section. Per the §I audit
// in RULES_CLARIFICATIONS.md, the "LF special ability" column is non-None for exactly Xenos and
// Gleens among the base factions; every other base faction (Ivits included) is unchanged.
export function baseFactionLostFleetChanges(faction: Faction): string[] {
  switch (faction) {
    case Faction.Xenos:
      return ["Adds a free action: spend 1 ore to gain 1 power directly into Area III."];
    case Faction.Gleens:
      return ["Adds a once-per-round special action granting +2 range (also applies to Explore)."];
    default:
      return [];
  }
}
