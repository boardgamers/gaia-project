module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: [
    'plugin:vue/essential',
    '@vue/standard',
    '@vue/typescript/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    semi: ['error', 'always'],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-return-assign': 'off',
    'no-lone-blocks': 'off',
    'no-unmodified-loop-condition': 'off',
    'no-useless-return': 'off',
    quotes: 'off'
  }
};
