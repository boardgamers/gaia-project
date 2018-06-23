import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";
import Renderer from "../../renderers";
import { AvailableCommand, Command, factions, Building, ResearchField } from "@gaia-project/engine";
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
  const $move = $("#move");

  // Clear move choice
  $move.html("");
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
        const coordinates = command.data.buildings.filter(bld => bld.building === building).map(bld => bld.coordinates);

        if (coordinates.length > 0) {
          addButton(`Place ${buildingName(building)}`, `${player} ${Command.Build} ${building}`, {
            hexes: coordinates
          });
        }
      }

      break;
    }

    case Command.Pass: {
      addButton("Pass", `${player} ${Command.Pass}`);
      break;
    }

    case Command.UpgradeResearch: {
      addButton("Advance research", `${player} ${Command.UpgradeResearch}`, {
        tracks: command.data.tracks.map(tr => ({level: tr.to, field: tr.field}))
      });

      break;
    }
  }
}

function commandTitle(text: string, player?: string) {
  if (!player) {
    $("#move").append(`<div class='mb-2'>${text}</div>`);
  } else {
    $("#move").append(`<div class='mb-2'>(${player}) ${text}</div>`);
  }  
}

function addButton(text: string, command: string, {hexes, tracks}: {hexes?: string[], tracks?: any[]} = {}) {
  const button = $('<button class="btn btn-secondary mr-2 mb-2">');
  button.text(text);
  
  if (command) {
    button.attr("data-command", command);
  }

  $("#move").append(button);

  if (hexes) {
    button.attr("data-hexes", hexes.join(","));
  }

  if (tracks) {
    button.attr("data-fields", JSON.stringify(tracks));
  }

  return button;
}

$(document).on("click", "*[data-command]", function() {
  // Clear pending
  pendingCommand = "";

  const command = $(this).attr("data-command");
  const hexes = $(this).attr("data-hexes");
  const fields = $(this).attr("data-fields");

  if (hexes) {
    pendingCommand = command;
    renderer.render(lastData, {hexes: hexes.split(",").map(hex => CubeCoordinates.parse(hex))});

    return;
  }

  if (fields) {
    pendingCommand = command;
    renderer.render(lastData, {fields: JSON.parse(fields)});

    return;
  }

  // Clear exitings list of moves if the game starts anew
  if (command.startsWith("init")) {
    $("#moves").val("");
  }
  
  addMove(command);
});

function addMove(move: string) {
  $("#moves").val((($("#moves").val() as string).trim() + "\n" + move).trim());
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
    const passed = lastData.passedPlayers.includes(pl) ? "(passed)" : "";

    const info = [
      `<b>Player ${pl+1}</b> - ${faction} ${passed}`,
      `vp: ${data.victoryPoints}, c: ${data.credits}, o: ${data.ores}, q: ${data.qics}, k: ${data.knowledge}`,
      `<b>Power</b> - gaia: ${data.power.gaia}, bowl 1: ${data.power.bowl1}, bowl 2: ${data.power.bowl2}, bowl 3: ${data.power.bowl3}`,
    ];

    $(panel).html(info.join('<br>'));
    $(panel).css('background-color', `#${factionColor(factionEnum).toString(16)}a0`);
  }
}