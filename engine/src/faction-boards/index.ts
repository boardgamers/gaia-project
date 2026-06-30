import { maxBy } from "lodash";
import { FactionCustomization, FactionVariant } from "../engine";
import { Faction } from "../enums";
import Ambas from "./ambas";
import BalTaks from "./baltaks";
import Bescods from "./bescods";
import Darkanians from "./darkanians";
import Firaks from "./firaks";
import Geodens from "./geodens";
import Gleens from "./gleens";
import HadschHallas from "./hadsch-hallas";
import Itars from "./itars";
import Ivits from "./ivits";
import Lantids from "./lantids";
import Moweyds from "./moweyds";
import Nevlas from "./nevlas";
import SpaceGiants from "./space-giants";
import Taklons from "./taklons";
import Terrans from "./terrans";
import Tinkeroids from "./tinkeroids";
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
  [Faction.Tinkeroids]: Tinkeroids,
  [Faction.Darkanians]: Darkanians,
  [Faction.Moweyds]: Moweyds,
  [Faction.SpaceGiants]: SpaceGiants,
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
