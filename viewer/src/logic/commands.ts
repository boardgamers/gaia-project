import Engine, {
  applyChargePowers,
  AvailableBuilding,
  AvailableCommand,
  AvailableHex,
  AvailableResearchTrack,
  Booster,
  BrainstoneArea,
  Building,
  Command,
  Event,
  Expansion,
  Faction,
  freeActionConversions,
  GaiaHex,
  HighlightHex,
  Operator,
  Player,
  researchTracks,
  Resource,
  Reward,
  Round,
  tiles,
} from "@gaia-project/engine";
import AvailableCommand, {
  AvailableBoardActionData,
  AvailableBuilding,
  AvailableFreeActionData,
  AvailableHex,
} from "@gaia-project/engine";
import { max, range, sortBy } from "lodash";
import { ButtonData, ButtonWarning, HighlightHexData } from "../data";
import { boardActionNames, freeActionShortcuts } from "../data/actions";
import { boosterNames } from "../data/boosters";
import { buildingName, buildingShortcut } from "../data/building";
import { eventDesc } from "../data/event";
import { resourceNames } from "../data/resources";

export const forceNumericShortcut = (label: string) => ["Charge", "Income"].find((b) => label.startsWith(b));

export function withShortcut(label: string, shortcut: string, skip: string) {
  const found = label.indexOf(skip);
  const skipIndex = found < 0 ? 0 : found + skip.length;

  const i = label.toLowerCase().indexOf(shortcut, skipIndex);

  if (i >= 0 && !forceNumericShortcut(label)) {
    return `${label.substring(0, i)}<u>${label.substring(i, i + 1)}</u>${label.substring(i + 1)}`;
  } else {
    return `<u>${shortcut}</u>: ${label}`;
  }
}

export function hexMap(engine: Engine, coordinates: AvailableHex[]): HighlightHexData {
  return new Map<GaiaHex, HighlightHex>(
    coordinates.map((coord) => [
      engine.map.getS(coord.coordinates),
      {
        cost: coord.cost,
        warnings: coord.warnings,
      },
    ])
  );
}

export function buttonWarning(message?: string): ButtonWarning | null {
  return message && { title: "Are you sure?", body: [message] };
}

export function endTurnWarning(engine: Engine, command: AvailableCommand): ButtonWarning | null {
  const warning = (msg: string) =>
    ({
      title: "Are you sure you want to end the turn?",
      body: [msg],
    } as ButtonWarning);

  const p = engine.players[command.player];
  if (p.faction == Faction.Taklons && !engine.isLastRound) {
    const brainstoneArea = p.data.brainstone;
    switch (brainstoneArea) {
      case BrainstoneArea.Area2:
        if (p.data.burnablePower() > 0) {
          return warning("Brainstone in area 2 not moved to area 3 using burn.");
        }
        break;
      case BrainstoneArea.Area3:
        return warning("Brainstone in area 3 not used as free action.");
    }
  }
  return null;
}

function passWarningButton(warnings: string[]): ButtonWarning {
  return { title: "Are you sure you want to pass?", body: warnings };
}

function incomeWarning(player: Player, additionalEvents: Event[]) {
  const incomeSelection = player.incomeSelection(additionalEvents);
  if (incomeSelection.remainingChargesAfterIncome < 0) {
    return passWarningButton([
      `${-incomeSelection.remainingChargesAfterIncome} power charges will be wasted during income phase.`,
    ]);
  }
  return null;
}

export function chargeWarning(engine: Engine, player: Player, offer: string): ButtonWarning | null {
  return engine.passedPlayers.includes(player.player) ? incomeWarning(player, [new Event(offer)]) : null;
}

export function boosterWarning(engine: Engine, player: Player, booster: Booster): ButtonWarning | null {
  return incomeWarning(
    player,
    tiles.boosters[booster].map((spec) => new Event(spec))
  );
}

export function passWarning(engine: Engine, player: Player, command: AvailableCommand): ButtonWarning | null {
  const warnings: string[] = [];
  const endTurn = endTurnWarning(engine, command);
  if (endTurn != null) {
    warnings.push(...endTurn.body);
  }

  if (engine.round > 0) {
    const p = engine.players[command.player];

    for (const e of p.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push(`Special action is not yet used: ${e.spec.split(Operator.Activate)[1]}`);
    }

    switch (p.faction) {
      case Faction.Itars:
        const burnablePower = p.data.burnablePower();
        if (burnablePower > 0 && !engine.isLastRound) {
          warnings.push(`Power tokens in area 2 not burned: ${burnablePower}`);
        }
        break;
      case Faction.BalTaks:
        if (p.data.hasResource(new Reward(1, Resource.GaiaFormer))) {
          warnings.push("Gaiaformers are not yet converted.");
        }
        break;
    }
  }

  return warnings.length == 0 ? null : passWarningButton(warnings);
}

function rewardWarnings(player: Player, r: Reward): string[] {
  const data = player.data.clone();
  let waste = 0;
  if (r.type === Resource.ChargePower) {
    waste = applyChargePowers(data, [new Event(r.toString())]);
  } else {
    data.gainRewards([r]);
    const resources = player.data.getResources(r.type);
    if (resources == 0) {
      //this resource cannot be gained
      return [];
    }
    waste = resources + r.count - data.getResources(r.type);
  }
  if (waste > 0) {
    return [`${waste}${r.type} will be wasted`];
  }
  return [];
}

function resourceWasteWarning(warnings: string[]) {
  return warnings.length == 0 ? null : { title: "Resources will be wasted - are you sure?", body: warnings };
}

export function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(rewardWarnings(player, new Reward(income)));
}

export function advanceResearchWarning(player: Player, track: AvailableResearchTrack): ButtonWarning | null {
  const events = researchTracks[track.field][track.to].map((s) => new Event(s));

  let rewards = events.filter((e) => e.operator == Operator.Once).flatMap((e) => e.rewards);
  if (track.cost) {
    rewards = Reward.merge(rewards, Reward.negative(Reward.parse(track.cost)));
  }
  return resourceWasteWarning(rewards.flatMap((r) => rewardWarnings(player, r)));
}

export function finalizeShortcuts(ret: ButtonData[]) {
  let shortcut = 1;

  const shown = ret.filter((b) => !b.hide);
  for (const b of shown) {
    if (b.shortcuts == undefined) {
      b.shortcuts = [];
    }
    if (b.shortcuts.length == 0) {
      b.shortcuts.push(String(shortcut));
    }
    shortcut++;
  }

  if (shown.length == 1) {
    const b = shown[0];
    b.shortcuts = [];
    if (b.label) {
      if (forceNumericShortcut(b.label)) {
        b.shortcuts.push("1");
      } else {
        b.shortcuts.push(b.label.substring(0, 1).toLowerCase());
      }
    }
    b.shortcuts.push("Enter");
  }
}

export function buildButtons(engine: Engine, command: AvailableCommand): ButtonData[] {
  const ret: ButtonData[] = [];
  let academySelection: ButtonData[] = null;

  for (const building of Object.values(Building)) {
    const coordinates = (command.data.buildings as AvailableBuilding[]).filter((bld) => bld.building === building);
    if (coordinates.length == 0) {
      continue;
    }

    let label = `Build a ${buildingName(building)}`;

    if (coordinates[0].upgrade) {
      label = `Upgrade to ${buildingName(building)}`;
    } else if (coordinates[0].downgrade) {
      label = `Downgrade to ${buildingName(building)}`;
    } else if (coordinates[0].cost === "~" || building === Building.SpaceStation || building === Building.GaiaFormer) {
      label = `Place a ${buildingName(building)}`;
    }

    if (building == Building.Academy1 || building == Building.Academy2) {
      const buttons: ButtonData[] = [
        {
          label,
          command: building,
          hexes: hexMap(engine, coordinates),
        },
      ];

      if (academySelection != null) {
        academySelection.push(...buttons);
        continue;
      }
      academySelection = buttons;

      ret.push({
        label: "Upgrade to Academy",
        shortcuts: [buildingShortcut(building)],
        command: Command.Build,
        buttons,
      });
    } else {
      const buttons: ButtonData[] =
        engine.round === Round.None
          ? [
              {
                command: "",
                label: `Confirm ${buildingName(building)}`,
              } as ButtonData,
            ]
          : undefined;

      ret.push({
        label,
        shortcuts: [buildingShortcut(building)],
        command: `${Command.Build} ${building}`,
        automatic: command.data.automatic,
        hexes: hexMap(engine, coordinates),
        buttons,
        needConfirm: buttons?.length > 0,
      });
    }
  }
  return ret;
}

export function passButtons(engine: Engine, player: Player, command: AvailableCommand): ButtonData[] {
  const ret: ButtonData[] = [];
  const buttons: ButtonData[] = [];
  const warning = passWarning(engine, player, command);

  Booster.values(Expansion.All).forEach((booster, i) => {
    if (command.data.boosters.includes(booster)) {
      buttons.push({
        command: booster,
        label: `Booster ${i + 1}`,
        booster,
        needConfirm: true,
        buttons: [
          {
            command: "",
            label: `Confirm Booster ${boosterNames[booster].name}`,
            warning: boosterWarning(engine, player, booster),
          },
        ],
        tooltip: tiles.boosters[booster].map((spec) => eventDesc(new Event(spec))).join("\n"),
      });
    }
  });

  // need a Pass confirmation if it's the last round, where Command = Pass but no Boosters
  if (command.data.boosters.length === 0) {
    ret.push({
      label: "Pass",
      shortcuts: ["p"],
      command: Command.Pass,
      needConfirm: true,
      buttons: [
        {
          command: "",
          label: `Confirm Pass`,
        },
      ],
      warning,
    });
  } else {
    ret.push({
      label: command.name === Command.Pass ? "Pass" : "Pick booster",
      shortcuts: ["p"],
      command: command.name,
      buttons,
      boosters: command.data.boosters,
      warning,
    });
  }
  return ret;
}

function translateResources(rewards: Reward[]): string {
  return rewards
    .map((r) => {
      const s = resourceNames.find((s) => s.type == r.type);
      return r.count + " " + (r.count == 1 ? s.label : s.plural);
    })
    .join(" and ");
}

function conversionLabel(cost: Reward[], income: Reward[]) {
  return `${translateResources(cost)} ⇒ ${translateResources(income).replace(
    "4 Victory Points",
    "3 VP + 1 VP / Planet Type"
  )}`;
}

function resourceSymbol(type: Resource) {
  switch (type) {
    case Resource.ChargePower:
      return Resource.PayPower;
    case Resource.TokenArea3:
      return Resource.BowlToken;
    default:
      return type;
  }
}

function newConversion(cost: Reward[], income: Reward[]) {
  return {
    from: cost.map((r) => new Reward(r.count, resourceSymbol(r.type))),
    to: income.map((r) => new Reward(r.count, resourceSymbol(r.type))),
  };
}

export function boardActionButton(data: AvailableBoardActionData): ButtonData {
  return {
    label: "Power/Q.I.C Action",
    shortcuts: ["q"],
    command: Command.Action,
    actions: data.poweracts.map((act) => act.name),
    buttons: data.poweracts.map((act) => {
      const cost = Reward.parse(act.cost);
      const income = Reward.merge(Event.parse(act.income, null).flatMap((e) => e.rewards));

      const shortcut = boardActionNames[act.name].shortcut;
      return {
        label: withShortcut(conversionLabel(cost, income), shortcut, "Power Charges"),
        conversion: newConversion(cost, income),
        shortcuts: [shortcut],
        command: act.name,
      };
    }),
  };
}

export function freeActionButton(data: AvailableFreeActionData): ButtonData[] {
  return data.acts.map((act) => {
    const conversion = freeActionConversions[act.action];

    const cost = Reward.parse(conversion.cost);
    const income = Reward.parse(conversion.income);

    return {
      label: conversionLabel(cost, income),
      conversion: newConversion(cost, income),
      shortcuts: [freeActionShortcuts[act.action]],
      command: `${Command.Spend} ${conversion.cost} for ${conversion.income}`,
      times: act.range,
    };
  });
}

export function burnButton(player: Player, command: AvailableCommand) {
  return {
    label: "Burn Power",
    shortcuts: ["b"],
    command: `${Command.BurnPower} 1`,
    conversion: {
      from: [new Reward(2, Resource.BowlToken)],
      to: [
        new Reward(1, player.faction == Faction.Itars ? Resource.GainTokenGaiaArea : Resource.BurnToken),
        new Reward(1, Resource.ChargePower),
      ],
    },
    times: range(1, max(command.data as number[]) + 1),
  };
}

export function freeAndBurnButton(buttons: ButtonData[]): ButtonData {
  const labels = [];
  if (buttons.some((b) => b.command.startsWith(Command.Spend))) {
    labels.push("Free action");
  }
  if (buttons.some((b) => b.command.startsWith(Command.BurnPower))) {
    labels.push("Burn power");
  }
  buttons = sortBy(buttons, (b) => b.conversion.from[0].type);
  return {
    label: labels.join(" / "),
    shortcuts: ["a"],
    buttons: buttons,
  };
}
