import {
  parseTxCreateRequest,
  parseTxCreateResponse,
  type TxCreateRequest,
  type TxCreateResponse,
  type WalletAbiAddress,
  type WalletAbiXOnlyPublicKeyHex,
} from "./schema.js";

export const WALLET_ABI_JSON_RPC_VERSION = "2.0" as const;
export const GET_SIGNER_RECEIVE_ADDRESS_METHOD =
  "get_signer_receive_address" as const;
export const GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD =
  "get_raw_signing_x_only_pubkey" as const;
export const WALLET_ABI_PROCESS_REQUEST_METHOD =
  "wallet_abi_process_request" as const;

export const WALLET_ABI_METHODS = [
  GET_SIGNER_RECEIVE_ADDRESS_METHOD,
  GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD,
  WALLET_ABI_PROCESS_REQUEST_METHOD,
] as const;

export type WalletAbiMethod = (typeof WALLET_ABI_METHODS)[number];

export interface WalletAbiJsonRpcErrorObject {
  code: number;
  message: string;
}

export interface WalletAbiGetSignerReceiveAddressRequest {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  method: typeof GET_SIGNER_RECEIVE_ADDRESS_METHOD;
  params?: Record<string, never>;
}

export interface WalletAbiGetRawSigningXOnlyPubkeyRequest {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  method: typeof GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD;
  params?: Record<string, never>;
}

export interface WalletAbiProcessRequest {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  method: typeof WALLET_ABI_PROCESS_REQUEST_METHOD;
  params: TxCreateRequest;
}

export type WalletAbiJsonRpcRequest =
  | WalletAbiGetSignerReceiveAddressRequest
  | WalletAbiGetRawSigningXOnlyPubkeyRequest
  | WalletAbiProcessRequest;

export interface WalletAbiJsonRpcSuccessResponse<TResult> {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  result: TResult;
}

export interface WalletAbiJsonRpcErrorResponse {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  error: WalletAbiJsonRpcErrorObject;
}

export interface WalletAbiSignerReceiveAddressResult {
  signer_receive_address: WalletAbiAddress;
}

export interface WalletAbiRawSigningXOnlyPubkeyResult {
  raw_signing_x_only_pubkey: WalletAbiXOnlyPublicKeyHex;
}

export type WalletAbiGetSignerReceiveAddressResponse =
  WalletAbiJsonRpcSuccessResponse<WalletAbiSignerReceiveAddressResult>;
export type WalletAbiGetRawSigningXOnlyPubkeyResponse =
  WalletAbiJsonRpcSuccessResponse<WalletAbiRawSigningXOnlyPubkeyResult>;
export type WalletAbiProcessResponse =
  WalletAbiJsonRpcSuccessResponse<TxCreateResponse>;

export type WalletAbiJsonRpcResponse =
  | WalletAbiGetSignerReceiveAddressResponse
  | WalletAbiGetRawSigningXOnlyPubkeyResponse
  | WalletAbiProcessResponse
  | WalletAbiJsonRpcErrorResponse;

export class WalletAbiProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAbiProtocolError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, context: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new WalletAbiProtocolError(`${context} must be an object`);
  }

  return value;
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WalletAbiProtocolError(`${context} must be a finite number`);
  }

  return value;
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new WalletAbiProtocolError(`${context} must be a string`);
  }

  return value;
}

function expectJsonRpcVersion(value: unknown, context: string): void {
  if (value !== WALLET_ABI_JSON_RPC_VERSION) {
    throw new WalletAbiProtocolError(
      `${context} must be "${WALLET_ABI_JSON_RPC_VERSION}"`,
    );
  }
}

function expectMethod(value: unknown, context: string): WalletAbiMethod {
  const method = expectString(value, context);
  if (!WALLET_ABI_METHODS.includes(method as WalletAbiMethod)) {
    throw new WalletAbiProtocolError(
      `${context} must be a supported Wallet ABI method`,
    );
  }

  return method as WalletAbiMethod;
}

function expectEmptyParams(
  value: unknown,
  context: string,
): Record<string, never> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, context);
  if (Object.keys(record).length > 0) {
    throw new WalletAbiProtocolError(`${context} must be empty`);
  }

  return {};
}

function parseSignerReceiveAddressResult(
  value: unknown,
  context: string,
): WalletAbiSignerReceiveAddressResult {
  const record = expectRecord(value, context);

  return {
    signer_receive_address: expectString(
      record.signer_receive_address,
      `${context}.signer_receive_address`,
    ),
  };
}

function parseRawSigningXOnlyPubkeyResult(
  value: unknown,
  context: string,
): WalletAbiRawSigningXOnlyPubkeyResult {
  const record = expectRecord(value, context);

  return {
    raw_signing_x_only_pubkey: expectString(
      record.raw_signing_x_only_pubkey,
      `${context}.raw_signing_x_only_pubkey`,
    ),
  };
}

export function createGetSignerReceiveAddressRequest(
  id: number,
): WalletAbiGetSignerReceiveAddressRequest {
  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    method: GET_SIGNER_RECEIVE_ADDRESS_METHOD,
  };
}

export function createGetRawSigningXOnlyPubkeyRequest(
  id: number,
): WalletAbiGetRawSigningXOnlyPubkeyRequest {
  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    method: GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD,
  };
}

export function createProcessRequest(
  id: number,
  params: TxCreateRequest,
): WalletAbiProcessRequest {
  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    method: WALLET_ABI_PROCESS_REQUEST_METHOD,
    params,
  };
}

export function createJsonRpcSuccessResponse<TResult>(
  request: WalletAbiJsonRpcRequest,
  result: TResult,
): WalletAbiJsonRpcSuccessResponse<TResult> {
  return {
    id: request.id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    result,
  };
}

export function isJsonRpcErrorResponse(
  value: unknown,
): value is WalletAbiJsonRpcErrorResponse {
  return isRecord(value) && isRecord(value.error);
}

export function isWalletAbiGetSignerReceiveAddressResponse(
  value: unknown,
): value is WalletAbiGetSignerReceiveAddressResponse {
  return (
    isRecord(value) &&
    !isJsonRpcErrorResponse(value) &&
    isRecord(value.result) &&
    typeof value.result.signer_receive_address === "string"
  );
}

export function isWalletAbiGetRawSigningXOnlyPubkeyResponse(
  value: unknown,
): value is WalletAbiGetRawSigningXOnlyPubkeyResponse {
  return (
    isRecord(value) &&
    !isJsonRpcErrorResponse(value) &&
    isRecord(value.result) &&
    typeof value.result.raw_signing_x_only_pubkey === "string"
  );
}

export function isWalletAbiProcessResponse(
  value: unknown,
): value is WalletAbiProcessResponse {
  return (
    isRecord(value) &&
    !isJsonRpcErrorResponse(value) &&
    isRecord(value.result) &&
    typeof value.result.status === "string"
  );
}

export function parseWalletAbiJsonRpcRequest(
  value: unknown,
): WalletAbiJsonRpcRequest {
  const record = expectRecord(value, "wallet_abi_json_rpc_request");

  const id = expectNumber(record.id, "wallet_abi_json_rpc_request.id");
  expectJsonRpcVersion(record.jsonrpc, "wallet_abi_json_rpc_request.jsonrpc");

  const method = expectMethod(
    record.method,
    "wallet_abi_json_rpc_request.method",
  );

  if (method === GET_SIGNER_RECEIVE_ADDRESS_METHOD) {
    const params =
      record.params === undefined
        ? undefined
        : expectEmptyParams(
            record.params,
            "wallet_abi_json_rpc_request.params",
          );

    return params === undefined
      ? {
          id,
          jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
          method,
        }
      : {
          id,
          jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
          method,
          params,
        };
  }

  if (method === GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD) {
    const params =
      record.params === undefined
        ? undefined
        : expectEmptyParams(
            record.params,
            "wallet_abi_json_rpc_request.params",
          );

    return params === undefined
      ? {
          id,
          jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
          method,
        }
      : {
          id,
          jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
          method,
          params,
        };
  }

  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    method,
    params: parseTxCreateRequest(record.params),
  };
}

export function parseWalletAbiJsonRpcResponse(
  value: unknown,
): WalletAbiJsonRpcResponse {
  const record = expectRecord(value, "wallet_abi_json_rpc_response");

  const id = expectNumber(record.id, "wallet_abi_json_rpc_response.id");
  expectJsonRpcVersion(record.jsonrpc, "wallet_abi_json_rpc_response.jsonrpc");

  if (record.error !== undefined) {
    const error = expectRecord(
      record.error,
      "wallet_abi_json_rpc_response.error",
    );

    return {
      id,
      jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
      error: {
        code: expectNumber(
          error.code,
          "wallet_abi_json_rpc_response.error.code",
        ),
        message: expectString(
          error.message,
          "wallet_abi_json_rpc_response.error.message",
        ),
      },
    };
  }

  if (record.result === undefined) {
    throw new WalletAbiProtocolError(
      "wallet_abi_json_rpc_response.result must be present when error is absent",
    );
  }

  if (isRecord(record.result)) {
    if ("signer_receive_address" in record.result) {
      return {
        id,
        jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
        result: parseSignerReceiveAddressResult(
          record.result,
          "wallet_abi_json_rpc_response.result",
        ),
      };
    }

    if ("raw_signing_x_only_pubkey" in record.result) {
      return {
        id,
        jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
        result: parseRawSigningXOnlyPubkeyResult(
          record.result,
          "wallet_abi_json_rpc_response.result",
        ),
      };
    }
  }

  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    result: parseTxCreateResponse(record.result),
  };
}
