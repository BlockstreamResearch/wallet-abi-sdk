import {
  WALLET_ABI_GET_CAPABILITIES_METHOD,
  WALLET_ABI_JSON_RPC_VERSION,
  type WalletAbiJsonRpcErrorResponse,
  type WalletAbiJsonRpcRequest,
  type WalletAbiJsonRpcResponse,
} from "./protocol.js";
import type {
  TxCreateRequest,
  TxCreateResponse,
  WalletAbiCapabilities,
} from "./schema.js";

const JSON_RPC_INVALID_PARAMS = -32602;

type MaybePromise<T> = Promise<T> | T;

export interface WalletAbiProviderBridge {
  getCapabilities(): MaybePromise<WalletAbiCapabilities>;
  processRequest(request: TxCreateRequest): MaybePromise<TxCreateResponse>;
}

export interface WalletAbiJsonRpcProvider {
  request(
    request: WalletAbiJsonRpcRequest,
  ): MaybePromise<WalletAbiJsonRpcResponse>;
}

function createErrorResponse(
  request: WalletAbiJsonRpcRequest,
  code: number,
  message: string,
): WalletAbiJsonRpcErrorResponse {
  return {
    id: request.id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    error: {
      code,
      message,
    },
  };
}

export function createWalletAbiJsonRpcProvider(
  bridge: WalletAbiProviderBridge,
): WalletAbiJsonRpcProvider {
  return {
    async request(request) {
      if (request.method === WALLET_ABI_GET_CAPABILITIES_METHOD) {
        if (
          request.params !== undefined &&
          Object.keys(request.params).length > 0
        ) {
          return createErrorResponse(
            request,
            JSON_RPC_INVALID_PARAMS,
            `method "${WALLET_ABI_GET_CAPABILITIES_METHOD}" does not accept params`,
          );
        }

        return {
          id: request.id,
          jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
          result: await bridge.getCapabilities(),
        };
      }

      return {
        id: request.id,
        jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
        result: await bridge.processRequest(request.params),
      };
    },
  };
}
