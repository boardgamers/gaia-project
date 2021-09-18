import Engine, {
  AdvTechTilePos,
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
  BrainstoneActionData,
  Building,
  ChooseTechTile,
  Command,
  conversionToFreeAction,
  Event,
  Expansion,
  Faction,
  Federation,
  GaiaHex,
  HighlightHex,
  MAX_SATELLITES,
  Operator,
  Player,
  PowerArea,
  researchTracks,
  Resource,
  Reward,
  Round,
  SubPhase,
  TechTilePos,
  tiles,
} from "@gaia-project/engine";
import assert from "assert";
import { max, minBy, range, sortBy } from "lodash";
import { ActionPayload, SubscribeActionOptions, SubscribeOptions } from "vuex";
import { ButtonData, ButtonWarning, HexSelection, HighlightHexData } from "../data";
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
import { federationData } from "../data/federations";
import { researchNames } from "../data/research";
import { resourceNames } from "../data/resources";
import { moveWarnings } from "../data/warnings";

export type UndoPropagation = {
  undoPerformed: boolean;
};

export type AvailableConversions = {
  free?: AvailableFreeActionData;
  burn?: number[];
};

export interface CommandController {
  readonly customButtons: ButtonData[];
  readonly subscriptions: { [key in Command]?: () => void };
  undo();
  handleCommand(command: string, source?: ButtonData);
  disableTooltips();
  highlightHexes(selection: HexSelection);
  subscribeAction<P extends ActionPayload>(fn: SubscribeActionOptions<P, any>, options?: SubscribeOptions): () => void;
  setFastConversionTooltips(tooltips: FastConversionTooltips);
}

export interface MoveButtonController {
  handleClick();
  highlightResearchTiles(tiles: string[]);
  highlightTechs(techs: Array<TechTilePos | AdvTechTilePos>);
  subscribeButtonClick(action: string, transform?: (button: ButtonData) => ButtonData, activateButton?: boolean);
  setButton(button: ButtonData, key: string);
}

export const forceNumericShortcut = (label: string) => ["Charge", "Income"].find((b) => label.startsWith(b));

export function withShortcut(label: string | null, shortcut: string | null, skip?: string[]): string | null {
  if (!label || !shortcut || label.includes("<u>")) {
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

function tooltipWithShortcut(tooltip: string | null, warn: ButtonWarning | null, shortcut?: string, skip?: string[]) {
  const warnings = warn?.body?.join(", ");

  if (tooltip && warn) {
    return withShortcut(tooltip, shortcut, skip) + " - " + warnings;
  }
  return withShortcut(tooltip, shortcut, skip) ?? warnings;
}

export function activateOnShow(button: ButtonData): ButtonData {
  let controller: MoveButtonController = null;
  button.onCreate = (c) => (controller = c);
  const last = button.onShow;
  button.onShow = () => {
    last?.();
    controller.handleClick();
  };
  return button;
}

function translateResources(rewards: Reward[]): string {
  return rewards
    .map((r) => {
      const s = resourceNames.find((s) => s.type == r.type);
      assert(s, "no resource name for " + r.type);
      return r.count + " " + (r.count == 1 ? s.label : s.plural);
    })
    .join(" and ");
}

export function hexMap(engine: Engine, coordinates: AvailableHex[], selectedLight: boolean): HexSelection {
  return {
    selectedLight,
    hexes: new Map<GaiaHex, HighlightHex>(
      coordinates.map((coord) => [
        engine.map.getS(coord.coordinates),
        {
          cost: coord.cost,
          warnings: coord.warnings,
        },
      ])
    ),
  };
}

export function buttonWarning(message?: string): ButtonWarning | null {
  return message && { title: "Are you sure?", body: [message] };
}

function endTurnWarning(engine: Engine, command: AvailableCommand): ButtonWarning | null {
  const warning = (msg: string) =>
    ({
      title: "Are you sure you want to end the turn?",
      body: [msg],
    } as ButtonWarning);

  const p = engine.players[command.player];
  if (p.faction == Faction.Taklons) {
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

function rewardWarnings(player: Player, rewards: Reward[]): string[] {
  const data = player.data.clone();
  return rewards.flatMap((r) => {
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
      return [`${waste}${r.type} will be wasted.`];
    }
    return [];
  });
}

function passWarningButton(warnings: string[]): ButtonWarning {
  return { title: "Are you sure you want to pass?", body: warnings };
}

function chargeIncomeWarning(player: Player, additionalEvents: Event[]) {
  const incomeSelection = player.incomeSelection(additionalEvents);
  if (incomeSelection.remainingChargesAfterIncome < 0) {
    return passWarningButton([
      `${-incomeSelection.remainingChargesAfterIncome} power charges will be wasted during income phase.`,
    ]);
  }
  return null;
}

function chargeWarning(engine: Engine, player: Player, offer: string): ButtonWarning | null {
  return engine.passedPlayers.includes(player.player) ? chargeIncomeWarning(player, [new Event(offer)]) : null;
}

export function boosterWarning(player: Player, booster: Booster): ButtonWarning | null {
  const warnings: string[] = [];

  const additionalEvents = tiles.boosters[booster].map((spec) => new Event(spec));

  const charge = chargeIncomeWarning(player, additionalEvents);
  if (charge) {
    warnings.push(...charge.body);
  }

  const incomeEvents = player.events[Operator.Income];
  const notActivated = incomeEvents.filter((ev) => !ev.activated);
  if (additionalEvents) {
    notActivated.push(...additionalEvents);
  }
  const rewards = Reward.merge(...notActivated.map((e) => e.rewards)).filter((r) => r.type != Resource.ChargePower);

  const rewardWarning = rewardWarnings(player, rewards);
  if (rewardWarning?.length > 0) {
    warnings.push(...rewardWarning.map((w) => w.substring(0, w.length - 1) + " during income phase."));
  }

  if (warnings.length > 0) {
    return passWarningButton(warnings);
  }

  return null;
}

function passWarning(engine: Engine, player: Player, command: AvailableCommand): ButtonWarning | null {
  const warnings: string[] = [];
  const endTurn = endTurnWarning(engine, command);
  if (endTurn != null) {
    warnings.push(...endTurn.body);
  }

  if (engine.round > 0) {
    const p = engine.players[command.player];

    for (const e of p.events[Operator.Activate].filter((e) => !e.activated)) {
      warnings.push(`Special action is not yet used: ${translateResources(e.rewards)}.`);
    }

    switch (p.faction) {
      case Faction.Itars:
        const burnablePower = p.data.burnablePower();
        if (burnablePower > 0 && !engine.isLastRound) {
          warnings.push(`Power tokens in area 2 not burned: ${burnablePower}.`);
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

function resourceWasteWarning(warnings: string[]): ButtonWarning | null {
  return warnings.length == 0 ? null : { title: "Resources will be wasted - are you sure?", body: warnings };
}

function specialActionWarning(player: Player, income: string): ButtonWarning | null {
  return resourceWasteWarning(rewardWarnings(player, [new Reward(income)]));
}

function advanceResearchWarning(player: Player, track: AvailableResearchTrack): ButtonWarning | null {
  const events = researchTracks[track.field][track.to].map((s) => new Event(s));

  let rewards = events.filter((e) => e.operator == Operator.Once).flatMap((e) => e.rewards);
  if (track.cost) {
    rewards = Reward.merge(rewards, Reward.negative(Reward.parse(track.cost)));
  }
  return resourceWasteWarning(rewardWarnings(player, rewards));
}

function symbolButton(button: ButtonData, skipShortcut?: string[]): ButtonData {
  button.tooltip = tooltipWithShortcut(
    button.label,
    button.warning,
    button.shortcuts ? button.shortcuts[0] : null,
    skipShortcut
  );
  button.label = "<u></u>"; //to prevent fallback to command
  return button;
}

function textButton(button: ButtonData): ButtonData {
  button.tooltip = tooltipWithShortcut(null, button.warning);
  return button;
}

export function finalizeShortcuts(buttons: ButtonData[]) {
  for (const button of buttons) {
    if (button.buttons) {
      finalizeShortcuts(button.buttons);
    }
  }
  let shortcut = 1;

  const shown = buttons.filter((b) => !b.hide);
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
    ([, b]) => sort.indexOf(b[0].building) * 2 + (b[0].upgrade || b[0].downgrade ? 1 : 0)
  );

  for (const [label, buildings] of sorted) {
    let warning: ButtonWarning = null;
    if (buildings.every((b) => b.warnings?.length > 0)) {
      const common = buildings[0].warnings
        .filter((w) => buildings.every((b) => b.warnings.includes(w)))
        .map((w) => moveWarnings[w].text);
      warning = {
        title: "Every possible building location has a warning",
        body: common.length > 0 ? common : ["Different warnings."],
      } as ButtonWarning;
    }

    const building = buildings[0].building;
    const shortcut = buildingShortcut(buildings[0]);

    if (building == Building.Academy1 || building == Building.Academy2) {
      const buttons: ButtonData[] = [
        textButton({
          label: buildingName(building, faction),
          command: building,
          shortcuts: [building == Building.Academy1 ? "k" : faction == Faction.BalTaks ? "c" : "q"],
          hexes: hexMap(engine, buildings, false),
        }),
      ];

      if (academySelection != null) {
        academySelection.push(...buttons);
        continue;
      }
      academySelection = buttons;

      ret.push(
        textButton({
          label: "Upgrade to Academy",
          shortcuts: [shortcut],
          command: Command.Build,
          buttons,
          warning,
        })
      );
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

      ret.push(
        textButton({
          label,
          shortcuts: [shortcut],
          command: `${Command.Build} ${building}`,
          hexes: hexMap(engine, buildings, false),
          buttons,
          warning,
          needConfirm: buttons?.length > 0,
        })
      );
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

  Booster.values(Expansion.All).forEach((booster) => {
    if (command.data.boosters.includes(booster)) {
      buttons.push(
        symbolButton({
          label: tiles.boosters[booster].map((spec) => eventDesc(new Event(spec))).join("\n"),
          command: booster,
          booster,
          needConfirm: true,
          buttons: [
            textButton({
              command: "",
              label: `Confirm Booster ${boosterNames[booster].name}`,
              warning: boosterWarning(player, booster),
            }),
          ],
        })
      );
    }
  });

  // need a Pass confirmation if it's the last round, where Command = Pass but no Boosters
  if (command.data.boosters.length === 0) {
    ret.push(
      textButton({
        label: "Pass",
        shortcuts: ["p"],
        command: Command.Pass,
        needConfirm: true,
        buttons: [
          textButton({
            command: "",
            label: `Confirm Pass`,
          }),
        ],
        warning,
      })
    );
  } else {
    const button = textButton({
      label: command.name === Command.Pass ? "Pass" : "Pick booster",
      shortcuts: ["p"],
      command: command.name,
      buttons,
      boosters: command.data.boosters,
      warning,
    });
    ret.push(command.name === Command.ChooseRoundBooster ? activateOnShow(button) : button);
  }
  return ret;
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

function newConversion(cost: Reward[], income: Reward[], player?: Player) {
  return {
    from: cost.map((r) => {
      return new Reward(
        r.type == Resource.ChargePower
          ? Math.ceil(r.count / (player != null ? player?.data?.tokenModifier : 1))
          : r.count,
        resourceSymbol(r.type)
      );
    }),
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
  return symbolButton(
    {
      label: conversionLabel(cost, income),
      conversion: newConversion(cost, income, player),
      shortcuts: shortcut != null ? [shortcut] : [],
      command,
      warning: player ? resourceWasteWarning(rewardWarnings(player, income)) : null,
      times,
      boardAction,
    },
    skipShortcut
  );
}

export function boardActionButton(action: BoardAction, player: Player | null) {
  const b = boardActions[action];
  const cost = Reward.parse(b.cost);
  const income = Reward.merge(Event.parse(b.income, null).flatMap((e) => e.rewards));

  const shortcut = boardActionNames[action].shortcut;
  return conversionButton(cost, income, player, shortcut, ["Power Charges", "Terraforming"], action, action);
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

export function specialActionButton(income: string, player: Player | null): ButtonData {
  const rewards = Reward.parse(income);
  return symbolButton({
    label: translateResources(rewards),
    command: income,
    specialAction: income,
    warning: player ? specialActionWarning(player, income) : null,
    shortcuts: [resourceNames.find((r) => r.type === rewards[0].type).shortcut],
  });
}

export function specialActionsButton(command: AvailableCommand<Command.Special>, player: Player) {
  return {
    label: "Special Action",
    shortcuts: ["s"],
    command: Command.Special,
    specialActions: command.data.specialacts.map((act) => act.income),
    buttons: command.data.specialacts.map((act) => specialActionButton(act.income, player)),
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
    return textButton({
      label: `Brainstone ${area}`,
      warning: buttonWarning(moveWarnings[d.warning]?.text),
      command: `${Command.BrainStone} ${area}`,
      shortcuts: [area == PowerArea.Gaia ? "g" : area.substring("area".length, area.length)],
    });
  });
}

export function researchButtons(
  command: AvailableCommand<Command.UpgradeResearch>,
  player: Player,
  nested: boolean
): ButtonData[] {
  const tracks = command.data.tracks;
  const ret: ButtonData[] = tracks.map((track) =>
    textButton({
      command: `${command.name} ${track.field}`,
      label: researchNames[track.field],
      shortcuts: [track.field.substring(0, 1)],
      warning: advanceResearchWarning(player, track),
    })
  );

  ret[0].onCreate = (controller) => {
    controller.highlightResearchTiles(tracks.map((track) => track.field + "-" + track.to));

    //here we have to prepend the command again, because it comes from ResearchTile.vue, which is only the position
    controller.subscribeButtonClick(
      "researchClick",
      (button) => ({ command: `${command.name} ${button.command}` }),
      false
    );
  };

  if (nested) {
    return [
      textButton({
        label: "Research",
        shortcuts: ["r"],
        buttons: ret,
      }),
    ];
  }
  return ret;
}

export function chargePowerButtons(
  command: AvailableCommand<Command.ChargePower>,
  engine: Engine,
  player: Player
): ButtonData[] {
  const ret: ButtonData[] = [];

  for (const offer of command.data.offers) {
    const leech = offer.offer;
    const action = leech.includes("pw") ? "Charge" : "Gain";
    ret.push(
      textButton({
        label: offer.cost && offer.cost !== "~" ? `${action} ${leech} for ${offer.cost}` : `${action} ${leech}`,
        command: `${Command.ChargePower} ${leech}`,
        warning: chargeWarning(engine, player, leech),
      })
    );
  }
  return ret;
}

export function endTurnButton(command: AvailableCommand<Command.EndTurn>, engine: Engine): ButtonData {
  return textButton({
    label: "End Turn",
    shortcuts: ["e"],
    command: Command.EndTurn,
    needConfirm: true,
    buttons: [
      textButton({
        command: Command.EndTurn,
        label: `Confirm End Turn`,
      }),
    ],
    warning: endTurnWarning(engine, command),
  });
}

export function deadEndButton(command: AvailableCommand<Command.DeadEnd>, undo: () => void): ButtonData {
  let reason = "";
  switch (command.data as SubPhase) {
    case SubPhase.ChooseTechTile:
      reason = "No tech tile left";
      break;
    case SubPhase.BuildMineOrGaiaFormer:
      reason = "Cannot build mine or gaia former";
      break;
    case SubPhase.BuildMine:
      reason = "Cannot build mine";
      break;
    case SubPhase.PISwap:
      reason = "Cannot swap planetary institute";
      break;
    case SubPhase.DowngradeLab:
      reason = "Cannot downgrade lab";
      break;
    case SubPhase.UpgradeResearch:
      reason = "Cannot upgrade research";
      break;
  }
  return textButton({
    command: Command.DeadEnd,
    label: reason,
    warning: {
      title: "Dead end reached",
      body: ["You've reached a required move that is not possible to execute."],
      okButton: {
        label: "Undo",
        action: () => {
          undo();
        },
      },
    },
  });
}

export function federationTypeButtons(federations: Federation[], player: Player) {
  return federations.map((fed, i) => {
    const federation = tiles.federations[fed];
    return textButton({
      command: fed,
      label: `Federation ${i + 1}: ${federation}`,
      shortcuts: [federationData[fed].shortcut],
      warning: resourceWasteWarning(rewardWarnings(player, Reward.parse(federation))),
    });
  });
}

export function customHexSelection(hexes: HighlightHexData): HexSelection {
  return {
    hexes: hexes,
    selectAnyHex: true,
    backgroundLight: true,
  };
}

export function federationButton(
  command: AvailableCommand<Command.FormFederation>,
  engine: Engine,
  highlightHexes: (selection: HexSelection) => void,
  handleCommand: (command: string, source?: ButtonData) => void,
  player: Player
): ButtonData {
  const fedTypeButtons: ButtonData[] = federationTypeButtons(command.data.tiles, player);

  const locationButtons: ButtonData[] = command.data.federations.map((fed, i) =>
    textButton({
      command: fed.hexes,
      label: `Location ${i + 1}`,
      hexes: {
        hexes: new Map(
          fed.hexes.split(",").map((coord) => [engine.map.getS(coord), { coordinates: coord }])
        ) as HighlightHexData,
        hover: true,
      },
      buttons: fedTypeButtons,
      warning: buttonWarning(fed.warning != null ? moveWarnings[fed.warning].text : null),
    })
  );

  const n = locationButtons.length;
  let index: number = null;

  let controller: MoveButtonController = null;
  const okButton = textButton({
    label: "OK",
    shortcuts: ["o", "Enter"],
    onCreate: (c) => {
      controller = c;
    },
    onClick: () => {
      const button = locationButtons[index];
      handleCommand(button.command, button); //to keep the selection
    },
  });

  const cycle = (update: number) => () => {
    index = index == null ? 0 : (((index + update) % n) + n) % n;

    const button = locationButtons[index];
    okButton.warning = button.warning;
    okButton.tooltip = tooltipWithShortcut(null, button.warning);
    if (controller) {
      controller.setButton(okButton, String(index));
    }
    highlightHexes(button.hexes);
  };

  locationButtons.push({
    label: "Custom location",
    shortcuts: ["c"],
    buttons: [
      textButton({
        label: "Select planets and empty space to be included in the federation",
        hexes: customHexSelection(new Map<GaiaHex, HighlightHex>()),
        buttons: fedTypeButtons,
      }),
    ],
  });

  locationButtons.push(
    textButton({
      label: "Previous",
      shortcuts: ["p"],
      onClick: cycle(-1),
    })
  );

  locationButtons.push(okButton);

  const next = cycle(1);
  locationButtons.push(
    textButton({
      label: "Next",
      shortcuts: ["n"],
      onClick: next,
    })
  );

  const sat = player.faction === Faction.Ivits ? "QICs" : "power tokens";
  return textButton({
    label: "Form federation",
    longLabel: `Form federation (${player.maxSatellites} ${sat} can be used as satellites, ${
      MAX_SATELLITES - player.data.satellites
    } satellites are left)`,
    shortcuts: ["f"],
    command: Command.FormFederation,
    buttons: locationButtons,
    onOpen: () => next(),
  });
}

export function declineButton(command: AvailableCommand<Command.Decline>): ButtonData {
  const offer = command.data.offers[0].offer;
  let message = undefined;
  switch (offer) {
    case Command.ChooseTechTile:
      message = "Are you sure you want to decline a tech tile?";
      break;
    case Command.UpgradeResearch:
      message = "Are you sure you want to decline a free research step?";
      break;
  }
  return textButton({
    label: `Decline ${offer}`,
    shortcuts: ["d"],
    command: `${Command.Decline} ${offer}`,
    warning: buttonWarning(message),
  });
}

export function techTiles(command: Command, tiles: ChooseTechTile[]): ButtonData[] {
  const ret: ButtonData[] = tiles.map((tile) => ({ command: `${command} ${tile.pos}`, tech: tile.pos }));

  ret[0].onCreate = (controller) => {
    controller.highlightTechs(tiles.map((tile) => tile.pos));
    //here we have to prepend the command again, because it comes from TechTile.vue, which is only the position
    controller.subscribeButtonClick("techClick", (button) => ({ command: `${command} ${button.command}` }));
  };
  return ret;
}

export function hasPass(commands: AvailableCommand[]) {
  return commands.some((c) => c.name === Command.Pass);
}

function commandButton(
  command: AvailableCommand,
  engine: Engine,
  player: Player,
  commands: AvailableCommand[],
  conversions: AvailableConversions,
  controller: CommandController
): ButtonData[] {
  switch (command.name) {
    case Command.RotateSectors: {
      return [
        {
          label: "Rotate sectors",
          command: Command.RotateSectors,
          shortcuts: ["r"],
          rotation: true,
          hexes: { hexes: new Map(), backgroundLight: true, selectAnyHex: true },
        },
      ];
    }
    case Command.Build: {
      return buildButtons(engine, command);
    }

    case Command.PISwap: {
      return [
        {
          label: "Swap Planetary Institute",
          shortcuts: ["w"],
          command: command.name,
          hexes: hexMap(engine, command.data.buildings, false),
        },
      ];
    }

    case Command.PlaceLostPlanet: {
      return [
        {
          label: "Place Lost Planet",
          command: command.name,
          hexes: hexMap(engine, command.data.spaces, true),
        },
      ];
    }

    case Command.Pass:
    case Command.ChooseRoundBooster: {
      return passButtons(engine, player, command);
    }

    case Command.UpgradeResearch: {
      return researchButtons(command, player, hasPass(commands));
    }

    case Command.ChooseTechTile:
    case Command.ChooseCoverTechTile: {
      return techTiles(command.name, command.data.tiles);
    }

    case Command.ChargePower: {
      return chargePowerButtons(command, engine, player);
    }

    case Command.Decline: {
      return [declineButton(command)];
    }

    case Command.BrainStone: {
      return brainstoneButtons(command.data);
    }
    case Command.Spend: {
      conversions.free = command.data;
      return [];
    }
    case Command.BurnPower: {
      conversions.burn = command.data;
      return [];
    }
    case Command.Action: {
      return [boardActionsButton(command.data, player)];
    }

    case Command.Special: {
      return [specialActionsButton(command, player)];
    }

    case Command.EndTurn: {
      return [endTurnButton(command, engine)];
    }

    case Command.DeadEnd:
      return [deadEndButton(command, controller.undo)];

    case Command.ChooseIncome: {
      return command.data.map((income) => ({
        label: `Income ${income}`,
        command: `${Command.ChooseIncome} ${income}`,
      }));
    }

    case Command.Bid: {
      return command.data.bids.map((pos) => ({
        label: `Bid ${pos.bid[0]} for ${pos.faction}`,
        command: `${Command.Bid} ${pos.faction} $times`,
        times: pos.bid,
      }));
    }

    case Command.FormFederation: {
      return [federationButton(command, engine, controller.highlightHexes, controller.handleCommand, player)];
    }

    case Command.ChooseFederationTile: {
      return [
        {
          label: "Rescore federation",
          command: Command.ChooseFederationTile,
          buttons: federationTypeButtons(command.data.tiles, player),
        },
      ];
    }
  }
}

export function commandButtons(
  commands: AvailableCommand[],
  engine: Engine,
  player: Player,
  controller: CommandController
) {
  const conversions: AvailableConversions = {};
  const ret: ButtonData[] = [];

  for (const command of commands.filter((c) => c.name != Command.ChooseFaction)) {
    ret.push(...commandButton(command, engine, player, commands, conversions, controller));
  }

  if (conversions.free || conversions.burn) {
    controller.subscriptions[Command.Spend]?.();
    controller.subscriptions[Command.Spend] = controller.subscribeAction(({ type, payload }) => {
      if (type === "gaiaViewer/fastConversionClick") {
        const command = fastConversionClick(payload, conversions, player);
        if (command) {
          controller.handleCommand(command);
        }
      }
    });

    const pass = ret.pop();
    const d = freeAndBurnButton(conversions, player);
    ret.push(d.button);
    if (pass) {
      ret.push(pass);
    }

    controller.setFastConversionTooltips(d.tooltips);
    // tooltips may have become unavailable - and they should be hidden
    controller.disableTooltips();
  }

  if (controller.customButtons.length > 0) {
    for (const button of ret) {
      button.hide = true;
    }

    ret.push(...controller.customButtons);
  }

  finalizeShortcuts(ret);

  if (ret.length == 1) {
    const button = ret[0];
    if (button.hexes && !button.hexes.selectAnyHex && !button.warning) {
      activateOnShow(button);
    }
  }
  return ret;
}
