import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  existsSync,
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
const npmCacheDir = join(tempDir, "npm-cache");
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
      env: {
        ...process.env,
        NPM_CONFIG_CACHE: npmCacheDir,
      },
      stdio: "inherit",
    },
  );

  writeFileSync(
    join(consumerDir, "esm.mjs"),
    [
      'import { WalletAbiClient, WALLET_ABI_GET_CAPABILITIES_METHOD } from "wallet-abi-sdk-alpha";',
      'import { createAppLinkTransport } from "wallet-abi-sdk-alpha/transports";',
      'import initVendor from "wallet-abi-sdk-alpha/vendor";',
      "",
      'if (typeof WalletAbiClient !== "function") {',
      '  throw new Error("WalletAbiClient export is missing");',
      "}",
      "",
      'if (typeof createAppLinkTransport !== "function") {',
      '  throw new Error("createAppLinkTransport export is missing");',
      "}",
      "",
      'if (typeof initVendor !== "function") {',
      '  throw new Error("vendor export is missing");',
      "}",
      "",
      'if (WALLET_ABI_GET_CAPABILITIES_METHOD !== "wallet_abi_get_capabilities") {',
      "  throw new Error(`Unexpected protocol export: ${WALLET_ABI_GET_CAPABILITIES_METHOD}`);",
      "}",
      "",
      'console.log("esm-ok");',
    ].join("\n"),
  );

  writeFileSync(
    join(consumerDir, "cjs.cjs"),
    [
      'const { WalletAbiClient, WALLET_ABI_GET_CAPABILITIES_METHOD } = require("wallet-abi-sdk-alpha");',
      'const { createAppLinkTransport } = require("wallet-abi-sdk-alpha/transports");',
      'const initVendor = require("wallet-abi-sdk-alpha/vendor");',
      "",
      'if (typeof WalletAbiClient !== "function") {',
      '  throw new Error("WalletAbiClient export is missing");',
      "}",
      "",
      'if (typeof createAppLinkTransport !== "function") {',
      '  throw new Error("createAppLinkTransport export is missing");',
      "}",
      "",
      'if (typeof initVendor.default !== "function") {',
      '  throw new Error("vendor export is missing");',
      "}",
      "",
      'if (WALLET_ABI_GET_CAPABILITIES_METHOD !== "wallet_abi_get_capabilities") {',
      "  throw new Error(`Unexpected protocol export: ${WALLET_ABI_GET_CAPABILITIES_METHOD}`);",
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

  const vendoredWasmPath = join(
    consumerDir,
    "node_modules",
    "wallet-abi-sdk-alpha",
    "dist",
    "vendor",
    "lwk_wasm",
    "lwk_wasm_bg.wasm",
  );

  if (!existsSync(vendoredWasmPath)) {
    throw new Error("Packed package is missing the vendored lwk_wasm binary.");
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
