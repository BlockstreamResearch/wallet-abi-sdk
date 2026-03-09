import { describe, expect, test } from "bun:test";

import { createGetSignerReceiveAddressRequest } from "../src/protocol.js";
import {
  buildWalletAbiCaip10Account,
  createWalletAbiJsonRpcEnvelopeFromResult,
  createWalletAbiRequiredNamespaces,
  createWalletConnectRequester,
  walletAbiNetworkToWalletConnectChain,
  walletConnectChainToWalletAbiNetwork,
} from "../src/walletconnect.js";

describe("walletconnect helpers", () => {
  test("maps Wallet ABI networks to WalletConnect chain ids", () => {
    expect(walletAbiNetworkToWalletConnectChain("liquid")).toBe(
      "walabi:liquid",
    );
    expect(walletAbiNetworkToWalletConnectChain("testnet-liquid")).toBe(
      "walabi:testnet-liquid",
    );
    expect(walletAbiNetworkToWalletConnectChain("localtest-liquid")).toBe(
      "walabi:localtest-liquid",
    );
    expect(walletConnectChainToWalletAbiNetwork("walabi:testnet-liquid")).toBe(
      "testnet-liquid",
    );
  });

  test("builds the required namespace for WalletConnect sessions", () => {
    expect(createWalletAbiRequiredNamespaces("localtest-liquid")).toEqual({
      walabi: {
        methods: [
          "get_signer_receive_address",
          "get_raw_signing_x_only_pubkey",
          "wallet_abi_process_request",
        ],
        chains: ["walabi:localtest-liquid"],
        events: [],
      },
    });
  });

  test("wraps WalletConnect request results into JSON-RPC responses", async () => {
    let seenRequest: {
      chainId: string;
      topic?: string;
      request: {
        method: string;
        params?: unknown;
      };
    } | null = null;

    const requester = createWalletConnectRequester({
      chainId: "walabi:localtest-liquid",
      topic: "topic-1",
      client: {
        async request(input) {
          seenRequest = input;
          return {
            signer_receive_address:
              "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
          };
        },
      },
    });

    const response = await requester.request(
      createGetSignerReceiveAddressRequest(7),
    );

    expect(seenRequest).toEqual({
      chainId: "walabi:localtest-liquid",
      topic: "topic-1",
      request: {
        method: "get_signer_receive_address",
        params: {},
      },
    });
    expect(response).toEqual({
      id: 7,
      jsonrpc: "2.0",
      result: {
        signer_receive_address:
          "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
      },
    });
  });

  test("builds CAIP-10 account ids for WalletConnect sessions", () => {
    expect(
      buildWalletAbiCaip10Account(
        "walabi:localtest-liquid",
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      ),
    ).toBe(
      "walabi:localtest-liquid:79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    );
  });

  test("sends empty object params for getter methods", async () => {
    let seenRequest: {
      chainId: string;
      topic?: string;
      request: {
        method: string;
        params?: unknown;
      };
    } | null = null;

    const requester = createWalletConnectRequester({
      chainId: "walabi:testnet-liquid",
      topic: "topic-2",
      client: {
        async request(input) {
          seenRequest = input;
          return {
            raw_signing_x_only_pubkey:
              "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          };
        },
      },
    });

    await requester.request({
      id: 9,
      jsonrpc: "2.0",
      method: "get_raw_signing_x_only_pubkey",
    });

    expect(seenRequest).toEqual({
      chainId: "walabi:testnet-liquid",
      topic: "topic-2",
      request: {
        method: "get_raw_signing_x_only_pubkey",
        params: {},
      },
    });
  });

  test("parses stringified JSON WalletConnect results", () => {
    const response = createWalletAbiJsonRpcEnvelopeFromResult(
      createGetSignerReceiveAddressRequest(11),
      JSON.stringify({
        signer_receive_address:
          "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
      }),
    );

    expect(response).toEqual({
      id: 11,
      jsonrpc: "2.0",
      result: {
        signer_receive_address:
          "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
      },
    });
  });
});
