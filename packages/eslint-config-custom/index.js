module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:unicorn/recommended",
  ],
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {},
      node: true,
    },
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unicorn"],
  rules: {
    "unicorn/expiring-todo-comments": "off"
  },
};
