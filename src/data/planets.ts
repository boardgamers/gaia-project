import { Planet } from "@gaia-project/engine";

export default {
  [Planet.Swamp]: {radius: 0.65, color: "#a25b15", borderColor: "#874d12"},
  [Planet.Desert]: {radius: 0.65, color: "#ffd700", borderColor: "#c1a925"},
  [Planet.Terra]: {radius: 0.65, color: "#99ccff", borderColor: "#3399ff"},
  [Planet.Volcanic]: {radius: 0.65, color: "#ff9900", borderColor: "#ff0000"},
  [Planet.Oxide]: {radius: 0.65, color: "#ff3300", borderColor: "#ff8566"},
  [Planet.Titanium]: {radius: 0.65, color: "#3d3d5c", borderColor: "#d1d1e0"},
  [Planet.Ice]: {radius: 0.65, color: "#ccffff", borderColor: "#00c2c2"},
  [Planet.Gaia]: {radius: 0.65, color: "#009933", borderColor: "#004d1a"},
  [Planet.Transdim]: {radius: 0.5, color: "#a64dff", borderColor: "#a64dff"}
};

export const planetNames = {
  [Planet.Swamp]: "Swamp",
  [Planet.Desert]: "Desert",
  [Planet.Terra]: "Terra",
  [Planet.Volcanic]: "Volcanic",
  [Planet.Oxide]: "Oxide",
  [Planet.Titanium]: "Titanium",
  [Planet.Ice]: "Ice",
  [Planet.Gaia]: "Gaia",
  [Planet.Transdim]: "Transdim",
  [Planet.Lost]: "Lost planet"
};
