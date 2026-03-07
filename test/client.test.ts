import { describe, expect, test } from "bun:test";

import {
  createExplicitAsset,
  createExplicitBlinder,
  createOutput,
  createRuntimeParams,
  createScriptLock,
  createTxCreateRequest,
  createWalletInput,
} from "../src/builders.js";
import { WalletAbiClient } from "../src/client.js";
import type {
  TxCreateRequest,
  TxCreateResponse,
  WalletAbiCapabilities,
} from "../src/schema.js";
import { TX_CREATE_ABI_VERSION } from "../src/schema.js";
import { createMockTransport } from "./support/mockTransport.js";

const capabilities: WalletAbiCapabilities = {
  abi_version: TX_CREATE_ABI_VERSION,
  network: "localtest-liquid",
  signer_receive_address:
    "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
  signing_x_only_pubkey:
    "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
};

function createRequest(): TxCreateRequest {
  return createTxCreateRequest({
    request_id: "3d6f0a38-06c0-4a93-9dd8-72738d694a11",
    network: "localtest-liquid",
    params: createRuntimeParams({
      inputs: [createWalletInput({ id: "wallet-input-0" })],
      outputs: [
        createOutput({
          id: "recipient-0",
          amount_sat: 1_250,
          lock: createScriptLock(""),
          asset: createExplicitAsset(
            "5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225",
          ),
          blinder: createExplicitBlinder(),
        }),
      ],
      fee_rate_sat_kvb: 100,
      lock_time: { Blocks: 0 },
    }),
  });
}

function createResponse(request: TxCreateRequest): TxCreateResponse {
  return {
    abi_version: TX_CREATE_ABI_VERSION,
    request_id: request.request_id,
    network: request.network,
    status: "error",
    artifacts: {
      transport: "mock",
    },
    error: {
      code: "funding",
      message: "insufficient funds",
      details: {
        asset_id:
          "5ac9f65c0efcc4775e0baec4ec03abdde22473cd3cf33c0419ca290e0751b225",
        missing_sat: 1_250,
      },
    },
  };
}

describe("WalletAbiClient", () => {
  test("connects once and caches wallet capabilities", async () => {
    let capabilitiesCalls = 0;

    const client = new WalletAbiClient({
      origin: "https://app.example",
      transport: createMockTransport({
        provider: {
          async getCapabilities() {
            capabilitiesCalls += 1;
            return capabilities;
          },
          async processRequest(request) {
            return createResponse(request);
          },
        },
      }),
      requestTimeoutMs: 1_000,
    });

    expect(await client.connect()).toEqual(capabilities);
    expect(await client.connect()).toEqual(capabilities);
    expect(client.getCapabilities()).toEqual(capabilities);
    expect(capabilitiesCalls).toBe(1);
  });

  test("sends tx_create requests through the configured transport", async () => {
    const request = createRequest();
    let seenRequest: TxCreateRequest | null = null;

    const client = new WalletAbiClient({
      origin: "https://app.example",
      transport: createMockTransport({
        provider: {
          async getCapabilities() {
            return capabilities;
          },
          async processRequest(currentRequest) {
            seenRequest = currentRequest;
            return createResponse(currentRequest);
          },
        },
      }),
      requestTimeoutMs: 1_000,
    });

    expect(await client.requestTxCreate(request)).toEqual(
      createResponse(request),
    );
    if (seenRequest === null) {
      throw new Error("Transport did not receive the tx_create request.");
    }

    const observedRequest: TxCreateRequest = seenRequest;
    expect(observedRequest).toEqual(request);
  });
});
