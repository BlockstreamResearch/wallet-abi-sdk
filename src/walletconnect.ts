import {
  GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD,
  GET_SIGNER_RECEIVE_ADDRESS_METHOD,
  WALLET_ABI_JSON_RPC_VERSION,
  WALLET_ABI_METHODS,
  WALLET_ABI_PROCESS_REQUEST_METHOD,
  type WalletAbiJsonRpcRequest,
  type WalletAbiJsonRpcResponse,
  type WalletAbiMethod,
} from "./protocol.js";
import type { WalletAbiNetwork } from "./schema.js";

type MaybePromise<T> = Promise<T> | T;

export interface WalletAbiRequester {
  connect?(): MaybePromise<void>;
  disconnect?(): MaybePromise<void>;
  request(
    request: WalletAbiJsonRpcRequest,
  ): MaybePromise<WalletAbiJsonRpcResponse>;
}

export const WALLET_ABI_WALLETCONNECT_NAMESPACE = "walabi" as const;
export const WALLET_ABI_WALLETCONNECT_CHAINS = [
  "walabi:liquid",
  "walabi:testnet-liquid",
  "walabi:localtest-liquid",
] as const;
export const WALLET_ABI_WALLETCONNECT_EVENTS = [] as const;
export const WALLET_ABI_WALLETCONNECT_METHODS = WALLET_ABI_METHODS;

export type WalletAbiWalletConnectChain =
  (typeof WALLET_ABI_WALLETCONNECT_CHAINS)[number];

export interface WalletAbiWalletConnectNamespace {
  methods: readonly WalletAbiMethod[];
  chains: readonly WalletAbiWalletConnectChain[];
  events: readonly string[];
  accounts?: readonly string[];
}

export interface WalletAbiWalletConnectSessionRequest {
  chainId: WalletAbiWalletConnectChain;
  request: {
    method: WalletAbiMethod;
    params?: unknown;
  };
  topic?: string;
}

export interface WalletAbiWalletConnectClient {
  connect?(): MaybePromise<void>;
  disconnect?(): MaybePromise<void>;
  request(input: WalletAbiWalletConnectSessionRequest): MaybePromise<unknown>;
}

export interface CreateWalletConnectRequesterOptions {
  chainId: WalletAbiWalletConnectChain;
  client: WalletAbiWalletConnectClient;
  topic?: string;
  getTopic?(): string | null | undefined;
}

function resolveTopic(
  options: CreateWalletConnectRequesterOptions,
): string | undefined {
  const dynamicTopic = options.getTopic?.();
  if (dynamicTopic === null) {
    return undefined;
  }

  if (dynamicTopic !== undefined) {
    return dynamicTopic.trim() || undefined;
  }

  return options.topic?.trim() || undefined;
}

function extractRequestParams(request: WalletAbiJsonRpcRequest): unknown {
  if (request.method === WALLET_ABI_PROCESS_REQUEST_METHOD) {
    return request.params;
  }

  if (
    request.params === undefined ||
    Object.keys(request.params).length === 0
  ) {
    // WalletConnect/Reown expects a concrete JSON object for custom RPC getter calls.
    return {};
  }

  return request.params;
}

export function isWalletAbiWalletConnectChain(
  value: string,
): value is WalletAbiWalletConnectChain {
  return WALLET_ABI_WALLETCONNECT_CHAINS.includes(
    value as WalletAbiWalletConnectChain,
  );
}

export function walletAbiNetworkToWalletConnectChain(
  network: WalletAbiNetwork,
): WalletAbiWalletConnectChain {
  switch (network) {
    case "liquid":
      return "walabi:liquid";
    case "testnet-liquid":
      return "walabi:testnet-liquid";
    case "localtest-liquid":
      return "walabi:localtest-liquid";
  }
}

export function walletConnectChainToWalletAbiNetwork(
  chainId: WalletAbiWalletConnectChain,
): WalletAbiNetwork {
  switch (chainId) {
    case "walabi:liquid":
      return "liquid";
    case "walabi:testnet-liquid":
      return "testnet-liquid";
    case "walabi:localtest-liquid":
      return "localtest-liquid";
  }
}

export function createWalletAbiRequiredNamespaces(
  input:
    | WalletAbiNetwork
    | WalletAbiWalletConnectChain
    | readonly WalletAbiWalletConnectChain[],
): Record<
  typeof WALLET_ABI_WALLETCONNECT_NAMESPACE,
  WalletAbiWalletConnectNamespace
> {
  let chains: readonly WalletAbiWalletConnectChain[];

  if (Array.isArray(input)) {
    chains = input;
  } else {
    const singleInput = input as WalletAbiNetwork | WalletAbiWalletConnectChain;

    if (isWalletAbiWalletConnectChain(singleInput)) {
      chains = [singleInput];
    } else {
      chains = [walletAbiNetworkToWalletConnectChain(singleInput)];
    }
  }

  return {
    [WALLET_ABI_WALLETCONNECT_NAMESPACE]: {
      methods: WALLET_ABI_WALLETCONNECT_METHODS,
      chains,
      events: WALLET_ABI_WALLETCONNECT_EVENTS,
    },
  };
}

export function buildWalletAbiCaip10Account(
  chainId: WalletAbiWalletConnectChain,
  accountId: string,
): string {
  return `${chainId}:${accountId}`;
}

export function createWalletConnectRequester(
  options: CreateWalletConnectRequesterOptions,
): WalletAbiRequester {
  return {
    connect() {
      return options.client.connect?.();
    },
    disconnect() {
      return options.client.disconnect?.();
    },
    async request(request) {
      const topic = resolveTopic(options);
      const params = extractRequestParams(request);
      const result = await options.client.request({
        chainId: options.chainId,
        ...(topic === undefined ? {} : { topic }),
        request: {
          method: request.method,
          ...(params === undefined ? {} : { params }),
        },
      });

      return createWalletAbiJsonRpcEnvelopeFromResult(request, result);
    },
  };
}

export function isWalletAbiMethod(value: string): value is WalletAbiMethod {
  return WALLET_ABI_WALLETCONNECT_METHODS.includes(value as WalletAbiMethod);
}

export function isWalletAbiGetterMethod(
  value: string,
): value is
  | typeof GET_SIGNER_RECEIVE_ADDRESS_METHOD
  | typeof GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD {
  return (
    value === GET_SIGNER_RECEIVE_ADDRESS_METHOD ||
    value === GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD
  );
}

export function isWalletAbiProcessMethod(
  value: string,
): value is typeof WALLET_ABI_PROCESS_REQUEST_METHOD {
  return value === WALLET_ABI_PROCESS_REQUEST_METHOD;
}

export function createWalletAbiJsonRpcEnvelopeFromResult(
  request: WalletAbiJsonRpcRequest,
  result: unknown,
): WalletAbiJsonRpcResponse {
  let normalizedResult = result;

  if (typeof normalizedResult === "string") {
    try {
      normalizedResult = JSON.parse(normalizedResult);
    } catch {
      // Keep non-JSON strings as-is so caller-side validation can decide.
    }
  }

  return {
    id: request.id,
    jsonrpc: WALLET_ABI_JSON_RPC_VERSION,
    result: normalizedResult,
  } as WalletAbiJsonRpcResponse;
}
