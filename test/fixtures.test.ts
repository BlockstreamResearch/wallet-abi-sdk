import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  parseWalletAbiJsonRpcRequest,
  parseWalletAbiJsonRpcResponse,
} from "../src/protocol.js";
import {
  parseErrorInfo,
  parseFinalizerSpec,
  parseInternalKeySource,
  parseTxCreateRequest,
  parseTxCreateResponse,
  WalletAbiSchemaError,
} from "../src/schema.js";

const fixturesRoot = new URL("../fixtures/contract/", import.meta.url);

function readJsonFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(new URL(name, fixturesRoot), "utf8"),
  ) as unknown;
}

function roundTrip<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("contract fixtures", () => {
  test("round-trip through schema and protocol parsers", () => {
    expect(
      roundTrip(parseErrorInfo(readJsonFixture("error_info.json"))),
    ).toEqual(readJsonFixture("error_info.json"));
    expect(
      roundTrip(
        parseInternalKeySource(
          readJsonFixture("internal_key_source_external.json"),
        ),
      ),
    ).toEqual(readJsonFixture("internal_key_source_external.json"));
    expect(
      roundTrip(parseFinalizerSpec(readJsonFixture("simf_finalizer.json"))),
    ).toEqual(readJsonFixture("simf_finalizer.json"));
    expect(
      roundTrip(
        parseTxCreateRequest(readJsonFixture("tx_create_request.json")),
      ),
    ).toEqual(readJsonFixture("tx_create_request.json"));
    expect(
      roundTrip(
        parseTxCreateResponse(readJsonFixture("tx_create_response.json")),
      ),
    ).toEqual(readJsonFixture("tx_create_response.json"));
    expect(
      roundTrip(
        parseWalletAbiJsonRpcRequest(
          readJsonFixture("json_rpc_capabilities_request.json"),
        ),
      ),
    ).toEqual(readJsonFixture("json_rpc_capabilities_request.json"));
    expect(
      roundTrip(
        parseWalletAbiJsonRpcResponse(
          readJsonFixture("json_rpc_capabilities_response.json"),
        ),
      ),
    ).toEqual(readJsonFixture("json_rpc_capabilities_response.json"));
    expect(
      roundTrip(
        parseWalletAbiJsonRpcRequest(
          readJsonFixture("json_rpc_process_request.json"),
        ),
      ),
    ).toEqual(readJsonFixture("json_rpc_process_request.json"));
    expect(
      roundTrip(
        parseWalletAbiJsonRpcResponse(
          readJsonFixture("json_rpc_process_response.json"),
        ),
      ),
    ).toEqual(readJsonFixture("json_rpc_process_response.json"));
  });

  test("rejects malformed tx_create_request payloads", () => {
    const request = clone(readJsonFixture("tx_create_request.json"));
    if (
      typeof request !== "object" ||
      request === null ||
      Array.isArray(request)
    ) {
      throw new Error("expected tx_create_request fixture to be an object");
    }

    const missingBroadcast = clone(request);
    delete (missingBroadcast as Record<string, unknown>).broadcast;

    expect(() => parseTxCreateRequest(missingBroadcast)).toThrow(
      WalletAbiSchemaError,
    );

    const invalidNestedOutput = clone(request);
    const params = (invalidNestedOutput as Record<string, unknown>).params as
      | Record<string, unknown>
      | undefined;
    const outputs = params?.outputs as Record<string, unknown>[] | undefined;

    if (outputs === undefined || outputs.length === 0) {
      throw new Error("expected tx_create_request fixture to contain outputs");
    }

    outputs[0] = {
      ...outputs[0],
      amount_sat: "1250",
    };

    expect(() => parseTxCreateRequest(invalidNestedOutput)).toThrow(
      WalletAbiSchemaError,
    );
  });

  test("rejects malformed tx_create_response payloads", () => {
    const response = clone(readJsonFixture("tx_create_response.json"));
    if (
      typeof response !== "object" ||
      response === null ||
      Array.isArray(response)
    ) {
      throw new Error("expected tx_create_response fixture to be an object");
    }

    const missingError = clone(response);
    delete (missingError as Record<string, unknown>).error;
    expect(() => parseTxCreateResponse(missingError)).toThrow(
      WalletAbiSchemaError,
    );

    const okWithoutTransaction = {
      ...clone(response),
      status: "ok",
    };
    delete (okWithoutTransaction as Record<string, unknown>).error;
    expect(() => parseTxCreateResponse(okWithoutTransaction)).toThrow(
      WalletAbiSchemaError,
    );

    const malformedTransaction = {
      ...clone(response),
      status: "ok",
      transaction: {
        tx_hex: "001122",
        txid: 123,
      },
    };
    delete (malformedTransaction as Record<string, unknown>).error;
    expect(() => parseTxCreateResponse(malformedTransaction)).toThrow(
      WalletAbiSchemaError,
    );

    const malformedArtifacts = {
      ...clone(response),
      artifacts: {
        transport: undefined,
      },
    };
    expect(() => parseTxCreateResponse(malformedArtifacts)).toThrow(
      WalletAbiSchemaError,
    );
  });
});
