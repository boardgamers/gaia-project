import Engine from "../engine";
import { Booster, Command, Phase, Player } from "../enums";

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);
  // Analysis mode (docs/lost-fleet/ANALYSIS_MODE_PLAN.md §4.5, decision #11): boosters are a shared,
  // single-use pool, but with opponents frozen the sandbox can't know which ones they'd have taken
  // first, so it assumes every booster is still up for grabs - except the one this seat is currently
  // holding, which obviously can't be picked again.
  const boosters = engine.isLastRound
    ? []
    : pl?.data.analysis
    ? Booster.values(engine.expansions).filter((booster) => booster !== pl.data.tiles.booster)
    : Booster.values(engine.expansions).filter((booster) => engine.tiles.boosters[booster]);

  commands.push({
    name: engine.phase === Phase.SetupBooster ? Command.ChooseRoundBooster : Command.Pass,
    player,
    data: { boosters },
  });

  return commands;
}

export function possibleIncomes(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  const s = pl.incomeSelection();

  if (s.needed) {
    commands.push({
      name: Command.ChooseIncome,
      player,
      data: s.descriptions.map((d) => d.toString()),
    });
  }
  return commands;
}
