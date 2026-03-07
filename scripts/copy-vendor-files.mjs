import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceDir = resolve(repoRoot, "src/vendor/lwk_wasm");
const targetDir = resolve(repoRoot, "dist/vendor/lwk_wasm");

mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

writeFileSync(
  resolve(targetDir, "lwk_wasm.cjs"),
  'module.exports = require("./lwk_wasm.js");\n',
);
writeFileSync(
  resolve(targetDir, "lwk_wasm.d.cts"),
  'export * from "./lwk_wasm.js";\nexport { default } from "./lwk_wasm.js";\n',
);
