import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";
import { showError } from "./utils";
import MapRenderer from "../../renderers/map";

const map = new MapRenderer($("canvas").get(0) as HTMLCanvasElement);

$("form").on("submit", function(event) {
  event.preventDefault();

  const data = {
    moves: $("textarea").text().split("\n")
  }

  $.post("http://localhost:9508/", 
    data,
    data => {
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