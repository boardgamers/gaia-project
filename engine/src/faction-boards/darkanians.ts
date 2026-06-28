import { Building, Faction } from "../enums";
import { GaiaHex } from "../gaia-hex";
import { classifySectorId, LostFleetSectorType } from "../lost-fleet-map";
import Player from "../player";
import Reward from "../reward";
import { FactionBoardVariants } from "./types";

function logicalSectorId(hex: GaiaHex): string | null {
  const sectorType = classifySectorId(hex.data.sector);

  if (sectorType === LostFleetSectorType.Interspace) {
    return null;
  }

  if (sectorType === LostFleetSectorType.DeepSpace) {
    return hex.data.sector.split("_")[0];
  }

  return hex.data.sector;
}

function gainSectorColonizationReward(player: Player, hex: GaiaHex) {
  if (!player.data.hasPlanetaryInstitute()) {
    return;
  }

  const sectorId = logicalSectorId(hex);
  if (!sectorId) {
    return;
  }

  const firstColonizationInSector = player.data.occupied.every(
    (occupiedHex) => occupiedHex === hex || logicalSectorId(occupiedHex) !== sectorId
  );

  if (firstColonizationInSector) {
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
      [`build-${Building.Mine}`]: (player: Player, hex: GaiaHex) => gainSectorColonizationReward(player, hex),
      [`build-${Building.Colony}`]: (player: Player, hex: GaiaHex) => gainSectorColonizationReward(player, hex),
    },
  },
};

export default darkanians;
