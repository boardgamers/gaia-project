import Engine from "../engine";
import { Booster, Command, Phase, Player } from "../enums";

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const boosters = engine.isLastRound
    ? []
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
      data: s.descriptions,
    });
  }
  return commands;
}
