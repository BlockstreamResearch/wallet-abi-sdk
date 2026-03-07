import { gunzipSync, gzipSync } from "fflate";
import { base64url } from "rfc4648";

import {
  parseTxCreateRequest,
  parseTxCreateResponse,
  parseWalletAbiCapabilities,
  type TxCreateRequest,
  type TxCreateResponse,
  type WalletAbiCapabilities,
} from "./schema.js";

export const WALLET_ABI_JSON_RPC_VERSION = "2.0" as const;
export const WALLET_ABI_GET_CAPABILITIES_METHOD =
  "wallet_abi_get_capabilities" as const;
export const WALLET_ABI_PROCESS_REQUEST_METHOD =
  "wallet_abi_process_request" as const;

export const WALLET_ABI_TRANSPORT_VERSION = 1 as const;
export const WALLET_ABI_TRANSPORT_REQUEST_PARAM = "wa_v1" as const;
export const WALLET_ABI_TRANSPORT_RESPONSE_PARAM = "wa_resp_v1" as const;
export const WALLET_ABI_TRANSPORT_MAX_DECODED_BYTES = 64 * 1024;
export const DEFAULT_WALLET_ABI_APP_LINK =
  "https://blockstream.com/walletabi/request";

const CHUNK_PREFIX = "wa1:";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface WalletAbiJsonRpcErrorObject {
  code: number;
  message: string;
}

export interface WalletAbiGetCapabilitiesRequest {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  method: typeof WALLET_ABI_GET_CAPABILITIES_METHOD;
  params?: Record<string, never>;
}

export interface WalletAbiProcessRequest {
  id: number;
  jsonrpc: typeof WALLET_ABI_JSON_RPC_VERSION;
  method: typeof WALLET_ABI_PROCESS_REQUEST_METHOD;
  params: TxCreateRequest;
}

export type WalletAbiJsonRpcRequest =
  | WalletAbiGetCapabilitiesRequest
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

export type WalletAbiCapabilitiesResponse =
  WalletAbiJsonRpcSuccessResponse<WalletAbiCapabilities>;
export type WalletAbiProcessResponse =
  WalletAbiJsonRpcSuccessResponse<TxCreateResponse>;

export type WalletAbiJsonRpcResponse =
  | WalletAbiCapabilitiesResponse
  | WalletAbiProcessResponse
  | WalletAbiJsonRpcErrorResponse;

export type WalletAbiTransportCallbackMode =
  | "same_device_https"
  | "backend_push"
  | "qr_roundtrip";

export interface WalletAbiTransportCallback {
  mode: WalletAbiTransportCallbackMode;
  url?: string;
  session_id?: string;
}

export interface WalletAbiTransportRequestEnvelope {
  v: typeof WALLET_ABI_TRANSPORT_VERSION;
  request_id: string;
  origin: string;
  created_at_ms: number;
  expires_at_ms: number;
  callback?: WalletAbiTransportCallback;
  message: WalletAbiJsonRpcRequest;
}

export interface WalletAbiTransportResponseEnvelope {
  v: typeof WALLET_ABI_TRANSPORT_VERSION;
  request_id: string;
  origin: string;
  processed_at_ms: number;
  message: WalletAbiJsonRpcResponse;
}

export interface WalletAbiTransportDecodeOptions {
  maxDecodedBytes?: number;
}

export interface WalletAbiTransportChunk {
  index: number;
  total: number;
  payload: string;
}

export interface BuildWalletAbiAppLinkOptions {
  baseUrl?: string;
}

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

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new WalletAbiProtocolError(`${context} must be a string`);
  }

  return value;
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WalletAbiProtocolError(`${context} must be a finite number`);
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

function parseTransportCallbackMode(
  value: unknown,
  context: string,
): WalletAbiTransportCallbackMode {
  const mode = expectString(value, context);

  if (
    mode !== "same_device_https" &&
    mode !== "backend_push" &&
    mode !== "qr_roundtrip"
  ) {
    throw new WalletAbiProtocolError(
      `${context} must be one of "same_device_https", "backend_push", or "qr_roundtrip"`,
    );
  }

  return mode;
}

function parseTransportCallback(value: unknown): WalletAbiTransportCallback {
  const record = expectRecord(value, "wallet_abi_transport_request.callback");

  return {
    mode: parseTransportCallbackMode(
      record.mode,
      "wallet_abi_transport_request.callback.mode",
    ),
    ...(record.url !== undefined
      ? {
          url: expectString(
            record.url,
            "wallet_abi_transport_request.callback.url",
          ),
        }
      : {}),
    ...(record.session_id !== undefined
      ? {
          session_id: expectString(
            record.session_id,
            "wallet_abi_transport_request.callback.session_id",
          ),
        }
      : {}),
  };
}

function encodeBase64Url(bytes: Uint8Array): string {
  return base64url.stringify(bytes, { pad: false });
}

function decodeBase64Url(value: string): Uint8Array {
  try {
    return base64url.parse(value, { loose: true });
  } catch {
    throw new WalletAbiProtocolError("invalid base64url encoding");
  }
}

function extractFragment(fragmentOrUrl: string): string {
  if (!fragmentOrUrl.includes("#")) {
    return fragmentOrUrl.startsWith("#")
      ? fragmentOrUrl.slice(1)
      : fragmentOrUrl;
  }

  return fragmentOrUrl.split("#")[1] ?? "";
}

function parseChunkPrefix(value: string): WalletAbiTransportChunk {
  const match = /^wa1:(\d+)\/(\d+):(.*)$/u.exec(value);
  if (match === null) {
    throw new WalletAbiProtocolError("invalid chunk encoding");
  }

  const index = Number.parseInt(match[1] ?? "", 10);
  const total = Number.parseInt(match[2] ?? "", 10);
  const payload = match[3] ?? "";

  if (!Number.isInteger(index) || !Number.isInteger(total)) {
    throw new WalletAbiProtocolError("invalid chunk metadata");
  }

  if (index < 0 || total < 1 || index >= total) {
    throw new WalletAbiProtocolError("invalid chunk metadata");
  }

  return { index, total, payload };
}

export function createGetCapabilitiesRequest(
  id: number,
): WalletAbiGetCapabilitiesRequest {
  return {
    id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    method: WALLET_ABI_GET_CAPABILITIES_METHOD,
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

export function createTransportRequestEnvelope(input: {
  request_id: string;
  origin: string;
  created_at_ms: number;
  expires_at_ms: number;
  message: WalletAbiJsonRpcRequest;
  callback?: WalletAbiTransportCallback;
}): WalletAbiTransportRequestEnvelope {
  return {
    v: WALLET_ABI_TRANSPORT_VERSION,
    request_id: input.request_id,
    origin: input.origin,
    created_at_ms: input.created_at_ms,
    expires_at_ms: input.expires_at_ms,
    ...(input.callback !== undefined ? { callback: input.callback } : {}),
    message: input.message,
  };
}

export function createTransportResponseEnvelope(input: {
  request_id: string;
  origin: string;
  processed_at_ms: number;
  message: WalletAbiJsonRpcResponse;
}): WalletAbiTransportResponseEnvelope {
  return {
    v: WALLET_ABI_TRANSPORT_VERSION,
    request_id: input.request_id,
    origin: input.origin,
    processed_at_ms: input.processed_at_ms,
    message: input.message,
  };
}

export function isJsonRpcErrorResponse(
  value: WalletAbiJsonRpcResponse,
): value is WalletAbiJsonRpcErrorResponse {
  return "error" in value;
}

export function isWalletAbiCapabilitiesResponse(
  value: WalletAbiJsonRpcResponse,
): value is WalletAbiCapabilitiesResponse {
  return (
    !isJsonRpcErrorResponse(value) && "signer_receive_address" in value.result
  );
}

export function isWalletAbiProcessResponse(
  value: WalletAbiJsonRpcResponse,
): value is WalletAbiProcessResponse {
  return !isJsonRpcErrorResponse(value) && "status" in value.result;
}

export function encodeWalletAbiTransportPayload(value: object): string {
  const serialized = textEncoder.encode(JSON.stringify(value));
  return encodeBase64Url(gzipSync(serialized));
}

export function decodeWalletAbiTransportPayload<T>(
  encoded: string,
  parse: (value: unknown) => T,
  options: WalletAbiTransportDecodeOptions = {},
): T {
  const maxDecodedBytes =
    options.maxDecodedBytes ?? WALLET_ABI_TRANSPORT_MAX_DECODED_BYTES;

  let bytes = decodeBase64Url(encoded);

  try {
    bytes = gunzipSync(bytes);
  } catch {
    // Backward compatibility with uncompressed payloads.
  }

  if (bytes.length > maxDecodedBytes) {
    throw new WalletAbiProtocolError(
      `transport payload exceeds ${String(maxDecodedBytes)} bytes`,
    );
  }

  return parse(JSON.parse(textDecoder.decode(bytes)) as unknown);
}

export function encodeWalletAbiTransportRequestEnvelope(
  value: WalletAbiTransportRequestEnvelope,
): string {
  return encodeWalletAbiTransportPayload(value);
}

export function encodeWalletAbiTransportResponseEnvelope(
  value: WalletAbiTransportResponseEnvelope,
): string {
  return encodeWalletAbiTransportPayload(value);
}

export function parseWalletAbiJsonRpcRequest(
  value: unknown,
): WalletAbiJsonRpcRequest {
  const record = expectRecord(value, "wallet_abi_json_rpc_request");

  const id = expectNumber(record.id, "wallet_abi_json_rpc_request.id");
  expectJsonRpcVersion(record.jsonrpc, "wallet_abi_json_rpc_request.jsonrpc");
  const method = expectString(
    record.method,
    "wallet_abi_json_rpc_request.method",
  );

  if (method === WALLET_ABI_GET_CAPABILITIES_METHOD) {
    return {
      id,
      jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
      method,
      ...(record.params !== undefined
        ? {
            params: expectRecord(
              record.params,
              "wallet_abi_json_rpc_request.params",
            ) as Record<string, never>,
          }
        : {}),
    };
  }

  if (method === WALLET_ABI_PROCESS_REQUEST_METHOD) {
    return {
      id,
      jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
      method,
      params: parseTxCreateRequest(record.params),
    };
  }

  throw new WalletAbiProtocolError(`unsupported JSON-RPC method "${method}"`);
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
      "wallet_abi_json_rpc_response must contain result or error",
    );
  }

  try {
    return {
      id,
      jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
      result: parseWalletAbiCapabilities(record.result),
    };
  } catch {
    return {
      id,
      jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
      result: parseTxCreateResponse(record.result),
    };
  }
}

export function parseWalletAbiTransportRequestEnvelope(
  value: unknown,
): WalletAbiTransportRequestEnvelope {
  const record = expectRecord(value, "wallet_abi_transport_request");

  if (record.v !== WALLET_ABI_TRANSPORT_VERSION) {
    throw new WalletAbiProtocolError(
      `wallet_abi_transport_request.v must be ${String(WALLET_ABI_TRANSPORT_VERSION)}`,
    );
  }

  const request = {
    v: WALLET_ABI_TRANSPORT_VERSION,
    request_id: expectString(
      record.request_id,
      "wallet_abi_transport_request.request_id",
    ),
    origin: expectString(record.origin, "wallet_abi_transport_request.origin"),
    created_at_ms: expectNumber(
      record.created_at_ms,
      "wallet_abi_transport_request.created_at_ms",
    ),
    expires_at_ms: expectNumber(
      record.expires_at_ms,
      "wallet_abi_transport_request.expires_at_ms",
    ),
    message: parseWalletAbiJsonRpcRequest(record.message),
  };

  if (record.callback === undefined) {
    return request;
  }

  return {
    ...request,
    callback: parseTransportCallback(record.callback),
  };
}

export function parseWalletAbiTransportResponseEnvelope(
  value: unknown,
): WalletAbiTransportResponseEnvelope {
  const record = expectRecord(value, "wallet_abi_transport_response");

  if (record.v !== WALLET_ABI_TRANSPORT_VERSION) {
    throw new WalletAbiProtocolError(
      `wallet_abi_transport_response.v must be ${String(WALLET_ABI_TRANSPORT_VERSION)}`,
    );
  }

  return {
    v: WALLET_ABI_TRANSPORT_VERSION,
    request_id: expectString(
      record.request_id,
      "wallet_abi_transport_response.request_id",
    ),
    origin: expectString(record.origin, "wallet_abi_transport_response.origin"),
    processed_at_ms: expectNumber(
      record.processed_at_ms,
      "wallet_abi_transport_response.processed_at_ms",
    ),
    message: parseWalletAbiJsonRpcResponse(record.message),
  };
}

export function decodeWalletAbiTransportRequestEnvelope(
  encoded: string,
  options: WalletAbiTransportDecodeOptions = {},
): WalletAbiTransportRequestEnvelope {
  return decodeWalletAbiTransportPayload(
    encoded,
    parseWalletAbiTransportRequestEnvelope,
    options,
  );
}

export function decodeWalletAbiTransportResponseEnvelope(
  encoded: string,
  options: WalletAbiTransportDecodeOptions = {},
): WalletAbiTransportResponseEnvelope {
  return decodeWalletAbiTransportPayload(
    encoded,
    parseWalletAbiTransportResponseEnvelope,
    options,
  );
}

export function chunkWalletAbiTransportPayload(
  encodedPayload: string,
  maxChunkSize = 1024,
): string[] {
  if (!Number.isInteger(maxChunkSize) || maxChunkSize < 64) {
    throw new WalletAbiProtocolError("maxChunkSize must be an integer >= 64");
  }

  if (encodedPayload.length <= maxChunkSize) {
    return [encodedPayload];
  }

  const estimatedChunks = Math.ceil(
    encodedPayload.length / Math.max(1, maxChunkSize - 16),
  );
  const rawChunkSize = Math.ceil(encodedPayload.length / estimatedChunks);
  const chunks: string[] = [];

  for (let index = 0; index < estimatedChunks; index += 1) {
    const start = index * rawChunkSize;
    const end = Math.min(encodedPayload.length, (index + 1) * rawChunkSize);
    chunks.push(
      `${CHUNK_PREFIX}${String(index)}/${String(estimatedChunks)}:${encodedPayload.slice(start, end)}`,
    );
  }

  return chunks;
}

export function joinWalletAbiTransportChunks(chunks: string[]): string {
  if (chunks.length === 0) {
    throw new WalletAbiProtocolError("at least one chunk is required");
  }

  if (chunks.length === 1 && !chunks[0]?.startsWith(CHUNK_PREFIX)) {
    return chunks[0] ?? "";
  }

  const parsed = chunks.map(parseChunkPrefix);
  const expectedTotal = parsed[0]?.total ?? 0;

  if (!parsed.every((chunk) => chunk.total === expectedTotal)) {
    throw new WalletAbiProtocolError("chunk total mismatch");
  }

  if (parsed.length !== expectedTotal) {
    throw new WalletAbiProtocolError("missing chunk(s)");
  }

  const parts = Array<string>(expectedTotal).fill("");
  for (const chunk of parsed) {
    if (parts[chunk.index] !== "") {
      throw new WalletAbiProtocolError("duplicate chunk index");
    }
    parts[chunk.index] = chunk.payload;
  }

  if (parts.some((part) => part.length === 0)) {
    throw new WalletAbiProtocolError("incomplete chunk set");
  }

  return parts.join("");
}

export function extractWalletAbiTransportFragment(
  fragmentOrUrl: string,
  key:
    | typeof WALLET_ABI_TRANSPORT_REQUEST_PARAM
    | typeof WALLET_ABI_TRANSPORT_RESPONSE_PARAM,
): string | null {
  const params = new URLSearchParams(extractFragment(fragmentOrUrl));
  return params.get(key);
}

export function buildWalletAbiAppLinkUri(
  envelope: WalletAbiTransportRequestEnvelope,
  options: BuildWalletAbiAppLinkOptions = {},
): string {
  const baseUrl = new URL(options.baseUrl ?? DEFAULT_WALLET_ABI_APP_LINK);
  const encoded = encodeWalletAbiTransportRequestEnvelope(envelope);
  baseUrl.hash = `${WALLET_ABI_TRANSPORT_REQUEST_PARAM}=${encoded}`;
  return baseUrl.toString();
}

export function buildWalletAbiCallbackUri(
  callbackUrl: string,
  envelope: WalletAbiTransportResponseEnvelope,
): string {
  const url = new URL(callbackUrl);
  if (url.protocol !== "https:") {
    throw new WalletAbiProtocolError("callbackUrl must use https");
  }

  url.hash = `${WALLET_ABI_TRANSPORT_RESPONSE_PARAM}=${encodeWalletAbiTransportResponseEnvelope(envelope)}`;
  return url.toString();
}

export function parseWalletAbiAppLinkRequest(
  fragmentOrUrl: string,
): WalletAbiTransportRequestEnvelope {
  const encoded = extractWalletAbiTransportFragment(
    fragmentOrUrl,
    WALLET_ABI_TRANSPORT_REQUEST_PARAM,
  );

  if (encoded === null || encoded.length === 0) {
    throw new WalletAbiProtocolError(
      `${WALLET_ABI_TRANSPORT_REQUEST_PARAM} fragment parameter is missing`,
    );
  }

  return decodeWalletAbiTransportRequestEnvelope(encoded);
}

export function parseWalletAbiCallback(
  fragmentOrUrl: string,
): WalletAbiTransportResponseEnvelope {
  const encoded = extractWalletAbiTransportFragment(
    fragmentOrUrl,
    WALLET_ABI_TRANSPORT_RESPONSE_PARAM,
  );

  if (encoded === null || encoded.length === 0) {
    throw new WalletAbiProtocolError(
      `${WALLET_ABI_TRANSPORT_RESPONSE_PARAM} fragment parameter is missing`,
    );
  }

  return decodeWalletAbiTransportResponseEnvelope(encoded);
}
