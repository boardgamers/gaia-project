import { Building, Faction } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { isNewLostFleetSector } from "../lost-fleet-map";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

function gainSectorBonus(player: Player, hex: GaiaHex) {
  if (player.data.hasPlanetaryInstitute() && isNewLostFleetSector(player.data.occupied, hex)) {
    player.gainRewards(Reward.parse("2c,1k"), Faction.Darkanians);
  }
}

const darkanians: FactionBoardVariants = {
  faction: Faction.Darkanians,
  standard: {
    income: ["3k,7o,15c,q,up-nav,up-eco", "+o,k"],
    power: {
      area1: 4,
      area2: 2,
    },
    handlers: {
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => gainSectorBonus(player, hex),
    },
  },
};

export default darkanians;
