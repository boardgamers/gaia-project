import fs from "fs";
import path from "path";

const folder = "dist/package/css";
const files = fs.readdirSync(folder);

for (const file of files.filter((f) => f.endsWith(".css"))) {
  const content = fs.readFileSync(path.join(folder, file), "utf-8");
  fs.writeFileSync(path.join(folder, file), content.replace(/url\(img\//g, "url(../img/"));
}
