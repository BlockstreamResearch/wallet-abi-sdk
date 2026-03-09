import {
  GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD,
  GET_SIGNER_RECEIVE_ADDRESS_METHOD,
  WALLET_ABI_JSON_RPC_VERSION,
  WALLET_ABI_PROCESS_REQUEST_METHOD,
  type WalletAbiJsonRpcErrorResponse,
  type WalletAbiJsonRpcRequest,
  type WalletAbiJsonRpcResponse,
} from "./protocol.js";
import type {
  TxCreateRequest,
  TxCreateResponse,
  WalletAbiAddress,
  WalletAbiXOnlyPublicKeyHex,
} from "./schema.js";

const JSON_RPC_INVALID_PARAMS = -32602;

type MaybePromise<T> = Promise<T> | T;

export interface WalletAbiProviderBridge {
  getSignerReceiveAddress(): MaybePromise<WalletAbiAddress>;
  getRawSigningXOnlyPubkey(): MaybePromise<WalletAbiXOnlyPublicKeyHex>;
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
      switch (request.method) {
        case GET_SIGNER_RECEIVE_ADDRESS_METHOD:
          if (
            request.params !== undefined &&
            Object.keys(request.params).length > 0
          ) {
            return createErrorResponse(
              request,
              JSON_RPC_INVALID_PARAMS,
              `method "${GET_SIGNER_RECEIVE_ADDRESS_METHOD}" does not accept params`,
            );
          }

          return {
            id: request.id,
            jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
            result: {
              signer_receive_address: await bridge.getSignerReceiveAddress(),
            },
          };

        case GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD:
          if (
            request.params !== undefined &&
            Object.keys(request.params).length > 0
          ) {
            return createErrorResponse(
              request,
              JSON_RPC_INVALID_PARAMS,
              `method "${GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD}" does not accept params`,
            );
          }

          return {
            id: request.id,
            jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
            result: {
              raw_signing_x_only_pubkey:
                await bridge.getRawSigningXOnlyPubkey(),
            },
          };

        case WALLET_ABI_PROCESS_REQUEST_METHOD:
          return {
            id: request.id,
            jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
            result: await bridge.processRequest(request.params),
          };
      }
    },
  };
}
