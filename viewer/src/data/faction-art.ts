import ambas from "../assets/factions/ambas.jpg";
import baltaks from "../assets/factions/baltaks.jpg";
import bescods from "../assets/factions/bescods.jpg";
import darkanians from "../assets/factions/darkanians.jpg";
import firaks from "../assets/factions/firaks.jpg";
import geodens from "../assets/factions/geodens.jpg";
import gleens from "../assets/factions/gleens.jpg";
import hadschHallas from "../assets/factions/hadsch-hallas.jpg";
import itars from "../assets/factions/itars.jpg";
import ivits from "../assets/factions/ivits.jpg";
import lantids from "../assets/factions/lantids.jpg";
import mowyeds from "../assets/factions/mowyeds.jpg";
import nevlas from "../assets/factions/nevlas.jpg";
import spaceGiants from "../assets/factions/space-giants.jpg";
import taklons from "../assets/factions/taklons.jpg";
import terrans from "../assets/factions/terrans.jpg";
import tinkeroids from "../assets/factions/tinkeroids.jpg";
import xenos from "../assets/factions/xenos.jpg";
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
