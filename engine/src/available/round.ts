import Engine from "../engine";
import { Booster, Command, Phase, Player } from "../enums";

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);
  // Future rounds may assume an opponent returns a booster, but only tiles drawn for this game
  // exist. During setup, already chosen boosters cannot become available before our first pick.
  const boosters = engine.isLastRound
    ? []
    : Booster.values(engine.expansions).filter((booster) =>
        pl?.data.analysis && engine.phase !== Phase.SetupBooster
          ? engine.tiles.boosters[booster] !== undefined && booster !== pl.data.tiles.booster
          : engine.tiles.boosters[booster]
      );

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
