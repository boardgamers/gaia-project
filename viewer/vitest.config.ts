import vue from "@vitejs/plugin-vue2";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "~": join(root, "node_modules"),
      vue: join(root, "node_modules/vue/dist/vue.runtime.common.js"),
    },
  },
  define: {
    // vue-cli's test env supplied an empty process.env + VUE_APP_* undefined defaults.
    "process.env.NODE_ENV": JSON.stringify("test"),
    "process.env": "({})",
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
    // src/testing/stack-traces.spec.ts documents a mochapack/source-map-support stack-overflow
    // guard for the OLD webpack test toolchain; it intentionally contains no tests.
    exclude: ["src/testing/stack-traces.spec.ts"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Bound memory to one worker. Vitest 4 no longer recognizes singleFork; without
    // maxWorkers it launches parallel forks and can exhaust memory on the full suite.
    pool: "forks",
    maxWorkers: 1,
    testTimeout: 15000,
  },
});
