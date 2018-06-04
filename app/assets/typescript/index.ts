import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError, removeError } from "./utils";
import MapRenderer from "../../renderers/map";
import ResearchRenderer from "../../renderers/research";

const map = new MapRenderer($("canvas#map").get(0) as HTMLCanvasElement);
const research = new ResearchRenderer($("canvas#research").get(0) as HTMLCanvasElement);

$("form").on("submit", function(event) {
  event.preventDefault();

  const data = {
    moves: ($("textarea").val() as string).split("\n")
  }

  $.post("http://localhost:9508/", 
    data,
    data => {
      removeError();
      map.render(data.map);
      research.render(data.players);
      console.log(data)
    },
    "json"
  ).fail((error, status, exception) => {
    if (error.status === 0) {
      showError("Are you sure gaia engine is running on port 9508?");  
    } else {
      showError("Error " + error.status + ": " + error.responseText);
    }
  });
})