module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ["custom"],
  parserOptions: {
    tsconfigRootDir: "./",
    ecmaVersion: "latest",
    sourceType: "module",
  },
};
