import { maxBy } from "lodash";
import { FactionCustomization, FactionVariant } from "../engine";
import { Faction } from "../enums";
import Ambas from "./ambas";
import BalTaks from "./baltaks";
import Bescods from "./bescods";
import Firaks from "./firaks";
import Geodens from "./geodens";
import Gleens from "./gleens";
import HadschHallas from "./hadsch-hallas";
import Itars from "./itars";
import Ivits from "./ivits";
import Lantids from "./lantids";
import Nevlas from "./nevlas";
import Taklons from "./taklons";
import Terrans from "./terrans";
import { FactionBoard, FactionBoardRaw, FactionBoardVariant, FactionBoardVariants } from "./types";
import Xenos from "./xenos";

export { FactionBoard, FactionBoardRaw } from "./types";

const factionBoards: { [key in Faction]: FactionBoardVariants } = {
  [Faction.Terrans]: Terrans,
  [Faction.Lantids]: Lantids,
  [Faction.Xenos]: Xenos,
  [Faction.Gleens]: Gleens,
  [Faction.Taklons]: Taklons,
  [Faction.Ambas]: Ambas,
  [Faction.HadschHallas]: HadschHallas,
  [Faction.Ivits]: Ivits,
  [Faction.Geodens]: Geodens,
  [Faction.BalTaks]: BalTaks,
  [Faction.Firaks]: Firaks,
  [Faction.Bescods]: Bescods,
  [Faction.Nevlas]: Nevlas,
  [Faction.Itars]: Itars,
};

export function factionVariantBoard(customization: FactionCustomization, faction: Faction): FactionBoardVariant | null {
  if (!customization) {
    //not present in cloning
    return null;
  }

  const variants = factionBoards[faction].variants;
  if (customization.variant === "standard" || !variants) {
    return null;
  }

  const matchVariant = (v: { type: FactionVariant; version: number }) =>
    v.type === customization.variant && v.version <= customization.version;

  const byPlayerCount = variants.filter((v) => matchVariant(v) && v.players === customization.players);
  if (byPlayerCount.length) {
    return maxBy(byPlayerCount, "version");
  }

  const byType = variants.filter((v) => matchVariant(v) && !("players" in v));
  if (byType.length) {
    return maxBy(byType, "version");
  }
  return null;
}

export function latestVariantVersion(variant: FactionVariant) {
  return Math.max(
    ...Object.values(factionBoards)
      .flatMap((x) => x.variants?.filter((x) => x.type === variant))
      .filter(Boolean)
      .map((x) => x.version ?? 0),
    0
  );
}

export function factionBoard(faction: Faction, variant?: FactionBoardRaw): FactionBoard {
  return new FactionBoard(factionBoards[faction], variant);
}

export function serializeFactionVariant(variant?: FactionBoardRaw) {
  if (!variant) {
    return variant;
  }

  const data = JSON.parse(JSON.stringify(variant));

  if (variant?.handlers) {
    for (const [event, handler] of Object.entries(variant.handlers)) {
      data.handlers[event] = handler.toString().replace(/\r/g, "") as any;
    }
  }

  return data;
}

export function deserializeFactionVariant(variant?: FactionBoardRaw) {
  if (!variant?.handlers) {
    return variant;
  }

  for (const [event, handler] of Object.entries(variant.handlers)) {
    if (typeof handler === "string") {
      variant.handlers[event] = (0, eval)(handler);
    }
  }
  return variant;
}
