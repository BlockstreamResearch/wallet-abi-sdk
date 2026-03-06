import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempDir = mkdtempSync(join(tmpdir(), "wallet-abi-sdk-alpha-"));
const packDir = join(tempDir, "pack");
const consumerDir = join(tempDir, "consumer");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const tarballName = `${packageJson.name}-${packageJson.version}.tgz`;
const tarballPath = join(packDir, tarballName);

mkdirSync(packDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });

try {
  execFileSync("bun", ["pm", "pack", "--destination", packDir, "--quiet"], {
    cwd: repoRoot,
    stdio: "pipe",
  });

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "wallet-abi-sdk-alpha-smoke",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  execFileSync(
    "npm",
    ["install", "--silent", "--no-package-lock", tarballPath],
    {
      cwd: consumerDir,
      stdio: "inherit",
    },
  );

  writeFileSync(
    join(consumerDir, "esm.mjs"),
    [
      'import { packageName } from "wallet-abi-sdk-alpha";',
      "",
      'if (packageName !== "wallet-abi-sdk-alpha") {',
      "  throw new Error(`Unexpected ESM export: ${packageName}`);",
      "}",
      "",
      'console.log("esm-ok");',
    ].join("\n"),
  );

  writeFileSync(
    join(consumerDir, "cjs.cjs"),
    [
      'const { packageName } = require("wallet-abi-sdk-alpha");',
      "",
      'if (packageName !== "wallet-abi-sdk-alpha") {',
      "  throw new Error(`Unexpected CJS export: ${packageName}`);",
      "}",
      "",
      'console.log("cjs-ok");',
    ].join("\n"),
  );

  execFileSync("node", ["esm.mjs"], {
    cwd: consumerDir,
    stdio: "inherit",
  });

  execFileSync("node", ["cjs.cjs"], {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const packedPackageJson = JSON.parse(
    readFileSync(
      join(consumerDir, "node_modules", "wallet-abi-sdk-alpha", "package.json"),
      "utf8",
    ),
  );

  if (!packedPackageJson.exports) {
    throw new Error("Packed package is missing an exports map.");
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
