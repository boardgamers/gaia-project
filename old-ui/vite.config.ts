import { fileURLToPath } from "node:url";
import shared from "../viewer/vite.config";
export default {
  ...shared,
  root: fileURLToPath(new URL(".", import.meta.url)),
  build: {
    ...shared.build,
    outDir: "dist/package",
    lib: {
      entry: fileURLToPath(new URL("src/wrapper.ts", import.meta.url)),
      name: "gaiaOldViewerLib",
      formats: ["iife"],
      fileName: () => "old-ui.umd.js",
      cssFileName: "old-ui",
    },
  },
};
