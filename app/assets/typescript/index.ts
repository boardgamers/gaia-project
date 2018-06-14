import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";
import Renderer from "../../renderers";
import { AvailableCommand, Command, factions, Building } from "@gaia-project/engine";
import { CubeCoordinates } from "hexagrid";

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

  switch (command.name) {
    case Command.ChooseFaction: {
      commandTitle("Choose a faction", player);
      for (const faction of command.data) {
        addButton(factions[faction].name, `${player} ${Command.ChooseFaction} ${faction}`);
      }

      break;
    }
    case Command.Build: {
      commandTitle("Your turn", player);
      addButton("Place a mine", `${player} ${Command.Build} ${Building.Mine}`, {
        hexes: command.data.buildings.map(building => building.coordinates)
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

function addButton(text: string, command: string, {hexes}: {hexes?: string[]} = {}) {
  const button = $('<button class="btn btn-secondary mr-2 mb-2">');
  button.text(text);
  
  if (command) {
    button.attr("data-command", command);
  }

  $("#move").append(button);

  if (hexes) {
    button.attr("data-hexes", hexes.join(","));
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
    renderer.render(lastData, hexes.split(",").map(hex => CubeCoordinates.parse(hex)));

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

function updatePlayerInfo() {
  for (let i = 0; i < 5; i++) {
    const player = `p${i+1}`;
    const panel = `#${player}`;
    const tab = `${panel}-tab`;
    
    if (lastData.players.length <= i) {
      $(tab).hide();
      continue;
    }

    $(tab).show();

    const data = lastData.players[i].data;
    const faction = factions[lastData.players[i].faction].name;

    const info = [
      `Faction: ${faction}`,
      `vp: ${data.victoryPoints}, c: ${data.credits}, o: ${data.ores}, q: ${data.qics}, k: ${data.knowledge}`,
      `bowl 1: ${data.power.bowl1}, bowl 2: ${data.power.bowl2}, bowl 3: ${data.power.bowl3}`,
    ];

    $(panel).html(info.join('<br>'));
  }
}