import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

// Only remove intermediate constant concatenations: the browser renders the complete value.
const partial = new Set();
const used = new Set();
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const concat = (node) => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;
function constant(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!concat(node)) return undefined;
  const left = constant(node.left),
    right = constant(node.right);
  return left === undefined || right === undefined ? undefined : left + right;
}
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "localization", "tests"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!/\.(?:ts|js|vue|svelte)$/.test(path) || /\.(?:spec|test)\./.test(path)) continue;
    let source = await readFile(path, "utf8");
    if (/\.(?:vue|svelte)$/.test(path))
      source = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      const value = constant(node);
      if (value !== undefined) {
        const intermediate = node.parent && concat(node.parent) && constant(node.parent) !== undefined;
        (intermediate ? partial : used).add(normalize(value));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
await scan("viewer/src");
await scan("engine/src");
const removable = new Set([...partial].filter((key) => key.length >= 100 && !used.has(key)));
let removed = 0,
  bytes = 0;
for (const entry of await readdir("viewer/src/localization")) {
  if (!entry.endsWith(".json")) continue;
  const path = join("viewer/src/localization", entry);
  const data = JSON.parse(await readFile(path, "utf8"));
  for (const key of removable) {
    if (!(key in data)) continue;
    bytes += Buffer.byteLength(JSON.stringify({ [key]: data[key] }));
    delete data[key];
    removed++;
  }
  await writeFile(path, JSON.stringify(data, null, 4) + "\n");
}
console.log(`Removed ${removed} redundant entries (${bytes} bytes across all languages).`);
