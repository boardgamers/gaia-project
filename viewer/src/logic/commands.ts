import Engine, {
  applyChargePowers,
  AvailableBoardActionData,
  AvailableBuilding,
  AvailableCommand,
  AvailableFreeAction,
  AvailableFreeActionData,
  AvailableHex,
  AvailableResearchTrack,
  BoardAction,
  boardActions,
  Booster,
  boosters,
  BrainstoneActionData,
  Building,
  Command,
  conversionToFreeAction,
  Event,
  Expansion,
  Faction,
  GaiaHex,
  HighlightHex,
  Operator,
  Player,
  PowerArea,
  researchTracks,
  Resource,
  Reward,
  Round,
} from "@gaia-project/engine";
import { max, minBy, range, sortBy } from "lodash";
import { ButtonData, ButtonWarning, HighlightHexData, SpecialActionInfo } from "../data";
import {
  boardActionNames,
  FastConversion,
  FastConversionButton,
  FastConversionEvent,
  freeActionShortcuts,
} from "../data/actions";
import { boosterNames } from "../data/boosters";
import { buildingName, buildingShortcut } from "../data/building";
import { eventDesc } from "../data/event";
import { resourceNames } from "../data/resources";
import { moveWarnings } from "../data/warnings";

export type AvailableConversions = {
  free?: AvailableFreeActionData;
  burn?: number[];
};

export const forceNumericShortcut = (label: string) => ["Charge", "Income"].find((b) => label.startsWith(b));

export function withShortcut(label: string, shortcut: string, skip?: string[]) {
  if (!shortcut) {
    return label;
  }

  let skipIndex = 0;
  for (const s of skip ?? []) {
    const found = label.indexOf(s);
    if (found >= 0) {
      skipIndex = found + s.length;
    }
  }

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
    switch (p.data.brainstone) {
      case PowerArea.Area2:
        if (p.data.burnablePower() > 0) {
          return warning("Brainstone in area 2 not moved to area 3 using burn.");
        }
        break;
      case PowerArea.Area3:
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
    boosters[booster].map((spec) => new Event(spec))
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
    if (isFinite(Number(b.shortcuts[0]))) {
      b.shortcuts = [];
    }
    const label = b.label ?? b.command;
    if (label) {
      if (forceNumericShortcut(label)) {
        b.shortcuts.push("1");
      } else {
        b.shortcuts.push(label.substring(0, 1).toLowerCase());
      }
    }
    b.shortcuts.push("Enter");
  }
}

export function buildButtons(engine: Engine, command: AvailableCommand<Command.Build>): ButtonData[] {
  const ret: ButtonData[] = [];
  let academySelection: ButtonData[] = null;

  const m = new Map<string, AvailableBuilding[]>();
  const faction = engine.player(command.player).faction;
  for (const bld of command.data.buildings) {
    const building = bld.building;
    const shortcut = buildingShortcut(bld);

    const name = buildingName(building, faction);
    let label = withShortcut(`Build a ${name}`, shortcut);

    if (bld.upgrade) {
      if (building == Building.Mine) {
        label = withShortcut("Upgrade Gaia Former to Mine", shortcut);
      } else {
        label = withShortcut(`Upgrade to ${name}`, shortcut, ["Upgrade to"]);
      }
    } else if (bld.downgrade) {
      label = withShortcut(`Downgrade to ${name}`, shortcut);
    } else if (bld.cost === "~" || building === Building.SpaceStation || building === Building.GaiaFormer) {
      label = withShortcut(`Place a ${name}`, shortcut);
    }

    const old = m.get(label) ?? [];
    old.push(bld);
    m.set(label, old);
  }

  const sort = Object.values(Building);
  const sorted = sortBy(
    Array.from(m.entries()),
    ([l, b]) => sort.indexOf(b[0].building) * 2 + (b[0].upgrade || b[0].downgrade ? 1 : 0)
  );

  for (const [label, buildings] of sorted) {
    let warning: ButtonWarning = null;
    if (buildings.every((b) => b.warnings?.length > 0)) {
      const common = buildings[0].warnings
        .filter((w) => buildings.every((b) => b.warnings.includes(w)))
        .map((w) => moveWarnings[w].text);
      warning = {
        title: "Every possible building location has a warning",
        body: common.length > 0 ? common : ["Different warnings"],
      };
    }

    const building = buildings[0].building;
    const shortcut = buildingShortcut(buildings[0]);

    if (building == Building.Academy1 || building == Building.Academy2) {
      const buttons: ButtonData[] = [
        {
          label: buildingName(building, faction),
          command: building,
          shortcuts: [building == Building.Academy1 ? "k" : faction == Faction.BalTaks ? "c" : "q"],
          hexes: hexMap(engine, buildings),
        },
      ];

      if (academySelection != null) {
        academySelection.push(...buttons);
        continue;
      }
      academySelection = buttons;

      ret.push({
        label: "Upgrade to Academy",
        shortcuts: [shortcut],
        command: Command.Build,
        buttons,
        warning,
      });
    } else {
      const buttons: ButtonData[] =
        engine.round === Round.None
          ? [
              {
                command: "",
                label: `Confirm ${buildingName(building, faction)}`,
              } as ButtonData,
            ]
          : undefined;

      ret.push({
        label,
        shortcuts: [shortcut],
        command: `${Command.Build} ${building}`,
        hexes: hexMap(engine, buildings),
        buttons,
        warning,
        needConfirm: buttons?.length > 0,
      });
    }
  }
  return ret;
}

export function passButtons(
  engine: Engine,
  player: Player,
  command: AvailableCommand<Command.Pass | Command.ChooseRoundBooster>
): ButtonData[] {
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
        tooltip: boosters[booster].map((spec) => eventDesc(new Event(spec))).join("\n"),
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

export function translateResources(rewards: Reward[]): string {
  return rewards
    .map((r) => {
      const s = resourceNames.find((s) => s.type == r.type);
      return r.count + " " + (r.count == 1 ? s.label : s.plural);
    })
    .join(" and ");
}

export function conversionLabel(cost: Reward[], income: Reward[]) {
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

function newConversion(cost: Reward[], income: Reward[], player?: Player) {
  return {
    from: cost.map(
      (r) =>
        new Reward(
          r.type == Resource.ChargePower ? Math.ceil(r.count / player?.data?.tokenModifier ?? 1) : r.count,
          resourceSymbol(r.type)
        )
    ),
    to: income.map((r) => new Reward(r.count, r.type)),
  };
}

function conversionButton(
  cost: Reward[],
  income: Reward[],
  player: Player | null,
  shortcut: string,
  skipShortcut: string[],
  command: string,
  boardAction?: BoardAction,
  times?: number[]
): ButtonData {
  return {
    tooltip: withShortcut(conversionLabel(cost, income), shortcut, skipShortcut),
    label: "<u></u>",
    conversion: newConversion(cost, income, player),
    shortcuts: shortcut != null ? [shortcut] : [],
    command,
    times,
    boardAction,
  };
}

export function boardActionButton(action: BoardAction, player: Player | null) {
  const b = boardActions[action];
  const income = Reward.merge(b.income.flatMap((i) => i.rewards));

  const shortcut = boardActionNames[action].shortcut;
  return conversionButton(b.cost, income, player, shortcut, ["Power Charges", "Terraforming"], action, action);
}

export function boardActionsButton(data: AvailableBoardActionData, player: Player): ButtonData {
  return {
    label: "Power/Q.I.C Action",
    shortcuts: ["q"],
    command: Command.Action,
    boardActions: data.poweracts.map((act) => act.name),
    buttons: data.poweracts.map((act) => boardActionButton(act.name, player)),
  };
}

function specialActionInfo(act: { income: string; spec: string }): SpecialActionInfo {
  return { events: [new Event(">" + act.income)] };
}

export function specialActionsButton(command: AvailableCommand<Command.Special>): ButtonData {
  return {
    label: "Special Action",
    shortcuts: ["s"],
    command: Command.Special,
    specialActions: command.data.specialacts.map((act) => specialActionInfo(act)),
    buttons: command.data.specialacts.map((act) => ({
      command: act.income,
      specialAction: specialActionInfo(act),
      warning: specialActionWarning(this.player, act.income),
    })),
  };
}

export function spendCommand(act: AvailableFreeAction) {
  return `${Command.Spend} ${act.cost} for ${act.income}`;
}

function fastConversionPossible(action: AvailableFreeAction, conversion: FastConversion, player: Player): boolean {
  return !action.hide && (!conversion.filter || conversion.filter(player));
}

export type FastConversionTooltips = { [key in FastConversionButton]?: string };

function freeActionPriority(a: AvailableFreeAction) {
  return freeActionShortcuts[conversionToFreeAction(a)].fast.priority ?? 0;
}

export function freeActionButton(
  data: AvailableFreeActionData,
  player: Player
): { buttons: ButtonData[]; tooltips: FastConversionTooltips } {
  function newButton(act: AvailableFreeAction) {
    return conversionButton(
      Reward.parse(act.cost),
      Reward.parse(act.income),
      player,
      freeActionShortcuts[conversionToFreeAction(act)]?.shortcut,
      [],
      spendCommand(act),
      null,
      act.range
    );
  }

  const buttons = data.acts.filter((a) => !a.hide).map((act) => newButton(act));

  const fast: AvailableFreeAction[] = data.acts
    .filter((a) => !a.hide)
    .flatMap((act) => {
      const action = conversionToFreeAction(act);
      if (action != null) {
        const shortcut = freeActionShortcuts[action];
        if (fastConversionPossible(act, shortcut.fast, player)) {
          return act;
        }
      }
      return [];
    });

  const tooltips: FastConversionTooltips = {};
  for (const a of sortBy(fast, (a) => freeActionPriority(a))) {
    const button = freeActionShortcuts[conversionToFreeAction(a)].fast.button;
    const last = tooltips[button];
    const tooltip = newButton(a).tooltip;
    tooltips[button] = last ? last + ", " + tooltip : tooltip;
  }

  return { tooltips, buttons };
}

export function burnButton(player: Player, availableRange?: number[]) {
  return conversionButton(
    [new Reward(2, Resource.BowlToken)],
    [
      new Reward(1, player.faction == Faction.Itars ? Resource.GainTokenGaiaArea : Resource.BurnToken),
      new Reward(1, Resource.ChargePower),
    ],
    player,
    "b",
    [],
    `${Command.BurnPower} 1`,
    null,
    availableRange?.length > 1 ? range(1, max(availableRange) + 1) : undefined
  );
}

const fastBurnButton = PowerArea.Area3;

export function fastConversionClick(
  event: FastConversionEvent,
  conversions: AvailableConversions,
  player: Player
): string | null {
  if (event.button == fastBurnButton && conversions.burn) {
    return `${Command.BurnPower} 1`;
  }

  const possible: AvailableFreeAction[] = conversions.free.acts.filter((a) => {
    const c = freeActionShortcuts[conversionToFreeAction(a)]?.fast;
    return c.button == event.button && fastConversionPossible(a, c, player);
  });
  if (possible.length > 0) {
    const action: AvailableFreeAction = minBy(possible, (a) => freeActionPriority(a));
    return spendCommand(action);
  }
  return null;
}

export function freeAndBurnButton(
  conversions: AvailableConversions,
  player: Player
): { button: ButtonData; tooltips: FastConversionTooltips } {
  const labels = [];
  const buttons: ButtonData[] = [];
  let tooltips: FastConversionTooltips = {};
  if (conversions.free) {
    labels.push("Free action");
    const b = freeActionButton(conversions.free, player);
    buttons.push(...b.buttons);
    tooltips = b.tooltips;
  }
  if (conversions.burn) {
    labels.push("Burn power");
    buttons.push(burnButton(player, conversions.burn));
    tooltips[fastBurnButton] = "Burn power";
  }

  return {
    button: {
      label: labels.join(" / "),
      shortcuts: ["a"],
      buttons: sortBy(buttons, (b) => b.conversion.from[0].type),
    },
    tooltips,
  };
}

export function brainstoneButtons(data: BrainstoneActionData): ButtonData[] {
  return data.choices.sort().map((d) => {
    const area = d.area;
    return {
      label: `Brainstone ${area}`,
      warning: buttonWarning(moveWarnings[d.warning]?.text),
      command: `${Command.BrainStone} ${area}`,
      shortcuts: [area == PowerArea.Gaia ? "g" : area.substring("area".length, area.length)],
    };
  });
}
