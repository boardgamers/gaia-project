import { Command, Faction, Building, Planet, Booster, Resource, Player, Operator, BoardAction, ResearchField, TechTilePos, AdvTechTilePos, Phase, SubPhase } from './enums';
import Engine from './engine';
import * as _ from 'lodash';
import factions from './factions';
import { upgradedBuildings } from './buildings';
import Reward from './reward';
import { boardActions, freeActions, freeActionsTerrans, freeActionsItars } from './actions';
import * as researchTracks from './research-tracks';
import { isAdvanced } from './tiles/techs';


const ISOLATED_DISTANCE = 3;
const UPGRADE_RESEARCH_COST = "4k";
const QIC_RANGE_UPGRADE = 2;

export default interface AvailableCommand {
  name: Command;
  data?: any;
  player?: number;
}

export function generate(engine: Engine, subPhase: SubPhase = null, data?: any): AvailableCommand[] {
  const player = engine.playerToMove;

  if (engine.phase === Phase.RoundMove && !subPhase) {
    subPhase = SubPhase.BeforeMove;
  }

  switch (subPhase) {
    case SubPhase.ChooseTechTile: return possibleTechTiles(engine, player);
    case SubPhase.CoverTechTile: return possibleCoverTechTiles(engine, player);
    case SubPhase.UpgradeResearch: return possibleResearchAreas(engine, player, "", data);
    case SubPhase.PlaceLostPlanet: return possibleSpaceLostPlanet(engine, player);
    case SubPhase.ChooseFederationTile: return possibleFederationTiles(engine, player, "pool");
    case SubPhase.RescoreFederationTile: return possibleFederationTiles(engine, player, "player");
    case SubPhase.BuildMine: return possibleMineBuildings(engine, player, false);
    case SubPhase.BuildMineOrGaiaFormer: return possibleMineBuildings(engine, player, true);
    case SubPhase.SpaceStation: return possibleSpaceStations(engine, player);
    case SubPhase.PISwap: return possiblePISwaps(engine, player);
    case SubPhase.DowngradeLab: return possibleLabDowngrades(engine, player);
    case SubPhase.BrainStone: return [{name: Command.BrainStone, player, data}];
    case SubPhase.BeforeMove: {
      return [
        ...possibleBuildings(engine, player),
        ...possibleFederations(engine, player),
        ...possibleResearchAreas(engine, player, UPGRADE_RESEARCH_COST),
        ...possibleBoardActions(engine, player),
        ...possibleSpecialActions(engine, player),
        ...possibleFreeActions(engine, player),
        ...possibleRoundBoosters(engine, player)
      ];
    }
    case SubPhase.AfterMove: return [...possibleFreeActions(engine, player), {name: Command.EndTurn, player}];
  }

  switch (engine.phase) {
    case Phase.SetupInit: return [{ name: Command.Init }];
    case Phase.SetupBoard: return [{name: Command.RotateSectors, player}];
    case Phase.SetupFaction: return [
      {
        name: Command.ChooseFaction,
        player,
        data: _.difference(
          Object.values(Faction),
          engine.players.map(pl => pl.faction),
          engine.players.map(pl => factions.opposite(pl.faction))
        )
      }
    ];
    case Phase.SetupBuilding: {
      const planet = engine.player(player).planet;
      const buildings = [];

      for (const hex of engine.map.toJSON()) {
        if (hex.data.planet === planet && !hex.data.building) {
          buildings.push({
            building:
              engine.player(player).faction !== Faction.Ivits
                ? Building.Mine
                : Building.PlanetaryInstitute,
            coordinates: hex.toString(),
            cost: '~'
          });
        }
      }

      return [{name: Command.Build, player, data: { buildings }}];
    }
    case Phase.SetupBooster: return possibleRoundBoosters(engine, player);
    case Phase.RoundIncome: return possibleIncomes(engine, player);
    case Phase.RoundGaia: return possibleGaiaFreeActions(engine, player);
    case Phase.RoundLeech: return possibleLeech(engine, player);
  }

  return [];
}

export function possibleBuildings(engine: Engine, player: Player) {
  const map = engine.map;
  const pl = engine.player(player);
  const {data} = pl;
  const buildings = [];

  for (const hex of engine.map.toJSON()) {
    // upgrade existing player's building
    if (hex.buildingOf(player)) {
      const building = hex.buildingOf(player);

      if (player !== hex.data.player) {
        // This is a secondary building, so we can't upgrade it
        continue;
      }

      // excluding Transdim planet until transformed into Gaia planets
      if (hex.data.planet === Planet.Transdim) {
        continue;
      }

      // Lost planet can't be upgraded
      if (hex.data.planet === Planet.Lost) {
        continue;
      }

      const isolated = (() => {
        // We only care about mines that can transform into trading stations;
        if (building !== Building.Mine) {
          return true;
        }

        // Check each other player to see if there's a building in range
        for (const _pl of engine.players) {
          if (_pl !== engine.player(player)) {
            for (const loc of _pl.data.occupied) {
              if (loc.hasStructure() && map.distance(loc, hex) < ISOLATED_DISTANCE) {
                return false;
              }
            }
          }
        }

        return true;
      })();

      const upgraded = upgradedBuildings(building, engine.player(player).faction);

      for (const upgrade of upgraded) {
        const {cost, possible} = engine.player(player).canBuild(hex.data.planet, upgrade, {isolated, existingBuilding: building});
        if (possible) {
          buildings.push({
            building: upgrade,
            cost: Reward.toString(cost),
            coordinates: hex.toString(),
            upgrade: true
          });
        }
      }
    } else if (pl.canOccupy(hex)) {
      // planet without building
      // Check if the range is enough to access the planet
      const distance = _.min(data.occupied.filter(loc => loc.isRangeStartingPoint(player)).map(loc => map.distance(hex, loc)));
      const qicNeeded = Math.max(Math.ceil( (distance - data.range - data.temporaryRange) / QIC_RANGE_UPGRADE), 0);

      const building = hex.data.planet === Planet.Transdim ? Building.GaiaFormer : Building.Mine;
      // No need for terra forming if already occupied by another faction
      const planet = (hex.occupied() ? pl.planet : hex.data.planet);
      const {possible, cost, steps} = pl.canBuild(planet, building, {addedCost: [new Reward(qicNeeded, Resource.Qic)]});

      if (possible) {
          buildings.push({
            building,
            coordinates: hex.toString(),
            cost: Reward.toString(cost),
            steps
        });
      }
    }
  } // end for hex

  if (buildings.length > 0) {
    return [{
      name: Command.Build,
      player,
      data: { buildings }
    }];
  }

  return [];
}

export function possibleSpaceStations(engine: Engine, player: Player) {
  const map = engine.map;
  const pl = engine.player(player);
  const {data} = pl;
  const buildings = [];

  for (const hex of map.toJSON()) {
    if (hex.occupied() || hex.hasPlanet()) {
      continue;
    }

    const distance = _.min(data.occupied.filter(loc => loc.isRangeStartingPoint(player)).map(loc => map.distance(hex, loc)));
    const qicNeeded = Math.max(Math.ceil( (distance - data.range - data.temporaryRange) / QIC_RANGE_UPGRADE), 0);
    const {possible, cost, steps} = pl.canBuild(pl.planet, Building.SpaceStation, {addedCost: [new Reward(qicNeeded, Resource.Qic)]});

    if (possible) {
      buildings.push({
        building: Building.SpaceStation,
        coordinates: hex.toString(),
        cost: Reward.toString(cost)
      });
    }
  }

  if (buildings.length > 0) {
    return [{name: Command.Build, player, data: { buildings }}];
  }

  return [];
}

export function possibleMineBuildings(engine: Engine, player: Player, acceptGaiaFormer: boolean) {
  const commands = [];
  const [buildingCommand] = possibleBuildings(engine, player);

  if (buildingCommand) {
    buildingCommand.data.buildings = buildingCommand.data.buildings.filter(bld => {
      // If it's a gaia-former upgradable to a mine, it doesn't count
      if (bld.upgrade) {
        return false;
      }
      if (bld.building === Building.Mine) {
        return true;
      }
      return acceptGaiaFormer && bld.building === Building.GaiaFormer;
    });

    if (buildingCommand.data.buildings.length > 0) {
      commands.push(buildingCommand);
    }
  }

  return commands;
}

export function possibleSpecialActions(engine: Engine, player: Player) {
  const commands = [];
  const specialacts = [];
  const pl = engine.player(player);

  for (const event of pl.events[Operator.Activate]) {
    if (!event.activated) {
      if (event.rewards[0].type === Resource.DowngradeLab && (pl.data.buildings[Building.ResearchLab] === 0 || pl.data.buildings[Building.TradingStation] >= pl.maxBuildings(Building.TradingStation))) {
        continue;
      }
      if (event.rewards[0].type === Resource.PISwap && pl.data.buildings[Building.Mine] === 0) {
        continue;
      }
      specialacts.push({
        income: event.spec.replace(Operator.Activate, '').trim(), // Reward.toString(event.rewards),
        spec: event.spec
      });
    }
  }

  if (specialacts.length > 0) {
    commands.push({
      name: Command.Special,
      player,
      data: { specialacts }
    });
  }

  return commands;
}

export function possibleBoardActions(engine: Engine, player: Player) {
  const commands = [];

  const poweracts = Object.values(BoardAction).filter(pwract => engine.boardActions[pwract] && engine.player(player).canPay(Reward.parse(boardActions[pwract].cost)));

  // Prevent using the rescore action if no federation token
  if (engine.player(player).data.tiles.federations.length === 0) {
    _.remove(poweracts, act => act === BoardAction.Qic2);
  }
  if (poweracts.length > 0) {
    commands.push({
      name: Command.Action,
      player,
      data: { poweracts: poweracts.map(act => ({
        name: act,
        cost: boardActions[act].cost,
        income: boardActions[act].income
      }))}
    });
  }

  return commands;
}

export function possibleFreeActions(engine: Engine, player: Player) {
  // free action - spend
  const pl = engine.player(player);
  const acts = [];
  const commands: AvailableCommand[] = [];
  let burnDisabled = false;

  let pool = [...freeActions];

  engine.player(player).emit("freeActionChoice", pool);

  // freeActions for Terrans / Itars during gaiaPhase
  if (engine.phase === Phase.RoundGaia && (pl.canGaiaTerrans() || pl.canGaiaItars())) {
    if (pl.canGaiaTerrans()) {
      pool = freeActionsTerrans;
    } else if (pl.canGaiaItars()) {
      pool = freeActionsItars;
      commands.push({name: Command.Decline, player, data: {offer: Resource.TechTile, cost: new Reward(4, Resource.GainTokenGaiaArea).toString()}});
    }

    burnDisabled = true;
  }

  for (const freeAction of pool) {
    const maxPay = pl.maxPayRange(Reward.parse(freeAction.cost));
    if ( maxPay > 0 ) {
      acts.push({cost: freeAction.cost, income: freeAction.income, range: _.range(1, maxPay + 1)});
    }
  }

  if (acts.length > 0) {
    commands.push({name: Command.Spend, player, data: { acts }});
  }

  // free action - burn
  if (!burnDisabled && engine.player(player).data.burnablePower() > 0) {
    commands.push({
      name: Command.BurnPower,
      player,
      data: _.range(1, engine.player(player).data.burnablePower() + 1)
    });
  }

  return commands;
}

export function possibleLabDowngrades(engine: Engine, player: Player) {
  const pl = engine.player(player);
  const spots = pl.data.occupied.filter(hex => hex.buildingOf(player) === Building.ResearchLab);

  if (!spots) {
    return [];
  }

  return [{
    name: Command.Build,
    player,
    data: {
      buildings: spots.map(hex => ({
        building: Building.TradingStation,
        coordinates: hex.toString(),
        cost: "~",
        downgrade: true
      }))
    }
  }] as AvailableCommand[];
}

export function possibleResearchAreas(engine: Engine, player: Player, cost?: string, data?: any) {
  const commands = [];
  const tracks = [];
  const pl = engine.player(player);

  if (pl.canPay(Reward.parse(cost))) {

    const minArea = Math.min(...Object.values(pl.data.research));

    const avFields = (data && data.bescods) ? Object.values(ResearchField).filter( field => pl.data.research[field] === minArea) : (data && data.pos) ? [data.pos] : Object.values(ResearchField) ;

    for (const field of avFields) {
      // end of the track reached
      const destTile = pl.data.research[field] + 1;

      if (destTile === researchTracks.lastTile(field) && engine.players.some(pla => pla.data.research[field] === destTile)) {
        continue;
      }

      if (!pl.canUpgradeResearch(field)) {
        continue;
      }

      tracks.push({
        field,
        to: destTile,
        cost
      });

    }
  }

  if (tracks.length > 0) {
    commands.push({
      name: Command.UpgradeResearch,
      player,
      data: { tracks }
    });
  }

  // decline not for main action
  if (cost !== UPGRADE_RESEARCH_COST) {
    commands.push({
      name: Command.Decline,
      player,
      data: { offer: Command.UpgradeResearch }
    });
  }
  return commands;
}

export function possibleSpaceLostPlanet(engine: Engine, player: Player) {
  const commands = [];
  const data = engine.player(player).data;
  const spaces = [];

  for (const hex of engine.map.toJSON()) {
    // exclude existing planets, satellites and space stations
    if (hex.data.planet !== Planet.Empty || hex.data.federations || hex.data.building) {
      continue;
    }
    const distance = _.min(data.occupied.map(loc => engine.map.distance(hex, loc)));
    const qicNeeded = Math.max(Math.ceil( (distance - data.range) / QIC_RANGE_UPGRADE), 0);

    if (qicNeeded > data.qics) {
      continue;
    }

    spaces.push({
      building: Building.Mine,
      coordinates: hex.toString(),
      cost: qicNeeded > 0 ? new Reward(qicNeeded, Resource.Qic).toString() : "~"
    });
  }

  if (spaces.length > 0) {
    commands.push({
      name: Command.PlaceLostPlanet,
      player,
      data: { spaces }
    });
  }

  return commands;
}

export function possibleRoundBoosters(engine: Engine, player: Player) {
  const commands = [];
  const boosters = engine.isLastRound ? [] : Object.values(Booster).filter(booster => engine.tiles.boosters[booster]);

  commands.push(
    {
      name: engine.phase === Phase.SetupBooster ? Command.ChooseRoundBooster : Command.Pass,
      player,
      data: { boosters }
    }
  );

  return commands;
}

export function possibleFederations(engine: Engine, player: Player) {
  const commands = [];
  const possibleTiles = Object.keys(engine.tiles.federations).filter(key => engine.tiles.federations[key] > 0);

  if (possibleTiles.length > 0) {
    if (engine.options.noFedCheck) {
      commands.push({
        name: Command.FormFederation,
        player,
        data: {
          tiles: possibleTiles,
          federations: []
        }
      });
    } else {
      const possibleFeds = engine.player(player).availableFederations(engine.map);

      if (possibleFeds.length > 0) {
        commands.push({
          name: Command.FormFederation,
          player,
          data: {
            tiles: possibleTiles,
            federations: possibleFeds.map(fed => ({
              planets: fed.planets,
              satellites: fed.satellites,
              hexes: fed.hexes.map(hex => hex.toString()).sort().join(',')
            }))
          }
        });
      }
    }
  }

  return commands;
}

export function possibleIncomes(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  const { descs, needed } = pl.needIncomeSelection();

  if (needed) {
    commands.push({
      name: Command.ChooseIncome,
      player,
      data: descs
    });
  }
  return commands;
}

export function possibleGaiaFreeActions(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if (pl.canGaiaTerrans() || pl.canGaiaItars()) {
    commands.push(...possibleFreeActions(engine, player));
  }
  return commands;
}

export function possibleLeech(engine: Engine, player: Player) {
  const commands = [];
  const pl = engine.player(player);

  if ( pl.data.leechPossible > 0) {
    const extraPower = pl.faction === Faction.Taklons && pl.data.hasPlanetaryInstitute();
    const maxLeech = pl.maxLeech();
    const offers: Array<{offer: string, cost: string}> = [];

    if (extraPower) {
      offers.push({
        offer: `${maxLeech}${Resource.ChargePower},1t`,
        cost: new Reward(Math.max(maxLeech - 1, 0), Resource.VictoryPoint).toString()
      }, {
        offer: `1t,${pl.maxLeech(true)}${Resource.ChargePower}`,
        cost: new Reward(Math.max(pl.maxLeech(true) - 1, 0), Resource.VictoryPoint).toString()
      });
    } else {
      offers.push({
        offer: `${maxLeech}${Resource.ChargePower}`,
        cost: new Reward(Math.max(maxLeech - 1, 0), Resource.VictoryPoint).toString()
      });
    }

    [Command.ChargePower, Command.Decline].map(name => commands.push({
      name,
      player,
      data: {
        // Kept for compatibility with older viewer
        offer: offers[0].offer,
        // Kept for compatibility with older viewer
        cost: offers[0].cost,
        // new format
        offers
      }
    }));
  }

  return commands;
}

export function possibleCoverTechTiles(engine: Engine, player: Player) {
  const commands = [];

  const tiles = engine.player(player).data.tiles.techs.filter(tl => tl.enabled && !isAdvanced(tl.pos));
  commands.push({
    name: Command.ChooseCoverTechTile,
    player,
    data: {tiles}
  });

  return commands;
}

export function possibleFederationTiles(engine: Engine, player: Player, from: "pool" | "player") {
  const commands = [];

  const possibleTiles = Object.keys(engine.tiles.federations).filter(key => engine.tiles.federations[key] > 0);
  const playerTiles = engine.player(player).data.tiles.federations.map(fed => fed.tile);

  commands.push({
    name: Command.ChooseFederationTile,
    player,
    data: {
      tiles: from === "player" ? playerTiles : possibleTiles,
      // Tiles that are rescored just add the rewards, but don't take the token
      rescore: from === "player"
    }
  });

  return commands;
}

export function possibleTechTiles(engine: Engine, player: Player) {
  const commands = [];
  const tiles = [];
  const data = engine.players[player].data;

  //  tech tiles that player doesn't already have
  for (const tilePos of Object.values(TechTilePos)) {
    if (!_.find(data.tiles.techs, {tile: engine.tiles.techs[tilePos].tile})) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos
      });
    }
  }

  // adv tech tiles where player has lev 4/5, free federation tokens,
  // and available std tech tiles to cover
  for (const tilePos of Object.values(AdvTechTilePos)) {
    if (engine.tiles.techs[tilePos].count <= 0) {
      continue;
    }
    if (!data.hasGreenFederation()) {
      continue;
    }
    if (data.research[tilePos.slice("adv-".length)] < 4) {
      continue;
    }
    if (!data.tiles.techs.some(tech => tech.enabled && !isAdvanced(tech.pos))) {
      continue;
    }

    tiles.push({
      tile: engine.tiles.techs[tilePos].tile,
      pos: tilePos
    });
  }
  if (tiles.length > 0) {
    commands.push({
      name: Command.ChooseTechTile,
      player,
      data: { tiles }
    });
  }

  return commands;
}

export function possiblePISwaps(engine: Engine, player: Player) {
  const commands = [];
  const data = engine.player(player).data;
  const buildings = [];

  for (const hex of data.occupied) {
    if (hex.buildingOf(player) === Building.Mine && hex.data.planet !== Planet.Lost) {
      buildings.push({
        building: Building.Mine,
        coordinates: hex.toString(),
      });
    }
  }

  if (buildings.length > 0) {
    commands.push({
      name: Command.PISwap,
      player,
      data: { buildings }
    });
  }

  return commands;
}
