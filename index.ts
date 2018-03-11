import Engine from "./src/engine";

export {Condition, Planet, Resource, Operator} from "./src/enums";
export {GaiaHex} from "./src/sector";

// Check if the script is being run - not loaded by another module or webpack
if (!module.parent && !(module as any).webpackPolyfill) {
  // Launch a server on port 9508
  require("./app");
}

export default Engine;
