import assert from "assert";
import { AvailableCommand } from "../available/types";
import Engine from "../engine";
import { AnyTechTilePos, Command, Player as PlayerEnum, ResearchField, SubPhase, TechTilePos } from "../enums";
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
  pos: AnyTechTilePos
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
  engine.tiles.techs[pos].count -= 1;

  // AFTER gaining the tech tile (as green federation can be flipped and lock research tracks)
  engine.processNextMove(
    SubPhase.UpgradeResearch,
    ResearchField.values(engine.expansions).includes((pos as any) as ResearchField) ? { pos } : undefined
  );
}

export function moveChooseCoverTechTile(
  engine: Engine,
  command: AvailableCommand<Command.ChooseCoverTechTile>,
  player: PlayerEnum,
  tilePos: TechTilePos
) {
  const { tiles } = command.data;
  const tileAvailable = tiles.find((ta) => ta.pos === tilePos);

  assert(tileAvailable !== undefined, `Impossible to cover ${tilePos} tile`);
  // remove tile
  engine.player(player).coverTechTile(tileAvailable.pos);
}
