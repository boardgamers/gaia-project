import { Building, Command, Faction, factionPlanet, Planet, planetNames, Resource, Reward } from "@gaia-project/engine";
import { orderBy } from "lodash";
import { factionName } from "../../data/factions";
import { deltaCounter } from "../utils";
import { terranChargeExtractLog } from "./charge";
import { ChartSource } from "./charts";
import { federationDiscount, GetFederationBonusArg } from "./federations";
import { nevlasPowerLeverage, taklonsPowerLeverage } from "./power-leverage";
import { commandCounter, ExtractLog, planetCounter, SimpleSourceFactory } from "./simple-charts";
import { TerraformingSteps } from "./terraforming";

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

type FactionSpecialEntry = {
  faction: Faction;
  description?: string;
  extractLog?: ExtractLog<any>;
};

type FactionSpecialEntries = {
  label: string;
  entries: FactionSpecialEntry[];
};

type FactionSpecial = XOR<FactionSpecialEntries, FactionSpecialEntry & { label: string }>;

function spentResources(resource: Resource) {
  return ExtractLog.filterPlayer((a) =>
    a.cmd?.command == Command.Spend && a.cmd.args[0].endsWith(resource) ? Reward.parse(a.cmd.args[0])[0].count : 0
  );
}

function ambasFederationBonus(a: GetFederationBonusArg) {
  const piMoved =
    a.counter.hasPlanetaryInstitute &&
    a.counter.planetaryInstituteLocation != a.counter.initialPlanetaryInstituteLocation;
  return piMoved
    ? a.player.buildingValue(null, {
        building: Building.PlanetaryInstitute,
        hasPlanetaryInstitute: a.counter.hasSpecialOperator,
      }) - 1
    : 0;
}

const specials: FactionSpecial[] = [
  {
    label: "Federation Discount",
    entries: [
      {
        faction: Faction.Ambas,
        description: "Power value saved for forming federations after the PI has been swapped",
        extractLog: federationDiscount(ambasFederationBonus),
      },
      {
        faction: Faction.Bescods,
        description: "Power value saved for forming federations with PI built and using titanium planets",
        extractLog: federationDiscount((a) =>
          a.counter.hasPlanetaryInstitute ? a.hexes.filter((h) => h.data.planet == Planet.Titanium).length : 0
        ),
      },
      {
        faction: Faction.Ivits,
        description: "Power value saved for forming federations due to space stations",
        extractLog: ExtractLog.wrapper((p) => {
          const counter = deltaCounter(0);
          return federationDiscount(
            (a) => a.spaceStations,
            (value) => counter(value)
          );
        }),
      },
      {
        faction: Faction.Xenos,
        description: "Power value saved for forming federations with PI built",
        extractLog: federationDiscount((a) => 7 - a.cost),
      },
    ],
  },
  {
    label: "Special Knowledge",
    entries: [
      {
        faction: Faction.Bescods,
        description: "Knowledge for researching the lowest technology",
        extractLog: commandCounter(Command.Special, Resource.UpgradeLowest, () => 4),
      },
      {
        faction: Faction.Firaks,
        description: "Knowledge for lab downgrades",
        extractLog: commandCounter(Command.Special, Resource.DowngradeLab, () => 4),
      },
      {
        faction: Faction.Geodens,
        description: "Knowledge from Guest Mines",
        extractLog: ExtractLog.filterPlayerChanges((a) => a.log.changes?.geodens?.k ?? 0),
      },
      {
        faction: Faction.Lantids,
        description: "Knowledge from building a mine on a new planet type",
        extractLog: ExtractLog.filterPlayerChanges((a) => {
          const changes = a.log.changes as any;
          //old games have null for lantids special knowledge
          return changes?.lantids?.k ?? changes?.undefined?.k ?? 0;
        }),
      },
      {
        faction: Faction.Nevlas,
        description: "Knowledge for moving a token to the gaia area",
        extractLog: spentResources(Resource.TokenArea3),
      },
    ],
  },
  {
    faction: Faction.BalTaks,
    label: "QIC from Gaia Formers",
    extractLog: spentResources(Resource.GaiaFormer),
  },
  {
    faction: Faction.Gleens,
    label: TerraformingSteps.Gaia,
    description: "Gaia planets settled with ore instead of QICs",
    extractLog: planetCounter(
      () => false,
      () => true,
      (p) => p == Planet.Gaia
    ),
  },
  {
    faction: Faction.Gleens,
    label: "Special VPs",
    description: "Knowledge from building mines on gaia planets",
    extractLog: ExtractLog.filterPlayerChanges((a) => a.log.changes?.gleens?.vp ?? 0),
  },
  {
    faction: Faction.HadschHallas,
    label: "PI Resources",
    description: "Credits spent for resources in the PI",
    extractLog: spentResources(Resource.Credit),
  },
  {
    faction: Faction.Itars,
    label: "Tech Tiles",
    description: "Tech tiles taken in gaia phase",
    extractLog: ExtractLog.filterPlayer((a) => (a.cmd.args[0] == "4tg" ? 1 : 0)),
  },
  {
    faction: Faction.Nevlas,
    label: "Powerful Power Tokens",
    description: "How often power tokens was spend for 2 power (with PI)",
    extractLog: nevlasPowerLeverage(),
  },
  {
    faction: Faction.Taklons,
    label: "Brainstone",
    description: "How often the brainstone was used to pay 3 power",
    extractLog: taklonsPowerLeverage(1),
  },
  {
    faction: Faction.Taklons,
    label: "Tokens from PI",
    description: "Power tokens gained from charging when the PI is built",
    extractLog: ExtractLog.filterPlayerChanges((a) => a.log.changes?.charge?.t ?? 0),
  },
  {
    faction: Faction.Terrans,
    label: "Resources from PI",
    description: "Power value of resources gained from PI",
    extractLog: spentResources(Resource.GainTokenGaiaArea),
  },
  {
    faction: Faction.Terrans,
    label: "Tokens moved to Area 2",
    description: "Tokens moved to area 2 after gaia forming",
    extractLog: terranChargeExtractLog(null).extractLog,
  },
];

function toEntries(s: FactionSpecial, factions: Faction[]): FactionSpecialEntries[] {
  const res =
    "entries" in s
      ? (Object.assign({}, s) as FactionSpecialEntries)
      : {
          label: s.label,
          entries: [s],
        };

  res.entries = res.entries.filter((e) => factions.includes(e.faction));

  return res.entries.length == 0 ? [] : [res];
}

export const factionSourceFactory = (factions: Faction[]): SimpleSourceFactory<ChartSource<any>> => {
  const entries: FactionSpecialEntries[] = specials.flatMap((s) => toEntries(s, factions));

  return {
    name: "Faction Specials",
    playerSummaryLineChartTitle: "Special abilities of all factions",
    showWeightedTotal: false,
    extractLog: ExtractLog.mux(
      entries.flatMap((s) =>
        s.entries.map((e) => ({
          factionFilter: [e.faction],
          sourceTypeFilter: [s.label],
          extractLog: e.extractLog,
        }))
      )
    ),
    sources: orderBy(
      entries.map((s) => ({
        type: s.label,
        label: `${s.entries.map((e) => factionName(e.faction)).join(", ")}: ${s.label}`,
        description: s.entries.map((e) => `${factionName(e.faction)}: ${e.description}`).join(", "),
        color: `--${planetNames[factionPlanet(s.entries[0].faction)]}`,
        weight: 1,
      })),
      "label"
    ),
  };
};
