module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["plugin:vue/essential", "@vue/typescript/recommended"],
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "warn" : "off",
    semi: ["error", "always"],
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-return-assign": "error",
    "no-lone-blocks": "error",
    "no-unmodified-loop-condition": "error",
    "no-useless-return": "error",
    "no-invalid-this": "error",
    quotes: "off",
    // Hoisted function declarations are safe to reference before their definition; much of the
    // codebase organizes helpers below their call sites.
    "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
  },
  overrides: [
    {
      // Test ergonomics: non-null assertions are fine in specs (a wrong assumption fails the
      // test anyway), and snake_case identifiers mirror external row shapes under test.
      files: ["**/*.spec.ts"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/camelcase": "off",
      },
    },
  ],
};
