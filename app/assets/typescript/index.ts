import "jquery";
import "bootstrap";
import "../stylesheets/frontend.scss";

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
  );

})