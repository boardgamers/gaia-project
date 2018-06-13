import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";
import AvailableCommand from "@gaia-project/engine/src/available-command";
import { Command, factions } from "@gaia-project/engine";

const map = new MapRenderer($("canvas#map").get(0) as HTMLCanvasElement);
const research = new ResearchRenderer($("canvas#research").get(0) as HTMLCanvasElement);

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

      if (data.map) {
        map.render(data.map);
        research.render(data.players);
      }
      
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

  const command = commands[0];

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

function addButton(text: string, command: string) {
  const button = $('<button class="btn btn-secondary mr-2 mb-2">');
  button.text(text);
  button.attr("command", command);

  $("#move").append(button);
}

$(document).on("click", "*[command]", function() {
  const command = $(this).attr("command");

  // Clear exitings list of moves if the game starts anew
  if (command.startsWith("init")) {
    $("#moves").val("");
  }

  $("#moves").val(($("#moves").val() + "\n" + $(this).attr("command")).trim());
  $("#moves").scrollTop($("#moves")[0].scrollHeight);
  $("form").triggerHandler("submit");
});
