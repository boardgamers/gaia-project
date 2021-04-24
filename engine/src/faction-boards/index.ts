import { FactionCustomization } from "../engine";
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
import { FactionBoard, FactionBoardRaw, FactionBoardVariants } from "./types";
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

export function factionVariantBoard(customization: FactionCustomization, faction: Faction): FactionBoardRaw | null {
  if (customization == null) {
    //not present in cloning
    return null;
  }

  const variants = factionBoards[faction].variants;
  if (customization.variant == "standard" || variants == null) {
    return null;
  }

  const byPlayerCount = variants.find((v) => v.type == customization.variant && v.players == customization.players);
  if (byPlayerCount != null) {
    return byPlayerCount.board;
  }

  const byType = variants.find((v) => v.type == customization.variant && !("players" in v));
  if (byType != null) {
    return byType.board;
  }
  return null;
}

export function factionBoard(faction: Faction, variant?: FactionBoardRaw): FactionBoard {
  return new FactionBoard(factionBoards[faction], variant);
}
