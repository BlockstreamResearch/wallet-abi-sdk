import { describe, expect, test } from "bun:test";

import { WalletAbiClient } from "../src/client.js";
import {
  WALLET_ABI_GET_CAPABILITIES_METHOD,
  WALLET_ABI_JSON_RPC_VERSION,
  WalletAbiProtocolError,
  buildWalletAbiCallbackUri,
  chunkWalletAbiTransportPayload,
  createGetCapabilitiesRequest,
  createTransportRequestEnvelope,
  createTransportResponseEnvelope,
  decodeWalletAbiTransportRequestEnvelope,
  encodeWalletAbiTransportRequestEnvelope,
  joinWalletAbiTransportChunks,
  parseWalletAbiAppLinkRequest,
  parseWalletAbiTransportRequestEnvelope,
} from "../src/protocol.js";
import {
  TX_CREATE_ABI_VERSION,
  type WalletAbiCapabilities,
} from "../src/schema.js";
import { createAppLinkTransport } from "../src/transports.js";

const capabilities: WalletAbiCapabilities = {
  abi_version: TX_CREATE_ABI_VERSION,
  network: "localtest-liquid",
  signer_receive_address:
    "tlq1qq2xvpcvfup5j8zscjq05u2wxxjcyewk7979f3mmz5l7uw5pqmx6xf5xy50hsn6vhkm5euwt72x878eq6zxx2z58hd7zrsg9qn",
  signing_x_only_pubkey:
    "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
};

describe("wallet-abi transport codecs", () => {
  test("encodes, chunks, rejoins, and decodes request envelopes", () => {
    const envelope = createTransportRequestEnvelope({
      request_id: "request-1",
      origin: "https://app.example",
      created_at_ms: 1_700_000_000_000,
      expires_at_ms: 1_700_000_060_000,
      callback: {
        mode: "qr_roundtrip",
      },
      message: createGetCapabilitiesRequest(1),
    });

    const encoded = encodeWalletAbiTransportRequestEnvelope(envelope);
    const chunks = chunkWalletAbiTransportPayload(encoded, 96);

    expect(chunks.length).toBeGreaterThan(1);
    expect(joinWalletAbiTransportChunks(chunks)).toBe(encoded);
    expect(decodeWalletAbiTransportRequestEnvelope(encoded)).toEqual(envelope);
  });

  test("rejects malformed callback payloads", () => {
    const envelope = createTransportRequestEnvelope({
      request_id: "request-1",
      origin: "https://app.example",
      created_at_ms: 1_700_000_000_000,
      expires_at_ms: 1_700_000_060_000,
      callback: {
        mode: "same_device_https",
        url: "https://app.example/callback",
        session_id: "session-1",
      },
      message: createGetCapabilitiesRequest(1),
    });

    expect(() =>
      parseWalletAbiTransportRequestEnvelope({
        ...envelope,
        callback: {
          mode: "invalid-mode",
        },
      }),
    ).toThrow(WalletAbiProtocolError);

    expect(() =>
      parseWalletAbiTransportRequestEnvelope({
        ...envelope,
        callback: {
          ...envelope.callback,
          url: 42,
        },
      }),
    ).toThrow(WalletAbiProtocolError);

    expect(() =>
      parseWalletAbiTransportRequestEnvelope({
        ...envelope,
        callback: {
          ...envelope.callback,
          session_id: 42,
        },
      }),
    ).toThrow(WalletAbiProtocolError);
  });
});

describe("app link transport", () => {
  test("emits display_uri payloads and accepts callback URLs", async () => {
    let displayUri:
      | import("../src/transports.js").WalletAbiDisplayUriPayload
      | undefined;

    const transport = createAppLinkTransport({
      baseUrl: "https://wallet.example/connect",
      chunkSize: 96,
      async awaitResponse({ request, uri, chunks }) {
        expect(chunks.length).toBeGreaterThan(1);
        expect(parseWalletAbiAppLinkRequest(uri).message.method).toBe(
          WALLET_ABI_GET_CAPABILITIES_METHOD,
        );

        const responseEnvelope = createTransportResponseEnvelope({
          request_id: request.request_id,
          origin: request.origin,
          processed_at_ms: request.created_at_ms + 5,
          message: {
            id: request.message.id,
            jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
            result: capabilities,
          },
        });

        return buildWalletAbiCallbackUri(
          "https://app.example/callback",
          responseEnvelope,
        );
      },
    });

    const client = new WalletAbiClient({
      origin: "https://app.example",
      transport,
      callback: {
        mode: "qr_roundtrip",
      },
      requestTimeoutMs: 1_000,
    });

    client.on("display_uri", (payload) => {
      displayUri = payload;
    });

    expect(await client.connect()).toEqual(capabilities);
    expect(displayUri?.uri.startsWith("https://wallet.example/connect#")).toBe(
      true,
    );
  });
});
