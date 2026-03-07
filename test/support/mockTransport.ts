import { createTransportResponseEnvelope } from "../../src/protocol.js";
import type { WalletAbiTransportAdapter } from "../../src/transports.js";
import {
  createWalletAbiJsonRpcProvider,
  type WalletAbiJsonRpcProvider,
  type WalletAbiProviderBridge,
} from "../../src/wallet.js";

export interface CreateMockTransportOptions {
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

export function createMockTransport(
  options: CreateMockTransportOptions,
): WalletAbiTransportAdapter {
  const provider = normalizeProvider(options.provider);
  const latencyMs = options.latency_ms ?? 0;

  return {
    kind: "mock",
    async request(envelope, context) {
      if (latencyMs > 0) {
        await sleep(latencyMs);
      }

      const message = await provider.request(envelope.message);
      return createTransportResponseEnvelope({
        request_id: envelope.request_id,
        origin: envelope.origin,
        processed_at_ms: context.now(),
        message,
      });
    },
  };
}
