# Wallet ABI SDK Alpha

Browser-first Wallet ABI SDK for frontend apps integrating with the refactored
`lwk_simplicity` wallet ABI.

## Surface

- `WalletAbiClient` for capability handshake and `tx_create` request flow
- `protocol` helpers for JSON-RPC and app-link envelopes
- `schema` types aligned to the Rust wire contract
- `builders` for request construction
- `helpers` for lazy `lwk_wasm` browser helpers
- `wallet` bridge types for wallet/provider implementations
- `transports` with built-in `createAppLinkTransport`
- `vendor` for direct `lwk_wasm` re-exports when low-level access is needed

## Example

```ts
import {
  WalletAbiClient,
  createAppLinkTransport,
  createRuntimeParams,
  createTxCreateRequest,
} from "wallet-abi-sdk-alpha";

async function awaitWalletCallback(): Promise<string> {
  throw new Error("Hook this up to your wallet callback flow.");
}

const client = new WalletAbiClient({
  origin: "https://app.example",
  transport: createAppLinkTransport({
    baseUrl: "https://wallet.example/connect",
    async awaitResponse({ uri }) {
      if (typeof window !== "undefined") {
        window.open(uri, "_blank", "noopener,noreferrer");
      }

      return await awaitWalletCallback();
    },
  }),
  callback: {
    mode: "qr_roundtrip",
  },
});

const request = createTxCreateRequest({
  network: "localtest-liquid",
  params: createRuntimeParams({
    inputs: [],
    outputs: [],
  }),
});

await client.connect();
const response = await client.requestTxCreate(request);
```
