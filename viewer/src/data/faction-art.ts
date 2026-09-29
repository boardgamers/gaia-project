import ambas from "../assets/factions/ambas.jpg?no-inline";
import baltaks from "../assets/factions/baltaks.jpg?no-inline";
import bescods from "../assets/factions/bescods.jpg?no-inline";
import darkanians from "../assets/factions/darkanians.jpg?no-inline";
import firaks from "../assets/factions/firaks.jpg?no-inline";
import geodens from "../assets/factions/geodens.jpg?no-inline";
import gleens from "../assets/factions/gleens.jpg?no-inline";
import hadschHallas from "../assets/factions/hadsch-hallas.jpg?no-inline";
import itars from "../assets/factions/itars.jpg?no-inline";
import ivits from "../assets/factions/ivits.jpg?no-inline";
import lantids from "../assets/factions/lantids.jpg?no-inline";
import mowyeds from "../assets/factions/mowyeds.jpg?no-inline";
import nevlas from "../assets/factions/nevlas.jpg?no-inline";
import spaceGiants from "../assets/factions/space-giants.jpg?no-inline";
import taklons from "../assets/factions/taklons.jpg?no-inline";
import terrans from "../assets/factions/terrans.jpg?no-inline";
import tinkeroids from "../assets/factions/tinkeroids.jpg?no-inline";
import xenos from "../assets/factions/xenos.jpg?no-inline";
export const factionArt: Record<string, string> = {
  terrans: terrans,
  lantids: lantids,
  xenos: xenos,
  gleens: gleens,
  taklons: taklons,
  ambas: ambas,
  "hadsch-hallas": hadschHallas,
  ivits: ivits,
  geodens: geodens,
  baltaks: baltaks,
  firaks: firaks,
  bescods: bescods,
  itars: itars,
  nevlas: nevlas,
  darkanians: darkanians,
  tinkeroids: tinkeroids,
  moweyds: mowyeds,
  "space-giants": spaceGiants,
};

export function factionPortraitHtml(faction: string, size = 24): string {
  const src = factionArt[faction];
  return src
    ? `<span aria-hidden="true" style="display:inline-block;width:${size}px;height:${size}px;overflow:hidden;border-radius:50%;vertical-align:middle;margin:0 5px"><img src="${src}" alt="" style="height:100%;width:234%;max-width:none;transform:translateX(-3.4%)"></span>`
    : "";
}
