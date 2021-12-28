import Engine from "../engine";
import { Command, Faction, Player, Resource } from "../enums";
import Reward from "../reward";
import { Offer } from "./types";

export function possibleLeech(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if (pl.data.leechPossible > 0) {
    const extraPower = pl.faction === Faction.Taklons && pl.data.hasPlanetaryInstitute();
    const maxLeech = pl.maxLeech();
    const offers: Offer[] = [];

    if (extraPower) {
      offers.push(...getTaklonsExtraLeechOffers(maxLeech, pl.maxLeech(true)));
    } else {
      offers.push(
        new Offer(
          `${maxLeech}${Resource.ChargePower}`,
          new Reward(Math.max(maxLeech - 1, 0), Resource.VictoryPoint).toString()
        )
      );
    }

    [Command.ChargePower, Command.Decline].map((name) =>
      commands.push({
        name,
        player,
        data: {
          // Kept for compatibility with older viewer
          offer: offers[0].offer,
          // Kept for compatibility with older viewer
          cost: offers[0].cost,
          // new format
          offers,
        },
      })
    );
  }

  return commands;
}

export function getTaklonsExtraLeechOffers(earlyLeechValue: number, lateLeechValue: number): Offer[] {
  const earlyLeech = new Offer(
    `${earlyLeechValue}${Resource.ChargePower},1t`,
    new Reward(Math.max(earlyLeechValue - 1, 0), Resource.VictoryPoint).toString()
  );
  const lateLeech = new Offer(
    `1t,${lateLeechValue}${Resource.ChargePower}`,
    new Reward(Math.max(lateLeechValue - 1, 0), Resource.VictoryPoint).toString()
  );

  return [earlyLeech, lateLeech];
}
