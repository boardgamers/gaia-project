import assert from "assert";
import { AvailableCommand, Offer } from "../available/types";
import Engine from "../engine";
import { Command, Player as PlayerEnum } from "../enums";
import { BrainstoneDest } from "../player-data";
import Reward from "../reward";

export function moveChargePower(
  engine: Engine,
  command: AvailableCommand<Command.ChargePower>,
  player: PlayerEnum,
  income: string
) {
  const leechCommand = command.data;
  // leech rewards are including +t, if needed and in the right sequence
  const leechRewards = Reward.parse(income);

  // Handles legacy stuff. To remove when all games with old engine have ended
  if (!leechCommand.offers) {
    const legacy = leechCommand as any;
    leechCommand.offers = [
      {
        offer: legacy.offer,
        cost: legacy.cost,
      } as Offer,
    ];
  }

  const offer = leechCommand.offers.find((ofr) => ofr.offer === income);

  assert(offer, `Cannot leech ${income}. Possible leeches: ${leechCommand.offers.map((ofr) => ofr.offer).join(" - ")}`);

  engine.player(player).gainRewards(leechRewards, Command.ChargePower);
  engine.player(player).payCosts(Reward.parse(offer.cost), Command.ChargePower);
}

export function moveDecline(engine: Engine, command: AvailableCommand<Command.Decline>, player: PlayerEnum) {
  engine.player(player).declined = true;
}

export function moveBrainStone(
  engine: Engine,
  command: AvailableCommand<Command.BrainStone>,
  player: PlayerEnum,
  dest: BrainstoneDest
) {
  const areas = command.data.choices.map((a) => a.area);
  assert(areas.includes(dest), `Possible brain stone areas: ${areas.join(", ")} - got ${dest}`);
  engine.players[player].data.brainstoneDest = dest;
}
