import assert from "assert";
import { range } from "lodash";
import Engine, { AuctionVariant, LEECHING_DISTANCE } from "../engine";
import {
  BoardAction,
  Building,
  Command,
  Faction,
  Operator,
  Phase,
  Planet,
  Player as PlayerEnum, ResearchField, Resource,
  SubPhase,
} from "../enums";
import { initCustomSetup, possibleSetupBoardActions } from "../setup";
import { moveInit } from "./setup";
import { factionVariantBoard } from "../faction-boards";
import { finalRankings, gainFinalScoringVictoryPoints } from "../algorithms/scoring";
import Reward from "../reward";
import Player from "../player";
import { stdBuildingValue } from "../buildings";
import * as researchTracks from "../research-tracks";
import { GaiaHex } from "../gaia-hex";

export function phaseSetupInit(engine: Engine, move: string) {
  const split = move.split(" ");
  const command = split.shift() as Command;

  assert(command === Command.Init, "The first command of a game needs to be the initialization command");

  const players = split.shift();
  moveInit(engine, +players || 2, split.shift() || "defaultSeed");

  beginSetupBoardPhase(engine);
}

export function phaseSetupBoard(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });

  if (possibleSetupBoardActions(engine, engine.currentPlayer).length === 0 || move.includes(Command.RotateSectors)) {
    beginSetupFactionPhase(engine);
  }
}

export function phaseSetupFaction(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  // Legacy: there might be a few games that ended up in the 4.7.0 <= version < 4.8.0 state.
  if (engine.isVersionOrLater("4.7.0") && engine.options.auction !== AuctionVariant.ChooseBid) {
    moveToNextPlayerWithoutAChosenFaction(engine);
    return;
  }
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    if (engine.options.auction) {
      beginSetupAuctionPhase(engine);
    } else {
      endSetupFactionPhase(engine);
    }
  }
}

export function phaseSetupAuction(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { processFirst: true });
  moveToNextPlayerWithoutAChosenFaction(engine);
}

function moveToNextPlayerWithoutAChosenFaction(engine: Engine) {
  const player = [...range(engine.currentPlayer + 1, engine.players.length), ...range(0, engine.currentPlayer)].find(
    (player) => !engine.players.some((pl) => pl.player === player && pl.faction)
  );

  if (player !== undefined) {
    engine.currentPlayer = player;
  } else {
    endSetupFactionPhase(engine);
  }
}

export function phaseSetupBuilding(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });

  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    beginSetupBoosterPhase(engine);
  }
}

export function phaseSetupBooster(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });

  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    beginRoundStartPhase(engine);
  }
}

export function phaseRoundIncome(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { processFirst: true });

  while (!handleNextIncome(engine)) {
    engine.generateAvailableCommands();
    engine.processNextMove();
  }
}

export function phaseRoundGaia(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { processFirst: true });

  while (!handleNextGaia(engine, true)) {
    engine.generateAvailableCommands();
    engine.processNextMove();
  }
}

export function phaseRoundMove(engine: Engine, move: string) {
  const pl = engine.player(engine.playerToMove);
  pl.data.turns = 1;

  engine.loadTurnMoves(move);

  const playerAfter = engine.getNextPlayer();

  while (pl.data.turns > 0) {
    pl.resetTemporaryVariables();

    // Execute all upcoming freeactions
    engine.doFreeActions(SubPhase.BeforeMove);

    // If queue is empty, interrupt and ask for free actions / main command
    // otherwise execute main command
    const executedCommand = engine.handleMainMove();
    pl.resetTemporaryVariables();
    pl.data.turns -= 1;

    if (executedCommand === Command.Pass) {
      if (engine.turnOrder.length === 0) {
        cleanUpPhase(engine);
        return;
      } else {
        break;
      }
    } else if (pl.data.turns <= 0) {
      // Execute all upcoming freeactions
      engine.doFreeActions(SubPhase.AfterMove);

      // If the player has no possible command or the queue has the end turn command,
      // end turns.
      // If the player has possible free actions & the queue is empty, ask for free actions / end turn
      engine.handleEndTurn();
    } else {
      engine.generateAvailableCommands();
    }
  }

  beginLeechingPhase(engine);
  engine.currentPlayer = playerAfter;
}

export function phaseRoundLeech(engine: Engine, move: string) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  engine.tempCurrentPlayer = engine.tempTurnOrder.shift();

  // Current leech round ended
  if (engine.tempCurrentPlayer === undefined) {
    // Next leech rounds (eg: double leech happens with lab + lost planet in same turn)
    beginLeechingPhase(engine);
  }
}

function beginSetupBoardPhase(engine: Engine) {
  engine.changePhase(Phase.SetupBoard);

  if (engine.options.customBoardSetup) {
    initCustomSetup(engine);

    // The creator does board setup and rotation
    engine.currentPlayer = engine.players[engine.options.creator ?? 0].player;
  } else if (engine.options.advancedRules) {
    // The last player is the one to rotate the sectors
    engine.currentPlayer = engine.players.slice(-1).pop().player;
  } else {
    beginSetupFactionPhase(engine);
  }
}

function beginSetupFactionPhase(engine: Engine) {
  engine.changePhase(Phase.SetupFaction);
  engine.turnOrder = engine.players.map((pl) => pl.player as PlayerEnum);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}

function beginSetupAuctionPhase(engine: Engine) {
  engine.changePhase(Phase.SetupAuction);
  engine.turnOrder = engine.players.map((pl) => pl.player as PlayerEnum);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}

function endSetupFactionPhase(engine: Engine) {
  for (const pl of engine.players) {
    if (!pl.faction) {
      pl.faction = engine.setup[pl.player as PlayerEnum];
    }
    const faction = pl.faction;
    const board = pl.variant ?? factionVariantBoard(engine.factionCustomization, faction);
    pl.loadFaction(board, engine.expansions);
  }

  beginSetupBuildingPhase(engine);
}

function beginSetupBuildingPhase(engine: Engine) {
  engine.changePhase(Phase.SetupBuilding);

  const posIvits = engine.players.findIndex((player) => player.faction === Faction.Ivits);

  const setupTurnOrder = engine.turnOrderAfterSetupAuction.filter((i) => i !== posIvits);
  const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
  engine.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

  const posXenos = engine.players.findIndex((player) => player.faction === Faction.Xenos);

  if (posXenos !== -1) {
    engine.turnOrder.push(posXenos as PlayerEnum);
  }

  if (posIvits !== -1) {
    if (engine.players.length === 2 && engine.factionCustomization.variant === "more-balanced") {
      const first = engine.turnOrder.shift();
      engine.turnOrder.unshift(posIvits as PlayerEnum);
      engine.turnOrder.unshift(first);
    } else {
      engine.turnOrder.push(posIvits as PlayerEnum);
    }
  }

  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}

function beginSetupBoosterPhase(engine: Engine) {
  engine.changePhase(Phase.SetupBooster);
  engine.turnOrder = engine.turnOrderAfterSetupAuction.reverse();
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}

function beginRoundStartPhase(engine: Engine) {
  engine.round += 1;
  engine.addAdvancedLog({ round: engine.round });
  engine.turnOrder = engine.passedPlayers || engine.turnOrderAfterSetupAuction;
  engine.passedPlayers = [];
  engine.currentPlayer = engine.turnOrder[0];

  for (const player of engine.playersInOrder()) {
    player.loadEvents(engine.currentRoundScoringEvents);
    player.data.ships?.forEach((s) => {
      s.moved = false;
    });
  }

  beginIncomePhase(engine);
}

/**
 * Handle income phase of current player, and the one after that and so on.
 * Pauses if an action is needed from the player.
 */
function handleNextIncome(engine: Engine) {
  const pl = engine.player(engine.currentPlayer);
  if (pl.incomeSelection().needed) {
    return false;
  }

  pl.receiveIncome(pl.events[Operator.Income]);

  if (!engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false })) {
    endIncomePhase(engine);
  } else {
    handleNextIncome(engine);
  }

  return true;
}

function handleNextGaia(engine: Engine, afterCommand = false) {
  const player = engine.player(engine.currentPlayer);

  if (!afterCommand) {
    // The player didn't have a chance to decline their gaia action yet
    player.declined = false;
  }

  if (!player.declined && (player.canGaiaTerrans() || player.canGaiaItars())) {
    return false;
  }

  player.gaiaPhase();

  if (!engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false })) {
    endGaiaPhase(engine);
  } else {
    handleNextGaia(engine);
  }

  return true;
}

function beginIncomePhase(engine: Engine) {
  engine.changePhase(Phase.RoundIncome);
  engine.addAdvancedLog({ phase: Phase.RoundIncome });
  engine.tempTurnOrder = [...engine.turnOrder];

  engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false });
  handleNextIncome(engine);
}

function endIncomePhase(engine: Engine) {
  // remove incomes from roundboosters
  for (const player of engine.playersInOrder()) {
    player.removeRoundBoosterEvents(Operator.Income);
  }

  beginGaiaPhase(engine);
}

function beginGaiaPhase(engine: Engine) {
  engine.changePhase(Phase.RoundGaia);
  engine.addAdvancedLog({ phase: Phase.RoundGaia });
  engine.tempTurnOrder = [...engine.turnOrder];

  // transform Transdim planets into Gaia if gaiaformed
  for (const hex of engine.map.toJSON()) {
    if (
      hex.data.planet === Planet.Transdim &&
      hex.data.player !== undefined &&
      hex.data.building === Building.GaiaFormer
    ) {
      hex.data.planet = Planet.Gaia;
    }
  }

  engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false });
  handleNextGaia(engine);
}

function endGaiaPhase(engine: Engine) {
  engine.currentPlayer = engine.turnOrder[0];
  beginRoundMovePhase(engine);
}

function beginRoundMovePhase(engine: Engine) {
  engine.changePhase(Phase.RoundMove);
}

function cleanUpPhase(engine: Engine) {
  for (const player of engine.players) {
    // remove roundScoringTile
    player.removeEvents(engine.currentRoundScoringEvents);

    // resets special action
    for (const event of player.events[Operator.Activate]) {
      event.activated = false;
    }
  }
  // resets power and qic actions
  BoardAction.values(engine.expansions).forEach((pos: BoardAction) => {
    engine.boardActions[pos] = null;
  });

  if (engine.isLastRound) {
    finalScoringPhase(engine);
  } else {
    beginRoundStartPhase(engine);
  }
}

function finalScoringPhase(engine: Engine) {
  engine.changePhase(Phase.EndGame);
  engine.addAdvancedLog({ phase: Phase.EndGame });
  engine.currentPlayer = engine.tempCurrentPlayer = undefined;
  const allRankings = finalRankings(engine.tiles.scorings.final, engine.players);

  // Group gained points per player
  for (const player of engine.players) {
    gainFinalScoringVictoryPoints(allRankings, player);

    player.data.gainResearchVictoryPoints();

    player.data.finalResourceHandling();

    //remove bids
    player.gainRewards([new Reward(Math.max(Math.floor(-1 * player.data.bid)), Resource.VictoryPoint)], Command.Bid);
  }
}

function beginLeechingPhase(engine: Engine) {
  if (engine.leechSources.length === 0) {
    beginRoundMovePhase(engine);
    return;
  }
  const source = engine.leechSources.shift();
  const sourceHex = engine.map.getS(source.coordinates);
  const canLeechPlayers: Player[] = [];

  engine.lastLeechSource = source;

  // Gaia-formers & space stations don't trigger leech
  if (stdBuildingValue(sourceHex.buildingOf(source.player)) === 0) {
    return beginLeechingPhase(engine); // next building on the list
  }
  // From rules, engine is in clockwise order. We assume the order of players in engine.players is the
  // clockwise order
  for (const pl of engine.playersInTableOrderFrom(source.player)) {
    // If pl is the one that made the building, exclude from leeching
    if (source.player === pl.player) {
      pl.data.leechPossible = 0;
      continue;
    }
    // Do not use PlayerData.maxLeech() here, cuz taklons
    pl.data.leechPossible = leechPossible(engine, sourceHex, (hex) => pl.buildingValue(engine.map.grid.get(hex)));
    if (pl.canLeech()) {
      canLeechPlayers.push(pl);
    }
  }

  if (canLeechPlayers.length > 0) {
    engine.changePhase(Phase.RoundLeech);
    engine.tempTurnOrder = canLeechPlayers.map((pl) => pl.player);
    engine.tempCurrentPlayer = engine.tempTurnOrder.shift();
  } else {
    return beginLeechingPhase(engine);
  }
}

export function leechPossible(engine: Engine, sourceHex: GaiaHex, buildingValue: (GaiaHex) => number) {
  let leech = 0;
  for (const hex of engine.map.withinDistance(sourceHex, LEECHING_DISTANCE)) {
    leech = Math.max(leech, buildingValue(hex));
  }
  return leech;
}

export function advanceResearchAreaPhase(engine: Engine, player: PlayerEnum, cost: string, field: ResearchField) {
  const pl = engine.player(player);

  if (!pl.canUpgradeResearch(field)) {
    return;
  }

  const destTile = pl.data.research[field] + 1;

  // If someone is already on last tile
  if (destTile === researchTracks.lastTile(field)) {
    if (engine.players.some((pl2) => pl2.data.research[field] === destTile)) {
      return;
    }
  }

  pl.payCosts(Reward.parse(cost), Command.UpgradeResearch);
  pl.gainRewards([new Reward(`${Command.UpgradeResearch}-${field}`)], Command.UpgradeResearch);

  if (pl.data.research[field] === researchTracks.lastTile(field)) {
    if (field === ResearchField.Terraforming) {
      // gets federation token
      if (engine.terraformingFederation) {
        pl.gainFederationToken(engine.terraformingFederation);
        engine.terraformingFederation = undefined;
      }
    } else if (field === ResearchField.Navigation) {
      // gets LostPlanet
      engine.processNextMove(SubPhase.PlaceLostPlanet);
    }
  }
}
