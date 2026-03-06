import { readFileSync, writeFileSync } from "node:fs";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8"));

packageJson.main = "./dist/index.cjs";
packageJson.module = "./dist/index.js";
packageJson.types = "./dist/index.d.ts";
packageJson.exports = {
  ".": {
    import: {
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    },
    require: {
      types: "./dist/index.d.cts",
      default: "./dist/index.cjs",
    },
    default: "./dist/index.js",
  },
};

writeFileSync(packageJsonUrl, `${JSON.stringify(packageJson, null, 2)}\n`);
