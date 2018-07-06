import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";
import Renderer from "../../renderers";
import { AvailableCommand, Command, factions, Building, ResearchField, tiles, Booster, Federation, BoardAction } from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";
import { buildingName } from "../../data/building";
import { factionColor } from "../../graphics/utils";

const renderer = new Renderer($("canvas#map").get(0) as HTMLCanvasElement);
const map = renderer.map;
const research = renderer.research;
let lastData: any = {};
let pendingCommand = "";

$("form").on("submit", function(event) {
  event.preventDefault();

  const text = ($("textarea").val() as string).trim(); 
  const data = {
    moves: text ? text.split("\n") : []
  }

  $.post("http://localhost:9508/", 
    data,
    data => {
      removeError();
      lastData = data;

      if (data.map) {
        renderer.render(data);
      }
      
      updatePlayerInfo();
      showAvailableMoves(data.availableCommands);
    },
    "json"
  ).fail((error, status, exception) => {
    if (error.status === 0) {
      showError("Are you sure gaia engine is running on port 9508?");  
    } else {
      showError("Error " + error.status + ": " + error.responseText);
    }
  });
});

$(function() {
  $("form").triggerHandler("submit");
});

function showAvailableMoves(commands: AvailableCommand[]) {
  // Clear move choice
  // $("#move-title").html("");
  $("#move-buttons").html("");
  pendingCommand = "";

  const command = commands[0];

  if (!command && lastData.turn > 0) {
    return;
  }

  if (!command || command.name === Command.Init) {
    commandTitle("Choose the number of players");
    for (let i = 2; i <= 5; i++) {
      addButton(`${i} players`, `init ${i} randomSeed`);
    }

    return;
  }

  const player = `p${command.player+1}`;

  if (command.name === Command.ChooseFaction) {
    commandTitle("Choose a faction", player);
    
    for (const faction of command.data) {
      addButton(factions[faction].name, `${player} ${Command.ChooseFaction} ${faction}`);
    }

    return;
  }

  commandTitle("Your turn", player);
  for (const comm of commands) {
    showAvailableMove(player, comm);
  }
}

function showAvailableMove(player: string, command: AvailableCommand) {
  switch (command.name) {
    case Command.Build: {
      for (const building of Object.values(Building)) {
        const coordinates = command.data.buildings.filter(bld => bld.building === building);

        if (coordinates.length > 0) {
          const buildDesc =  building === Building.Mine ? "Build a" : building === Building.GaiaFormer ? "Place a ": "Upgrade to";
        
          addButton(`${buildDesc} ${buildingName(building)}`, `${player} ${Command.Build} ${building}`, {
            hexes: coordinates
          });
          
        }
      }

      break;
    }

    case Command.Pass: 
    case Command.ChooseRoundBooster: {
      const values = [];
      const labels = [];

      Object.values(Booster).forEach((booster, i) => {
        if (command.data.boosters.includes(booster)) {
          values.push(booster);
          labels.push(`Booster ${i+1}: ${tiles.boosters[booster]}`);
        }
      });

      addButton(command.name === Command.Pass ? "Pass" : "Pick booster", `${player} ${command.name}`, {values, labels});
      break;
    };

    case Command.UpgradeResearch: {
      addButton("Advance research", `${player} ${Command.UpgradeResearch}`, {
        tracks: command.data.tracks.map(tr => ({level: tr.to, field: tr.field}))
      });

      break;
    }

    case Command.ChooseTechTile: {
      $("#move-title").append(" - Pick tech tile");
      for (const tile of command.data.tiles) {
        addButton(tile.tilePos, `${player} ${Command.ChooseTechTile} ${tile.tilePos}`);
      }
      break;
    }

    case Command.Leech: {
      addButton("Charge power: " + command.data, `${player} ${Command.Leech} ${command.data}`);
      break;
    }

    case Command.DeclineLeech: {
      addButton("Decline charge power", `${player} ${Command.DeclineLeech}`);
      break;
    }

    case Command.Spend: {
      const acts = command.data.acts;
      const values = acts.map(act => `${act.cost} for ${act.income}`);
      const labels = acts.map(act => `Spend ${act.cost} to gain ${act.income}`);
      addButton("Free action", `${player} ${Command.Spend}`, {values, labels});
      break;
    };

    case Command.Action: {
      const acts = command.data.poweracts;
      addButton("Power/Q.I.C Action", `${player} ${Command.Action}`, {values: acts.map(act => act.name), labels: acts.map(act => `Spend ${act.cost} for ${act.income.join(" / ")}`)});
    }

    case Command.BurnPower: {
      addButton("Burn power", `${player} ${Command.BurnPower}`, {values: command.data});
      break;
    }

    case Command.EndTurn: {
      addButton("End turn", `${player} ${Command.EndTurn}`);
      break;
    }

    case Command.FormFederation: {
      const values = [];
      const labels = [];
      
      Object.values(Federation).forEach((federation, i) => {
        if (command.data.tiles.includes(federation)) {
          values.push(federation);
          labels.push(`Federation ${i+1}: ${tiles.federations[federation]}`);
        }
      });

      addButton("Form federation", `${player} ${Command.FormFederation}`, {
        hexGroups: command.data.federations.map(fed => fed.hexes),
        values,
        labels
      });
    }
  }
}

function commandTitle(text: string, player?: string) {
  if (!player) {
    $("#move-title").text(text);
  } else {
    $("#move-title").text(`(${player}) ${text}`);
  }  
}

function addStep(title: string) {
  $("#move-buttons").html("");
  $("#move-title").append(" - " + title);
}

function addButton(text: string, command: string, params: {hexes?: Array<{coordinates: string}>, tracks?: any[], hexGroups?: string[], hoverHexes?: CubeCoordinates[], labels?: string[], values?: string[]} = {}) {
  const button = $('<button class="btn btn-secondary mr-2 mb-2">');
  button.text(text);
  
  if (command) {
    button.attr("data-command", command);
  }

  $("#move-buttons").append(button);

  for (const param of Object.keys(params)) {
    button.attr(`data-${param}`, JSON.stringify(params[param]));
  }

  return button;
}

$(document).on("click", "*[data-command]", function() {
  // Clear pending
  pendingCommand = "";

  const command = $(this).attr("data-command");
  const hexes = $(this).attr("data-hexes");
  
  if (hexes) {
    pendingCommand = command;
    renderer.render(lastData, {hexes: JSON.parse(hexes).map(obj => ({
      coord: CubeCoordinates.parse(obj.coordinates),
      qic: obj.cost.includes('q')
    }))});

    return;
  }

  const fields = $(this).attr("data-tracks");

  if (fields) {
    pendingCommand = command;
    renderer.render(lastData, {fields: JSON.parse(fields)});

    return;
  }

  const hexGroups = $(this).attr("data-hexGroups");

  if (hexGroups) {
    addStep("Federation");

    (JSON.parse(hexGroups) as string[]).forEach((hexGroup, i) => {
      addButton(`Location ${i+1}`, `${command} ${hexGroup}`, {
        hoverHexes: hexGroup.split(',').map(str => CubeCoordinates.parse(str)),
        values: JSON.parse($(this).attr("data-values")),
        labels: JSON.parse($(this).attr("data-labels"))
      });
    });

    return;
  }

  if ($(this).attr("data-values")) {
    addStep($(this).text());

    const values = JSON.parse($(this).attr("data-values"));
    const labels = JSON.parse($(this).attr("data-labels") || "[]");

    values.forEach((value, i) => {
      addButton(labels[i] || value, `${command} ${value}`);
    });
    return;
  }

  // Clear existing list of moves if the game starts anew
  if (command.startsWith("init")) {
    $("#moves").val("");
  }
  
  addMove(command);
});

// When button is hovered, highlight hexes in data-hoverHexes
$(document).on("mouseenter", "*[data-hoverHexes]", function() {
  const hexes = $(this).attr("data-hoverHexes");
  
  renderer.render(lastData, {hexes: JSON.parse(hexes).map(obj => ({
    coord: obj
  }))});
});

$(document).on("mouseleave", "*[data-hoverHexes]", function() {
  renderer.render(lastData);
});

function addMove(move: string) {
  
  const text = ($("#moves").val() as string).trim(); 
  const moves = text ? text.split("\n") : [];
  // check if the same player as penultimate move
  const lastMove = moves[moves.length-1];
  if (move.substr(0, 2) === lastMove.substr(0, 2) &&
    !lastMove.includes(Command.ChooseRoundBooster) &&
    !lastMove.includes(Command.Leech) &&
    !lastMove.includes(Command.DeclineLeech)) {
    move = !move.includes(Command.EndTurn) ? move.substr(2, move.length - 2) : "";
    $("#moves").val((($("#moves").val() as string).trim() + "." + move).trim());
  }
  else { $("#moves").val((($("#moves").val() as string).trim() + "\n" + move).trim()); }

  $("#moves").scrollTop($("#moves")[0].scrollHeight);
  $("form").triggerHandler("submit");
}

map.on("hexClick", hex => {
  if (pendingCommand) {
    addMove(pendingCommand + " " + CubeCoordinates.toString(hex))
  }
});

research.on("fieldClick", field => {
  if (pendingCommand) {
    addMove(pendingCommand + " " + field);
  }
});

function updatePlayerInfo() {
  if (!lastData.players) {
    return;
  }

  $("#round").text(`Round ${Math.max(lastData.round, 0)}`);
  
  const playerOrder = lastData.round <= 0 ? lastData.players.map((pl, i) => i) : lastData.turnOrder.concat(lastData.passedPlayers);

  for (let i = 0; i < 5; i++) {
    const pl = playerOrder[i];
    const panel = `#p${i+1}`;
    
    if (pl === undefined) {
      $(panel).hide();
      continue;
    }

    const player = lastData.players[pl];

    if (!player.faction) {
      $(panel).hide();
      continue;
    }

    $(panel).show();

    const data = player.data;
    const factionEnum = player.faction;
    const faction = factions[factionEnum].name;
    const passed = lastData.passedPlayers.includes(pl) ? " - (passed)" : "";
    const boosterDesc = data.roundBooster ? data.roundBooster + ": " + tiles.boosters [data.roundBooster] : "(not selected)";

    const info = [
      `<b>Player ${pl+1}</b> - ${faction} - ${data.victoryPoints}vp ${passed}`,
      `${data.credits}c, ${data.ores}o, ${data.knowledge}k, ${data.qics}q, [${data.power.gaia}] ${data.power.area1}/${data.power.area2}/${data.power.area3} pw`,
      `range: ${data.range}, gaia-form level: ${data.terraformSteps}`,
      `income: ${player.income.replace(/,/g, ', ')}`,
      `round booster: ${boosterDesc}`
    ];

    $(panel).html(info.join('<br>'));
    $(panel).css('background-color', `#${factionColor(factionEnum).toString(16)}a0`);
  }
}