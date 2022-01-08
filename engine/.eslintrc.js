module.exports = {
  root: true,
  env: {
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": "error",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-namespace": "off",
    "no-inner-declarations": "off",
    "no-return-assign": "error",
    "no-fallthrough": "error",
    "no-invalid-this": "error",
    eqeqeq: ["error", "always"],
  },
  overrides: [
    {
      files: ["*.spec.ts"],
      rules: {
        "no-invalid-this": "off",
      },
    },
  ],
};
