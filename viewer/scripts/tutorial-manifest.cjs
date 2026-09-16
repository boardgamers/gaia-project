const fs = require("node:fs");
const path = require("node:path");
const ts = require("../../node_modules/typescript");
const original = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    filename
  );
};
const { lessons, sections } = require("../src/tutorial/lessons.ts");
require.extensions[".ts"] = original;
const manifest = {
  sections,
  chapters: lessons.map(({ id, title, description, version, section }) => ({
    id,
    title,
    description,
    version,
    section,
  })),
};
if (require.main === module) {
  const destination = process.argv[2] || path.join(__dirname, "../dist/tutorial-manifest.json");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Tutorial manifest: ${destination}`);
}
module.exports = { lessons, manifest };
