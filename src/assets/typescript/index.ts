// import "jquery";
// import "bootstrap";
// import "../stylesheets/frontend.scss";
// import { showError, removeError } from "./utils";
// import Renderer from "../../renderers";
// import { AvailableCommand, Command, factions, Building, tiles, Booster, Federation, Event } from "@gaia-project/engine";
// import { CubeCoordinates } from "hexagrid";
// import { buildingName } from "../../data/building";
// import { factionColor } from "../../graphics/utils";
// import { eventDesc } from "../../data/event";

// const renderer = new Renderer($("canvas#map").get(0) as HTMLCanvasElement);
// const map = renderer.map;
// const research = renderer.research;
// let lastData: any = {};
// let pendingCommand = "";

// $("form").on("submit", function(event) {
//   event.preventDefault();

//   const text = ($("textarea").val() as string).trim(); 
//   const data = {
//     moves: text ? text.split("\n") : []
//   }

//   $.post("http://localhost:9508/", 
//     data,
//     data => {
//       removeError();
//       lastData = data;

//       if (data.map) {
//         renderer.render(data);
//       }
      
//       updatePlayerInfo();
//       showAvailableMoves(data.availableCommands);
//     },
//     "json"
//   ).fail((error, status, exception) => {
//     if (error.status === 0) {
//       showError("Are you sure gaia engine is running on port 9508?");  
//     } else {
//       showError("Error " + error.status + ": " + error.responseText);
//     }
//   });
// });

// $(function() {
//   $("form").triggerHandler("submit");
// });

// function showAvailableMoves(commands: AvailableCommand[]) {
//   // Clear move choice
//   // $("#move-title").html("");
//   $("#move-buttons").html("");
//   pendingCommand = "";

//   const command = commands[0];

//   if (!command && lastData.turn > 0) {
//     return;
//   }

//   if (!command || command.name === Command.Init) {
//     commandTitle("Choose the number of players");
//     for (let i = 2; i <= 5; i++) {
//       addButton(`${i} players`, `init ${i} randomSeed`);
//     }

//     return;
//   }

//   const player = `p${command.player+1}`;

//   if (command.name === Command.ChooseFaction) {
//     commandTitle("Choose a faction", player);
    
//     for (const faction of command.data) {
//       const button = addButton(factions[faction].name, `${player} ${Command.ChooseFaction} ${faction}`);
//       button.append(` <i class='planet ${factions[faction].planet}'></i>`);
//     }

//     return;
//   }

//   commandTitle("Your turn", player);
//   for (const comm of commands) {
//     showAvailableMove(player, comm);
//   }

//   // Only one move button, save time and click it directly
//   if (commands.length === 1 && $(".move-button").length === 1) {
//     $(".move-button").click();
//   }
// }

// function showAvailableMove(player: string, command: AvailableCommand) {
//   switch (command.name) {
//     case Command.Build: {
//       for (const building of Object.values(Building)) {
//         const coordinates = command.data.buildings.filter(bld => bld.building === building);

//         if (coordinates.length > 0) {
//           const buildDesc =  building === Building.Mine ? "Build a" : building === Building.GaiaFormer ? "Place a ": "Upgrade to";
        
//           addButton(`${buildDesc} ${buildingName(building)}`, `${player} ${Command.Build} ${building}`, {
//             hexes: coordinates
//           });
          
//         }
//       }

//       break;
//     }

//     case Command.Pass: 
//     case Command.ChooseRoundBooster: {
//       const values = [];
//       const labels = [];
//       const tooltips = [];

//       Object.values(Booster).forEach((booster, i) => {
//         if (command.data.boosters.includes(booster)) {
//           values.push(booster);
//           labels.push(`Booster ${i+1}: ${tiles.boosters[booster]}`);
//           tooltips.push(tiles.boosters[booster].map(spec => eventDesc(new Event(spec))).join("\n"));
//         }
//       });

//       addButton(command.name === Command.Pass ? "Pass" : "Pick booster", `${player} ${command.name}`, {values, labels, tooltips});
//       break;
//     };

//     case Command.UpgradeResearch: {
//       addButton("Advance research", `${player} ${Command.UpgradeResearch}`, {
//         tracks: command.data.tracks.map(tr => ({level: tr.to, field: tr.field}))
//       });

//       break;
//     }

//     case Command.ChooseTechTile: case Command.ChooseCoverTechTile: {
//       $("#move-title").append(command.name === Command.ChooseCoverTechTile ? "- Pick tech tile to cover" : " - Pick tech tile");
//       for (const tile of command.data.tiles) {
//         addButton(tile.tilePos, `${player} ${command.name} ${tile.tilePos}`);
//       }
//       pendingCommand = `${player} ${command.name}`,
//       renderer.render(lastData, {techs: command.data.tiles.map(tile => tile.tilePos)});
//       break;
//     }

//     case Command.Leech: {
//       const leech = command.data.leech;
//       const gainToken = command.data.freeIncome;

//       if (gainToken) {
//         addButton("Charge " + leech + " get " + gainToken, `${player} ${Command.Leech} ${leech},${gainToken}`);
//         addButton("Get " + gainToken + " charge " + leech, `${player} ${Command.Leech} ${gainToken},${leech}`);
//       } else {
//         addButton("Charge " + leech, `${player} ${Command.Leech} ${leech}`);
//       }
//       break;
//     }

//     case Command.DeclineLeech: {
//       addButton("Decline charge power", `${player} ${Command.DeclineLeech}`);
//       break;
//     }

//     case Command.Spend: {
//       const acts = command.data.acts;
//       const values = acts.map(act => `${act.cost} for ${act.income}`);
//       const labels = acts.map(act => `Spend ${act.cost} to gain ${act.income}`);
//       addButton("Free action", `${player} ${Command.Spend}`, {values, labels});
//       break;
//     };

//     case Command.Action: {
//       const acts = command.data.poweracts;
//       addButton("Power/Q.I.C Action", `${player} ${Command.Action}`, {values: acts.map(act => act.name), labels: acts.map(act => `Spend ${act.cost} for ${act.income.join(" / ")}`)});
//       break;
//     }

//     case Command.Special: {
//       const acts = command.data.specialacts;
//       addButton("Special Action", `${player} ${Command.Special}`, {values: acts.map(act => act.income)});
//       break;
//     }

//     case Command.BurnPower: {
//       addButton("Burn power", `${player} ${Command.BurnPower}`, {values: command.data});
//       break;
//     }

//     case Command.EndTurn: {
//       addButton("End turn", `${player} ${Command.EndTurn}`);
//       break;
//     }

//     case Command.FormFederation: {
//       const values = [];
//       const labels = [];
      
//       Object.values(Federation).forEach((federation, i) => {
//         if (command.data.tiles.includes(federation)) {
//           values.push(federation);
//           labels.push(`Federation ${i+1}: ${tiles.federations[federation]}`);
//         }
//       });

//       addButton("Form federation", `${player} ${Command.FormFederation}`, {
//         hexGroups: command.data.federations.map(fed => fed.hexes),
//         values,
//         labels
//       });
//     }
//   }
// }

// function commandTitle(text: string, player?: string) {
//   if (!player) {
//     $("#move-title").text(text);
//   } else {
//     $("#move-title").text(`(${player}) ${text}`);
//   }  
// }

// function addStep(title: string) {
//   $("#move-buttons").html("");
//   $("#move-title").append(" - " + title);
// }

// function addButton(text: string, command: string, params: {hexes?: Array<{coordinates: string}>, tracks?: any[], hexGroups?: string[], hoverHexes?: CubeCoordinates[], labels?: string[], values?: string[], tooltips?: string[]} = {}) {
//   const button = $('<button class="btn btn-secondary mr-2 mb-2 move-button">');
//   button.text(text);
  
//   if (command) {
//     button.attr("data-command", command);
//   }

//   $("#move-buttons").append(button);

//   for (const param of Object.keys(params)) {
//     button.attr(`data-${param}`, JSON.stringify(params[param]));
//   }

//   return button;
// }

// $(document).on("click", "*[data-command]", function() {
//   // Clear pending
//   pendingCommand = "";

//   const command = $(this).attr("data-command");
//   const hexes = $(this).attr("data-hexes");
  
//   if (hexes) {
//     pendingCommand = command;
//     renderer.render(lastData, {hexes: JSON.parse(hexes).map(obj => ({
//       coord: CubeCoordinates.parse(obj.coordinates),
//       qic: obj.cost.includes('q'),
//       hint: obj.cost !== "~" ? "Cost: " + obj.cost.replace(/,/g, ', ') : null
//     }))});

//     return;
//   }

//   const fields = $(this).attr("data-tracks");

//   if (fields) {
//     pendingCommand = command;
//     renderer.render(lastData, {fields: JSON.parse(fields)});

//     return;
//   }

//   const hexGroups = $(this).attr("data-hexGroups");

//   if (hexGroups) {
//     addStep("Federation");

//     (JSON.parse(hexGroups) as string[]).forEach((hexGroup, i) => {
//       addButton(`Location ${i+1}`, `${command} ${hexGroup}`, {
//         hoverHexes: hexGroup.split(',').map(str => CubeCoordinates.parse(str)),
//         values: JSON.parse($(this).attr("data-values")),
//         labels: JSON.parse($(this).attr("data-labels"))
//       });
//     });

//     return;
//   }

//   if ($(this).attr("data-values")) {
//     addStep($(this).text());

//     const values = JSON.parse($(this).attr("data-values"));
//     const labels = JSON.parse($(this).attr("data-labels") || "[]");
//     const tooltips = JSON.parse($(this).attr("data-tooltips") || "[]");

//     values.forEach((value, i) => {
//       const button = addButton(labels[i] || value, `${command} ${value}`);

//       if (tooltips[i]) {
//         button.attr("title", tooltips[i]);
//       }
//     });
//     return;
//   }

//   // Clear existing list of moves if the game starts anew
//   if (command.startsWith("init")) {
//     $("#moves").val("");
//   }
  
//   addMove(command);
// });

// // When button is hovered, highlight hexes in data-hoverHexes
// $(document).on("mouseenter", "*[data-hoverHexes]", function() {
//   const hexes = $(this).attr("data-hoverHexes");
  
//   renderer.render(lastData, {hexes: JSON.parse(hexes).map(obj => ({
//     coord: obj
//   }))});
// });

// $(document).on("mouseleave", "*[data-hoverHexes]", function() {
//   renderer.render(lastData);
// });

// function addMove(move: string) {
//   const text = ($("#moves").val() as string).trim();
//   const moves = text ? text.split("\n") : [];

//   const lastMove = (moves.length > 0 ? moves[moves.length - 1] : "").trim();

//   const moveList = (() => {
//     if (move.includes(Command.EndTurn)) {
//       // End line
//       return text + ".";
//     }
//     // Check if the player already did the previous move, and previous move isn't final
//     if (move.substr(0, 2) === lastMove.substr(0, 2) && !lastMove.endsWith(".") && lastData.round > 0) {
//       if (lastMove.includes(Command.ChooseRoundBooster) || lastMove.includes(Command.Leech) || lastMove.includes(Command.DeclineLeech)) {
//         // Those are commands that are alone in one line, and we shouldn't carry on the same line
//       } else {
//         // join moves on the same line
//         return text + "." + move.substr(2);
//       }
//     }
//     return text + "\n" + move;
//   }) ();

//   $("#moves").val(moveList.trim());
//   $("#moves").scrollTop($("#moves")[0].scrollHeight);
//   $("form").triggerHandler("submit");
// }

// map.on("hexClick", hex => {
//   if (pendingCommand) {
//     addMove(pendingCommand + " " + `${hex.q}x${hex.r}`);
//   }
// });

// research.on("fieldClick", field => {
//   if (pendingCommand) {
//     addMove(pendingCommand + " " + field);
//   }
// });

// research.on("techClick", pos => {
//   if (pendingCommand) {
//     addMove(pendingCommand + " " + pos);
//   }
// });

// research.on("advTechClick", pos => {
//   if (pendingCommand) {
//     addMove(pendingCommand + " " + pos);
//   }
// });

// function updatePlayerInfo() {
//   if (!lastData.players) {
//     return;
//   }

//   const playerOrder = lastData.round <= 0 ? lastData.players.map((pl, i) => i) : lastData.turnOrder.concat(lastData.passedPlayers);

//   for (let i = 0; i < 5; i++) {
//     const pl = playerOrder[i];
//     const $panel = $(`#p${i+1}`);
    
//     if (pl === undefined) {
//       $panel.hide();
//       continue;
//     }

//     const player = lastData.players[pl];

//     if (!player.faction) {
//       $panel.hide();
//       continue;
//     }

//     $panel.show();

//     const data = player.data;
//     const factionEnum = player.faction;
//     const faction = factions[factionEnum].name;
//     const passed = lastData.passedPlayers.includes(pl) ? " - (passed)" : "";
//     const boosterDesc = data.roundBooster ? data.roundBooster + ": " + tiles.boosters [data.roundBooster] : "(not selected)";

//     const power = area => data.brainstone === area ? `${data.power[area]}(b)` : data.power[area];

//     const $text = $panel.find(".text");

//     const info = [
//       `<b>Player ${pl+1}</b> - ${faction} - ${data.victoryPoints}vp ${passed}`,
//       `${data.credits}c, ${data.ores}o, ${data.knowledge}k, ${data.qics}q, [${power('gaia')}] ${power('area1')}/${power('area2')}/${power('area3')} pw`,
//       `range: ${data.range}, gaia-form level: ${data.terraformCostDiscount}`,
//       `income: ${player.income.replace(/,/g, ', ')}`,
//       `${boosterDesc}`
//     ];

//     $text.html(info.join('<br>'));
//     $panel.css('background-color', `#${factionColor(factionEnum).toString(16)}a0`);

//     const $tiles = $panel.find(".tiles");
//     $tiles.html("");
    
//     for (const tile of data.techTiles.filter(t => t.enabled).map(t => t.tile).concat(data.advTechTiles)) {
//       $tiles.append(`<canvas class='tech-tile' data-tile='${tile}'></canvas>`);
//     }
//   }
// }