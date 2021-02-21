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
import { FactionBoard, FactionBoardRaw } from "./types";
import Xenos from "./xenos";
export { FactionBoard, FactionBoardRaw } from "./types";

const factionBoards: { [key in Faction]: FactionBoardRaw } = {
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

export default factionBoards;

export function factionBoard(faction: Faction) {
  return new FactionBoard(factionBoards[faction]);
}
