import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";
import AvailableCommand from "@gaia-project/engine/src/available-command";
import { Command } from "@gaia-project/engine";

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
  $move.html("");

  const command = commands[0];

  if (!command || command.name === Command.Init) {
    for (let i = 2; i <= 5; i++) {
      const button = $('<button class="btn btn-secondary mr-2">');
      button.text(`${i} players`);
      button.attr("command", `init ${i} randomSeed`);
      $move.append(button);
    }
  }
}

$(document).on("click", "*[command]", function() {
  const command = $(this).attr("command");

  // Clear exitings list of moves if the game starts anew
  if (command.startsWith("init")) {
    $("#moves").val("");
  }

  $("#moves").val(($("#moves").val() + "\n" + $(this).attr("command")).trim());
  $("form").triggerHandler("submit");
});
