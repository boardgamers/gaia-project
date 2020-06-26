import { Planet } from "@gaia-project/engine";

export default {
  [Planet.Swamp]: { radius: 0.65, color: "#523A00", borderColor: "#874d12" },
  [Planet.Desert]: { radius: 0.65, color: "#F2FF00", borderColor: "#c1a925" },
  [Planet.Terra]: { radius: 0.65, color: "#2080f0", borderColor: "#3399ff" },
  [Planet.Volcanic]: { radius: 0.65, color: "#ffa135", borderColor: "#ff0000" },
  [Planet.Oxide]: { radius: 0.65, color: "#FF160A", borderColor: "#ff8566" },
  [Planet.Titanium]: { radius: 0.65, color: "#808080", borderColor: "#d1d1e0" },
  [Planet.Ice]: { radius: 0.65, color: "#F8FFF5", borderColor: "#00c2c2" },
  [Planet.Gaia]: { radius: 0.65, color: "#00FF00", borderColor: "#004d1a" },
  [Planet.Transdim]: { radius: 0.5, color: "#a64dff", borderColor: "#a64dff" },
  [Planet.Lost]: { radius: 0.5, color: "#000033", borderColor: "#ccccff" }
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
