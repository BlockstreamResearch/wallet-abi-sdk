import {
  GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD,
  GET_SIGNER_RECEIVE_ADDRESS_METHOD,
  WALLET_ABI_PROCESS_REQUEST_METHOD,
  createGetRawSigningXOnlyPubkeyRequest,
  createGetSignerReceiveAddressRequest,
  createProcessRequest,
  isJsonRpcErrorResponse,
  isWalletAbiGetRawSigningXOnlyPubkeyResponse,
  isWalletAbiGetSignerReceiveAddressResponse,
  isWalletAbiProcessResponse,
} from "./protocol.js";
import type {
  TxCreateRequest,
  TxCreateResponse,
  WalletAbiAddress,
  WalletAbiXOnlyPublicKeyHex,
} from "./schema.js";
import type { WalletAbiRequester } from "./walletconnect.js";

interface WalletAbiClientEventMap {
  connected: undefined;
  disconnected: undefined;
}

export interface WalletAbiClientOptions {
  requester: WalletAbiRequester;
  requestTimeoutMs?: number;
}

export class WalletAbiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAbiClientError";
  }
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

export class WalletAbiClient {
  readonly #requester: WalletAbiRequester;
  readonly #requestTimeoutMs: number;
  readonly #listeners = new Map<
    keyof WalletAbiClientEventMap,
    Set<(payload: unknown) => void>
  >();

  #connectPromise: Promise<void> | null = null;
  #rpcRequestId = 0;
  #connected = false;
  #signerReceiveAddress: WalletAbiAddress | null = null;
  #rawSigningXOnlyPubkey: WalletAbiXOnlyPublicKeyHex | null = null;

  constructor(options: WalletAbiClientOptions) {
    this.#requester = options.requester;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
  }

  on<K extends keyof WalletAbiClientEventMap>(
    event: K,
    listener: (payload: WalletAbiClientEventMap[K]) => void,
  ): () => void {
    const listeners =
      this.#listeners.get(event) ?? new Set<(payload: unknown) => void>();
    listeners.add(listener as (payload: unknown) => void);
    this.#listeners.set(event, listeners);

    return () => {
      listeners.delete(listener as unknown as (payload: unknown) => void);
    };
  }

  isConnected(): boolean {
    return this.#connected;
  }

  getCachedSignerReceiveAddress(): WalletAbiAddress | null {
    return this.#signerReceiveAddress;
  }

  getCachedRawSigningXOnlyPubkey(): WalletAbiXOnlyPublicKeyHex | null {
    return this.#rawSigningXOnlyPubkey;
  }

  async connect(): Promise<void> {
    if (this.#connected) {
      return;
    }

    if (this.#connectPromise !== null) {
      await this.#connectPromise;
      return;
    }

    this.#connectPromise = (async () => {
      await this.#requester.connect?.();
      this.#connected = true;
      this.#emit("connected", undefined);
    })();

    try {
      await this.#connectPromise;
    } finally {
      this.#connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    this.#connected = false;
    this.#signerReceiveAddress = null;
    this.#rawSigningXOnlyPubkey = null;
    await this.#requester.disconnect?.();
    this.#emit("disconnected", undefined);
  }

  async getSignerReceiveAddress(): Promise<WalletAbiAddress> {
    if (this.#signerReceiveAddress !== null) {
      return this.#signerReceiveAddress;
    }

    const response = await this.#sendJsonRpc(
      createGetSignerReceiveAddressRequest(this.#nextRpcRequestId()),
    );

    if (isJsonRpcErrorResponse(response)) {
      throw new WalletAbiClientError(
        `${GET_SIGNER_RECEIVE_ADDRESS_METHOD} failed: ${response.error.message}`,
      );
    }

    if (!isWalletAbiGetSignerReceiveAddressResponse(response)) {
      throw new WalletAbiClientError(
        `expected ${GET_SIGNER_RECEIVE_ADDRESS_METHOD} result`,
      );
    }

    this.#signerReceiveAddress = response.result.signer_receive_address;
    return this.#signerReceiveAddress;
  }

  async getRawSigningXOnlyPubkey(): Promise<WalletAbiXOnlyPublicKeyHex> {
    if (this.#rawSigningXOnlyPubkey !== null) {
      return this.#rawSigningXOnlyPubkey;
    }

    const response = await this.#sendJsonRpc(
      createGetRawSigningXOnlyPubkeyRequest(this.#nextRpcRequestId()),
    );

    if (isJsonRpcErrorResponse(response)) {
      throw new WalletAbiClientError(
        `${GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD} failed: ${response.error.message}`,
      );
    }

    if (!isWalletAbiGetRawSigningXOnlyPubkeyResponse(response)) {
      throw new WalletAbiClientError(
        `expected ${GET_RAW_SIGNING_X_ONLY_PUBKEY_METHOD} result`,
      );
    }

    this.#rawSigningXOnlyPubkey = response.result.raw_signing_x_only_pubkey;
    return this.#rawSigningXOnlyPubkey;
  }

  async processRequest(request: TxCreateRequest): Promise<TxCreateResponse> {
    const response = await this.#sendJsonRpc(
      createProcessRequest(this.#nextRpcRequestId(), request),
    );

    if (isJsonRpcErrorResponse(response)) {
      throw new WalletAbiClientError(
        `wallet JSON-RPC error ${String(response.error.code)}: ${response.error.message}`,
      );
    }

    if (!isWalletAbiProcessResponse(response)) {
      throw new WalletAbiClientError(
        `expected ${WALLET_ABI_PROCESS_REQUEST_METHOD} result`,
      );
    }

    return response.result;
  }

  async requestTxCreate(request: TxCreateRequest): Promise<TxCreateResponse> {
    return this.processRequest(request);
  }

  #nextRpcRequestId(): number {
    this.#rpcRequestId += 1;
    return this.#rpcRequestId;
  }

  #emit<K extends keyof WalletAbiClientEventMap>(
    event: K,
    payload: WalletAbiClientEventMap[K],
  ): void {
    const listeners = this.#listeners.get(event);
    if (listeners === undefined) {
      return;
    }

    for (const listener of listeners) {
      listener(payload);
    }
  }

  async #sendJsonRpc(
    request:
      | ReturnType<typeof createGetSignerReceiveAddressRequest>
      | ReturnType<typeof createGetRawSigningXOnlyPubkeyRequest>
      | ReturnType<typeof createProcessRequest>,
  ) {
    await this.connect();

    try {
      return await this.#withTimeout(
        Promise.resolve(this.#requester.request(request)),
        `wallet request ${request.method} timed out after ${String(this.#requestTimeoutMs)}ms`,
      );
    } catch (error) {
      if (error instanceof WalletAbiClientError) {
        throw error;
      }

      throw new WalletAbiClientError(normalizeErrorMessage(error));
    }
  }

  async #withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new WalletAbiClientError(message));
      }, this.#requestTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}
