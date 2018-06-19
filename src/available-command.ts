import { Command, Faction, Building, ResearchField, Planet } from './enums';
import Engine from './engine';
import * as _ from 'lodash';
import factions from './factions';
import * as assert from "assert";
import { upgradedBuildings } from './buildings';
import * as research from './research-tracks';
import Reward from './reward';

const ISOLATED_DISTANCE = 3;
const UPGRADE_RESEARCH_COST = "4k";

export default interface AvailableCommand {
  name: Command;
  data?: any;
  player?: number;
}

export function generate(engine: Engine): AvailableCommand[] {
  // init game
  if (engine.round == -2) {
    return [{ name: Command.Init }];
  }
  // faction selection
  if (engine.round == -1 ) {
    return [
      {
        name: Command.ChooseFaction,
        player: engine.currentPlayer,
        data: _.difference(
          Object.values(Faction),
          engine.players.map(pl => pl.faction),
          engine.players.map(pl => factions.opposite(pl.faction))
        )
      }
    ];
  }

  // initial buuildings
  if (engine.round == 0) {
    const player = engine.currentPlayer;
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

    return [
      {
        name: Command.Build,
        player,
        data: { buildings }
      }
    ];
  }

  // We are in a regular round
  const commands = [];
  const player = engine.currentPlayer;

  assert(player !== undefined, "Problem with the engine, player to play is unknown");

  const data = engine.player(player).data;
  const board = engine.player(player).board;
  const grid = engine.map.grid;

  // Add building moves
  {
    const planet = engine.player(player).planet;
    const buildings = [];

    for (const hex of engine.map.toJSON()) {
      // exclude empty planets and other players' planets
      if (( hex.data.planet === Planet.Empty  ) || (hex.data.player !== undefined && hex.data.player !== player)) {
        continue;
      }
      //upgrade exting player's building, excluding Transdim planet until transformed into Gaia planets
      if (hex.data.building && hex.data.planet !== Planet.Transdim ) {
        const isolated = (() => {
          // We only care about mines that can transform into trading stations;
          if(hex.data.building !== Building.Mine) {
            return true;
          }

          // Check each other player to see if there's a building in range
          for (const pl of engine.players) {
            if (pl !== engine.player(player)) {
              for (const loc of pl.data.occupied) {
                if (grid.distance(loc.q, loc.r, hex.q, hex.r) < ISOLATED_DISTANCE) {
                  return false;
                }
              }
            }
          }

          return true;
        })();

        const upgraded = upgradedBuildings(hex.data.building, engine.player(player).faction);

        for (const upgrade of upgraded) {
          var buildCost = engine.player(player).canBuild(hex.data.planet, upgrade, isolated);
          if ( buildCost !== undefined) {
            buildings.push({
              upgradedBuilding: hex.data.building,
              building: upgrade,
              cost: buildCost.map(c => c.toString()).join(','),
              coordinates: hex.toString()
            });
          }
        }
        continue;
      } 

      // Check if the range is enough to access the planet
      const inRange = data.occupied.some(loc => grid.distance(hex.q, hex.r, loc.q, loc.r) <= data.range);

      if (!inRange) {
        continue;
      }

      // The planet is empty (faction planet or gaia), we can build a mine
      if (  hex.data.planet !== Planet.Transdim ) {
        var buildCost = engine.player(player).canBuild( hex.data.planet,Building.Mine,false);
        if ( buildCost !== undefined ){
          buildings.push({
            building: Building.Mine,
            coordinates: hex.toString(),
            cost: buildCost.map(c => c.toString()).join(',')
          });   
        }         
      }

      // The planet is a trasdim 
      if (  hex.data.planet === Planet.Transdim ) {
        var buildCost = engine.player(player).canBuild( hex.data.planet,Building.GaiaFormer,false);
        if ( buildCost !== undefined ){
          buildings.push({
            building: Building.GaiaFormer,
            coordinates: hex.toString(),
            cost: buildCost.map(c => c.toString()).join(',')
          }); 
        } 
      }
    } //end for hex

     if (buildings.length > 0) {
      commands.push({
        name: Command.Build,
        player,
        data: { buildings }
      });
    }
  } // end add buildings

  // Upgrade research
  if (data.canPay(Reward.parse(UPGRADE_RESEARCH_COST))) {
    const tracks = [];

    for (const field of Object.values(ResearchField)) {
      if (data.research[field] < research.lastTile(field) && !research.keyNeeded(field, data.research[field] + 1)) {
        tracks.push({
          field,
          to: data.research[field] + 1,
          cost: UPGRADE_RESEARCH_COST
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
  }

  // Give the player the ability to pass
  commands.push({
    name: Command.Pass,
    player
  });

  return commands;
}
