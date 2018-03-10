import Engine from "./src/engine";

// Check if the script is being run - not loaded by another module
if (!module.parent) {
  // Launch a server on port 9508
  require("./app");
}

export default Engine;
