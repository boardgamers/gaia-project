import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import {
  AnyTechTilePos,
  Command,
  Player as PlayerEnum,
  ResearchField,
  Spaceship,
  SpaceshipTechTile,
  SubPhase,
  TechTilePos,
} from "../enums";
import { isAdvanced } from "../tiles/techs";
import { advanceResearchAreaPhase } from "./phase";

export function moveResearch(
  engine: Engine,
  command: AvailableCommand<Command.UpgradeResearch>,
  player: PlayerEnum,
  field: ResearchField
) {
  const { tracks } = command.data;
  const track = tracks.find((tr) => tr.field === field);

  assert(track, `Impossible to upgrade research for ${field}`);

  advanceResearchAreaPhase(engine, player, track.cost, field);
}

export function moveChooseTechTile(
  engine: Engine,
  command: AvailableCommand<Command.ChooseTechTile>,
  player: PlayerEnum,
  pos: AnyTechTilePos | Spaceship
) {
  const { tiles } = command.data;
  const tileAvailable = tiles.find((ta) => ta.pos === pos);

  assert(tileAvailable !== undefined, `Impossible to get ${pos} tile`);

  // BEFORE gaining the tech tile (e.g. the ship+move tech tile can generate trade, and so the tech tile
  // with trade >> 2vp needs to be covered before)
  if (isAdvanced(pos)) {
    engine.processNextMove(SubPhase.CoverTechTile);
  }

  engine.player(player).gainTechTile(tileAvailable);
  if (Spaceship.values(engine.expansions).includes(pos as Spaceship)) {
    const shipTech = engine.tiles.spaceshipTechs[pos as Spaceship];
    assert(shipTech !== undefined && shipTech.count > 0, `Impossible to get ${pos} spaceship tech tile`);
    shipTech.count -= 1;
    if (shipTech.count === 0) {
      delete engine.tiles.spaceshipTechs[pos as Spaceship];
    }
  } else {
    engine.tiles.techs[pos as AnyTechTilePos].count -= 1;
  }

  if (tileAvailable.tile === SpaceshipTechTile.Terraform) {
    engine.processNextMove(SubPhase.SpaceshipTechTileBuildMine, null, false);
  }

  // AFTER gaining the tech tile (as green federation can be flipped and lock research tracks)
  engine.processNextMove(
    SubPhase.UpgradeResearch,
    ResearchField.values(engine.expansions).includes(pos as any as ResearchField) ? { pos } : undefined
  );
}

export function moveChooseCoverTechTile(
  engine: Engine,
  command: AvailableCommand<Command.ChooseCoverTechTile>,
  player: PlayerEnum,
  tilePos: TechTilePos | Spaceship
) {
  const { tiles } = command.data;
  const tileAvailable = tiles.find((ta) => ta.pos === tilePos);

  assert(tileAvailable !== undefined, `Impossible to cover ${tilePos} tile`);
  // remove tile
  engine.player(player).coverTechTile(tileAvailable.pos);
}
