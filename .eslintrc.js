module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
    browser: true,
    jquery: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    'linebreak-style': 0,
    'no-console': 0,
    'func-names': 0,
    'prefer-destructuring': 0,
    'one-var-declaration-per-line': 0,
    'one-var': 0,
    'no-plusplus': 0,
  },
};
