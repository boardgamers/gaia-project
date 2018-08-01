import { Faction } from "@gaia-project/engine";
const stdCost = 'm:2c,1o ts:3/6c,2o lab:5c,3o PI:6c,4o AC:6c,6o';
const stdIncome = 'm:1o ts:3/4/4/5c lab:1k PI:4pw,1t AC1:2k AC2:1q';
const stdBasicIncome = '1o,1k';
const stdStartResources = '15c,4o,3k,1q 2/4/0';

const  factionData: { [faction in Faction]: {income?: string, cost?: string, basicIncome?: string, startResources?: string, ability: string, PI: string}} = {
  [Faction.Terrans] : {
    startResources: '15c,4o,3k,1q,up-gaia >gf 4/4/0',
    ability : "During the Gaia phase, move the power tokens in your Gaia area to area II of your power cycle instead of to area I.",
    PI : "During the Gaia phase, when you move power tokens from your Gaia area to area II of your power cycle, you may gain resources as if you were spending that much power to take free actions."
  },
  [Faction.Lantids] : {
    startResources: '13c,4o,3k,1q 4/0/0',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw AC1:2k AC2:1q',
    ability : "When you take the Build a Mine action, you may build a mine on a planet colonized by an opponent (including the Lost Planet). Place your mine next to the opponent’s structure. You do not have to pay for terraforming, but you must still pay the mine’s cost. This mine counts as a normal mine in all ways except the following: this mine cannot be upgraded, and it does not count for any effects that relate to how many planet types or Gaia planets you have colonized.",
    PI : "Each time you build a mine on a planet colonized by an opponent, gain two knowledge."
  },
  [Faction.Xenos] : {
    startResources: '15c,4o,3k,1q,up-int >1q 2/4/0',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw,1q AC1:2k AC2:1q',
    ability : "You place a third starting mine after all other starting mines have been placed.",
    PI : "You can form federations with a total power value of six instead of seven. You gain one Q.I.C. as income instead of one power token."
  },
  [Faction.Gleens] : {
    startResources: '15c,4o,3k,up-nav >1q 2/4/0',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw,1o AC1:2k AC2:1q',
    ability : "If you would ever gain Q.I.C., gain that much ore instead; once you have upgraded to the indicated academy, this effect no longer applies. To make a Gaia Planet habitable, pay one ore instead of one Q.I.C. Each time you build a mine on a Gaia Planet, gain two additional VP.",
    PI : "When you upgrade to the planetary institute, immediately gain the Gleens’ federation token (gaining the resources shown as normal). Gaining this tile counts as forming a federation. The planetary institute itself can still be part of a federation on the board."
  },
  [Faction.Taklons] : {
    startResources: '15c,4o,3k,1q 2[bs]/4/0',
    ability : "The Brainstone counts as one power token (when starting a Gaia Project, building satellites, etc.), but you can spend it as if it were three power.",
    PI : "Each time you would charge power from “Passive Action: Charge Power,” you gain one power token. You can choose to gain the power before or after charging."
  },
  [Faction.Ambas] : {
    startResources: '15c,4o,3k,1q,up-nav >1q 2/4/0',
    basicIncome: '2o,1k',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw,2t AC1:2k AC2:1q',
    ability : "-",
    PI : "Once per round, as an action, you can swap your planetary institute with one of your mines on the game board (this can help you form a new federation). This has no impact on existing federations, even if their power value becomes less than seven. The swap does not count as a build or upgrade action; no VP or power can be gained from it."
  },
  [Faction.HadschHallas] : {
    startResources: '15c,4o,3k,1q,up-eco >2c,1pw 2/4/0',
    basicIncome: '3c,1o,1k',
    ability : "-",
    PI : "You can spend credits instead of power to take free actions that allow you to gain resources."
  },
  [Faction.Ivits] : {
    startResources: '15c,4o,3k,1q,4pw,1t 2/4/0',
    basicIncome: '1o,1k,1q',
    ability : `During setup, do not place mines. Instead, after all other players have placed mines (including the Xenos’ third mine), place your planetary institute on any red planet.
    You can have only one federation during the whole game, but unlike other factions, you will be able to grow that federation to gain new federation tokens. After you have formed a federation,
    to take the “Form a Federation” action again, you must connect planets to that federation instead of forming a new federation. The power values of the structures on those planets must bring the total power value of that federation to at least to 7X, where X is the number of federation tokens you own plus one (not including the federation token from level 5 of “Terraforming”). All other rules for forming a federation apply, including building satellites and gaining federation tokens. To build a satellite during this action, you must spend one Q.I.C. instead of discarding one power.`,
    PI : `As a special action, place a space station on an accessible space that does not contain a planet or another space station. 
    The accessibility of a space follows the same rules as the “Build a Mine” action. Like planets, a space station can
    be connected with satellites; each space station counts as having a power value of one for its federation. 
    A space station is not a structure, so placing one does not allow opponents to charge power. A space station does not count as a colonized planet,
    but it can be used as a “starting point” when determining the accessibility of a planet (i.e., range can be counted from a space station). 
    Your opponents can place satellites in a space containing a space station.`
  },
  [Faction.Geodens] : {
    startResources: '15c,4o,3k,1q,up-terra >2o 2/4/0',
    ability : "-",
    PI : "The first time you build a mine on each planet type, gain 3 knowledge. (You do not gain knowledge for planet types you colonized before upgrading to your planetary institute.)"
  },
  [Faction.BalTaks] : {
    startResources: '15c,4o,3k,up-gaia >gf 2/2/0',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw,2t AC1:2k AC2:4c',
    ability : `You cannot advance in the “Navigation” research area, even if you take the tech tile below the “Navigation” research area. If you do take that tech tile, no advancement occurs.
    As a free action, you can move a Gaiaformer from a Gaiaformer space on your faction board to your Gaia area to gain one Q.I.C. Gaiaformers in your Gaia area are not available until the next Gaia phase. In the next Gaia phase, move any Gaiaformer in your Gaia area back to its Gaiaformer space.`,
    PI : "You can now advance in the “Navigation” research area."
  },
  [Faction.Firaks] : {
    startResources: '15c,3o,2k,1q 2/4/0',
    basicIncome: '1o,2k',
    ability : "-",
    PI : "As an action, you can “downgrade” a research lab into a trading station and immediately advance one level in a research area of your choice. Advancing in a research area is explained on page 15. This counts as an “Upgrade to a Trading Station” action. You can later upgrade the trading station back into a research lab using the normal rules (including gaining a new tech tile)."
  },
  [Faction.Bescods] : {
    startResources: '15c,4o,1k,1q 2/4/0',
    basicIncome: '1o',
    ability : `The positions of your planetary institute and academies are swapped on your faction board, as is the income you gain for trading stations and research labs. As with the other factions, upgrading to an academy or a research lab allows you to gain a tech tile.
    Once per round, as an action, you can advance your lowest-level token in a research area (without paying knowledge). If multiple of your tokens are tied for the lowest level, choose which of
    the tied tokens to advance. To advance to level 5 this way, you must still flip a federation token as normal. Remember, only one player can reach level 5 of each research area.`,
    PI : "The power value of your structures on gray planets (your home type) is increased by one (in addition to any other effects that increase their power value)."
  },
  [Faction.Nevlas] : {
    startResources: '15c,4o,2k,1q,up-sci >1k 2/4/0',
    income: 'm:1o ts:3/4/4/5c lab:2pw PI:4pw,1t AC1:2k AC2:1q',
    ability : "As a free action, you can move one power token from area III of your power cycle to your Gaia area to gain one knowledge (these power tokens follow the normal Gaia phase rules). This does not count as spending power.",
    PI : "You can spend power tokens in area III of your power cycle as if they were each two power. Otherwise, they count as one power token (when starting a Gaia Project, building satellites, etc.). When paying for a power action with an odd power cost (1, 3, 5, etc.), the unspent power is lost."
  },
  [Faction.Itars] : {
    startResources: '15c,5o,3k,1q,up-sci >1k 4/4/0',
    income: 'm:1o ts:3/4/4/5c lab:1k PI:4pw,1t AC1:3k AC2:1q',
    basicIncome: '1o,1k,1t',
    ability : "Each time you discard a power token from area II of your power cycle to move another power token to area III, place the discarded power token in your Gaia area instead of returning it to the supply.",
    PI : `During the Gaia phase, you can discard 4 power tokens from your Gaia area to immediately gain a tech tile (standard or advanced). The rules for Gaining a Tech Tile are explained on page 13. You may do this as many times as you can afford to.`
  },
};

export function factionDesc(faction: Faction) {
  return `<b>Cost:</b> ${factionData[faction].cost || stdCost} </br> 
  <b>Income:</b> ${factionData[faction].income || stdIncome} </br>
  <b>Start:</b> ${factionData[faction].startResources || stdStartResources} </br>
  <b>Round:</b> ${factionData[faction].basicIncome || stdBasicIncome} </br>
  <b>Ability: </b> ${factionData[faction].ability} </br>
  <b>PI: </b> ${factionData[faction].PI} `;
}