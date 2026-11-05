import Engine from "../engine";
import { Booster, Command, Phase, Player } from "../enums";

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);
  // An opponent still playing may return their old booster before our planned pass. An opponent
  // who already passed has reserved their NEW booster for next round; that choice is no longer
  // hypothetical. passedPlayers resets at the round boundary, so this is not a permanent ban.
  // During setup, already chosen boosters cannot become available before our first pick.
  const reserved = (engine.passedPlayers ?? []).map((seat) => engine.player(seat).data.tiles.booster);
  const boosters = engine.isLastRound
    ? []
    : Booster.values(engine.expansions).filter((booster) =>
        pl?.data.analysis && engine.phase !== Phase.SetupBooster
          ? engine.tiles.boosters[booster] !== undefined &&
            booster !== pl.data.tiles.booster &&
            !reserved.includes(booster)
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
