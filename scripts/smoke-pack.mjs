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
      'import { WalletAbiClient, WALLET_ABI_WALLETCONNECT_NAMESPACE, createWalletConnectRequester, walletAbiNetworkToWalletConnectChain } from "wallet-abi-sdk-alpha";',
      'import initVendor from "wallet-abi-sdk-alpha/vendor";',
      "",
      'if (typeof WalletAbiClient !== "function") {',
      '  throw new Error("WalletAbiClient export is missing");',
      "}",
      "",
      'if (typeof createWalletConnectRequester !== "function") {',
      '  throw new Error("createWalletConnectRequester export is missing");',
      "}",
      "",
      'if (typeof initVendor !== "function") {',
      '  throw new Error("vendor export is missing");',
      "}",
      "",
      'if (WALLET_ABI_WALLETCONNECT_NAMESPACE !== "walabi") {',
      "  throw new Error(`Unexpected namespace export: ${WALLET_ABI_WALLETCONNECT_NAMESPACE}`);",
      "}",
      "",
      'if (walletAbiNetworkToWalletConnectChain("testnet-liquid") !== "walabi:testnet-liquid") {',
      '  throw new Error("Unexpected WalletConnect chain mapping");',
      "}",
      "",
      "const requester = createWalletConnectRequester({",
      '  chainId: "walabi:testnet-liquid",',
      "  client: {",
      "    request({ request }) {",
      '      if (request.method === "get_signer_receive_address") {',
      '        return { signer_receive_address: "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn" };',
      "      }",
      '      if (request.method === "get_raw_signing_x_only_pubkey") {',
      '        return { raw_signing_x_only_pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" };',
      "      }",
      '      return { abi_version: "0.1.0", request_id: "req", network: "testnet-liquid", status: "error", error: { code: "noop", message: "noop" } };',
      "    },",
      "  },",
      "});",
      "const client = new WalletAbiClient({ requester });",
      'if (typeof client.getSignerReceiveAddress !== "function") {',
      '  throw new Error("WalletAbiClient instance is missing getSignerReceiveAddress");',
      "}",
      "",
      'console.log("esm-ok");',
    ].join("\n"),
  );

  writeFileSync(
    join(consumerDir, "cjs.cjs"),
    [
      'const { WalletAbiClient, WALLET_ABI_WALLETCONNECT_NAMESPACE, createWalletConnectRequester, walletAbiNetworkToWalletConnectChain } = require("wallet-abi-sdk-alpha");',
      'const initVendor = require("wallet-abi-sdk-alpha/vendor");',
      "",
      'if (typeof WalletAbiClient !== "function") {',
      '  throw new Error("WalletAbiClient export is missing");',
      "}",
      "",
      'if (typeof createWalletConnectRequester !== "function") {',
      '  throw new Error("createWalletConnectRequester export is missing");',
      "}",
      "",
      'if (typeof initVendor.default !== "function") {',
      '  throw new Error("vendor export is missing");',
      "}",
      "",
      'if (WALLET_ABI_WALLETCONNECT_NAMESPACE !== "walabi") {',
      "  throw new Error(`Unexpected namespace export: ${WALLET_ABI_WALLETCONNECT_NAMESPACE}`);",
      "}",
      "",
      'if (walletAbiNetworkToWalletConnectChain("testnet-liquid") !== "walabi:testnet-liquid") {',
      '  throw new Error("Unexpected WalletConnect chain mapping");',
      "}",
      "",
      "const requester = createWalletConnectRequester({",
      '  chainId: "walabi:testnet-liquid",',
      "  client: {",
      "    request({ request }) {",
      '      if (request.method === "get_signer_receive_address") {',
      '        return { signer_receive_address: "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn" };',
      "      }",
      '      if (request.method === "get_raw_signing_x_only_pubkey") {',
      '        return { raw_signing_x_only_pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798" };',
      "      }",
      '      return { abi_version: "0.1.0", request_id: "req", network: "testnet-liquid", status: "error", error: { code: "noop", message: "noop" } };',
      "    },",
      "  },",
      "});",
      "const client = new WalletAbiClient({ requester });",
      'if (typeof client.getSignerReceiveAddress !== "function") {',
      '  throw new Error("WalletAbiClient instance is missing getSignerReceiveAddress");',
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
