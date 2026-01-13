const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  preset: "ts-jest",
  setupFiles: ["<rootDir>/src/test/setup.ts"],
  transform: {
    ...tsJestTransformCfg,
  },
};