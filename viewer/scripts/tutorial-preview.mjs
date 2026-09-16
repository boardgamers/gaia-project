import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const files = {
  "/bundle.js": fileURLToPath(new URL("../dist/package/viewer.umd.js", import.meta.url)),
  "/bundle.css": fileURLToPath(new URL("../dist/package/viewer.css", import.meta.url)),
  "/vue.js": require.resolve("vue/dist/vue.min.js"),
  "/bootstrap-vue.js": require.resolve("bootstrap-vue/dist/bootstrap-vue.min.js"),
};
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gaia Project tutorials</title><link rel="stylesheet" href="/bundle.css"></head><body><div id="app"></div><script src="/vue.js"></script><script src="/bootstrap-vue.js"></script><script src="/bundle.js"></script><script>const chapter=new URL(location.href).searchParams.get('chapter')||'first-mine'; gaiaViewer.launchTutorial('#app',{chapter,onProgress:p=>window.progress=p});</script></body></html>`;
export function previewServer() {
  return createServer(async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    try {
      if (path !== "/" && !files[path]) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-type": path === "/" ? "text/html" : path.endsWith(".css") ? "text/css" : "text/javascript",
      });
      res.end(files[path] ? await readFile(files[path]) : html);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  previewServer().listen(Number(process.env.PORT || 5200), "127.0.0.1", () =>
    console.log("Gaia tutorials: http://127.0.0.1:5200")
  );
