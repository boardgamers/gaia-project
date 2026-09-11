import { fileURLToPath } from "node:url";
import shared from "../viewer/vitest.config";
export default {
  ...shared,
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: { ...shared.test, setupFiles: [fileURLToPath(new URL("../viewer/vitest.setup.ts", import.meta.url))] },
};
