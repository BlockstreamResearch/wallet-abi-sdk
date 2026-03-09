import type { WalletAbiJsonRpcRequest } from "../../src/protocol.js";
import type { WalletAbiRequester } from "../../src/walletconnect.js";
import {
  createWalletAbiJsonRpcProvider,
  type WalletAbiJsonRpcProvider,
  type WalletAbiProviderBridge,
} from "../../src/wallet.js";

export interface CreateMockRequesterOptions {
  provider: WalletAbiJsonRpcProvider | WalletAbiProviderBridge;
  latency_ms?: number;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function normalizeProvider(
  provider: WalletAbiJsonRpcProvider | WalletAbiProviderBridge,
): WalletAbiJsonRpcProvider {
  return "request" in provider
    ? provider
    : createWalletAbiJsonRpcProvider(provider);
}

export function createMockRequester(
  options: CreateMockRequesterOptions,
): WalletAbiRequester {
  const provider = normalizeProvider(options.provider);
  const latencyMs = options.latency_ms ?? 0;

  return {
    async request(request: WalletAbiJsonRpcRequest) {
      if (latencyMs > 0) {
        await sleep(latencyMs);
      }

      return await provider.request(request);
    },
  };
}
