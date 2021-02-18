import { Faction } from "../enums";
import Terrans from "./terrans";
import Lantids from "./lantids";
import Xenos from "./xenos";
import Gleens from "./gleens";
import Taklons from "./taklons";
import Ambas from "./ambas";
import HadschHallas from "./hadsch-hallas";
import Ivits from "./ivits";
import Geodens from "./geodens";
import BalTaks from "./baltaks";
import Firaks from "./firaks";
import Bescods from "./bescods";
import Nevlas from "./nevlas";
import Itars from "./itars";
import { FactionBoard, FactionBoardRaw } from "./types";
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
