import { Building, Faction, FactionBoard, Operator, Player, Resource, Reward } from "@gaia-project/engine";
import { freeActionsHadschHallas, freeActionsTerrans } from "@gaia-project/engine/src/actions";
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

// The cost to build a mine on a Gaia planet: 1 Q.I.C. by default, so only worth surfacing when a
// faction pays a genuine surcharge (Darkanians and Space Giants pay 2 Q.I.C.). Gleens' 1-ore
// substitution is a lateral change covered by their faction ability, not an extra cost.
export function gaiaMineExtraCost(player: Player): Reward {
  return player.gaiaFormingCost();
}

export function hasGaiaMineSurcharge(player: Player): boolean {
  const cost = player.gaiaFormingCost();
  return cost.type === Resource.Qic && cost.count > 1;
}

// Short board labels, matching common table/forum shorthand (notably AC1/AC2 for the two academies).
const BUILDING_SHORT_LABELS: { [building in Building]?: string } = {
  [Building.Mine]: "M",
  [Building.TradingStation]: "TS",
  [Building.ResearchLab]: "RL",
  [Building.Academy1]: "AC1",
  [Building.Academy2]: "AC2",
  [Building.PlanetaryInstitute]: "PI",
};

export function buildingShortLabel(building: Building): string {
  return BUILDING_SHORT_LABELS[building] ?? "";
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

// The flat default Explore deploy cost (5 VP). Factions differing from this get the default called
// out for reference.
export const DEFAULT_EXPLORE_COST: Reward[] = [new Reward(5, Resource.VictoryPoint)];

export function exploreCostIsDefault(player: Player): boolean {
  const cost = exploreDeployCost(player);
  return (
    cost.length === DEFAULT_EXPLORE_COST.length &&
    cost.every((r, i) => r.type === DEFAULT_EXPLORE_COST[i].type && r.count === DEFAULT_EXPLORE_COST[i].count)
  );
}

// Faction-specific side effects of deploying an Exploration Shuttle, beyond paying the cost.
export function exploreNote(faction: Faction): string | null {
  if (faction === Faction.Taklons) {
    // exploration.ts deployExplorationShuttle(): a Taklon moves the Brainstone to the Gaia area when
    // exploring (and canPayExplorationCost forbids exploring while it is already there).
    return "Deploying an Exploration Shuttle also moves your Brainstone into the Gaia area (so you cannot Explore while it is already there).";
  }
  return null;
}

// The default cost to build a mine on a Gaia planet (1 Q.I.C.), for the reference note next to a
// surcharged faction.
export const DEFAULT_GAIA_MINE_COST: Reward = new Reward(1, Resource.Qic);

export type TinkeringRound = { label: string; tiles: string[] };

// Tinkeroids only: the per-round Tinkering tile options as reward specs (rendered as special-action
// octagons, since each is a once-per-round action). Rounds 1-3 and 4-6 each offer three tiles.
export function tinkeringRounds(): TinkeringRound[] {
  const specs = (tiles: TinkeringTile[]) => tiles.map((tile) => tinkeringTileSpec(tile));
  return [
    { label: "Rounds 1-3", tiles: specs(tinkeringTilesForRound(1)) },
    { label: "Rounds 4-6", tiles: specs(tinkeringTilesForRound(4)) },
  ];
}

// Factions whose per-planet terraforming costs are not fixed by the faction alone: three planet
// colours cost 3 steps and the rest 1, but *which* three is drawn from the Lost Fleet Terraforming
// board during setup (depends on the final set of factions). The board's terraform markers are only
// a snapshot of the current selection.
export function terraformCostDependsOnFactions(faction: Faction): boolean {
  return faction === Faction.Tinkeroids || faction === Faction.Moweyds;
}

// Pieces already on the board (or off it) at game start that the empty preview board can't depict,
// plus the setup phase in which a faction's single starting piece is placed. Starting buildings are
// placed in three stages: (1) the base-game factions in snake order (with the Xenos' third mine at
// the end), then (2) the four expansion factions place their single piece, and finally (3) Ivits
// places its Planetary Institute last of all.
export function startingBuildingNote(faction: Faction): string | null {
  const expansionStage =
    "in the expansion-faction setup stage - after the base-game factions' mine setup, but before " +
    "Ivits places its Planetary Institute";
  switch (faction) {
    case Faction.Tinkeroids:
      return `Starts with the Planetary Institute already built (instead of two mines), placed ${expansionStage}.`;
    case Faction.Moweyds:
      return (
        "Starts with one mine (instead of two) and an Exploration Shuttle already on T F Mars. The " +
        `mine is placed ${expansionStage}.`
      );
    case Faction.Darkanians:
    case Faction.SpaceGiants:
      return `Places only one starting mine (instead of two), ${expansionStage}.`;
    case Faction.Ivits:
      return (
        "Places no starting mines - places the Planetary Institute on any red planet last of all, " +
        "after every other faction (including the expansion factions and the Xenos' third mine)."
      );
    case Faction.Xenos:
      return "Places a third starting mine after all other base-game factions have placed their two.";
    default:
      return null;
  }
}

export type Conversion = { cost: string; income: string };

// Conversions that a faction's Planetary Institute unlocks, in the same cost -> income form the
// in-game free-action buttons use. Terrans convert Gaia-area power tokens (during the Gaia phase);
// Hadsch Hallas may spend credits in place of power for the resource free actions.
export function piConversions(faction: Faction): Conversion[] {
  const table =
    faction === Faction.Terrans
      ? freeActionsTerrans
      : faction === Faction.HadschHallas
      ? freeActionsHadschHallas
      : null;
  return table ? Object.values(table).map((c) => ({ cost: c!.cost, income: c!.income })) : [];
}

// A board special action worth spelling out in text (its octagon is on the board but not labelled).
export function boardActionNote(faction: Faction): string | null {
  if (faction === Faction.SpaceGiants) {
    // space-giants.ts income "=> 2step": Build a Mine with 2 free terraforming steps.
    return "Special action (once per round): Build a Mine with 2 free terraforming steps - you still pay ore for any step beyond those two.";
  }
  return null;
}

// The board special-action reward spec to render as an octagon next to boardActionNote.
export function boardActionSpec(faction: Faction): string | null {
  return faction === Faction.SpaceGiants ? "2step" : null;
}

// Base-game factions changed by Lost Fleet get a "changes" section. Two are new special abilities
// the §I audit flagged (Xenos, Gleens); the rest are owner-confirmed starting-stat changes. The
// Lantids power-token income is implemented via lantids.ts lostFleetIncome; Bescods' knowledge and
// Ivits' bowls are display-only here (the engine already encodes the Lost Fleet values).
export function baseFactionLostFleetChanges(faction: Faction): string[] {
  switch (faction) {
    case Faction.Xenos:
      return ["Adds a free action: spend 1 ore to gain 1 power directly into Area III."];
    case Faction.Gleens:
      return ["Adds a once-per-round special action granting +2 range (also applies to Explore)."];
    case Faction.Lantids:
      return ["Gains 1 power token in Area I (bowl 1) as basic income each round, from the start."];
    case Faction.Ivits:
      return ["Starting power tokens reduced from 2 / 4 / 0 to 2 / 2 / 0 across the bowls."];
    case Faction.Bescods:
      return ["Starts with 3 knowledge instead of 1."];
    default:
      return [];
  }
}
