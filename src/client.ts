import {
  WALLET_ABI_GET_CAPABILITIES_METHOD,
  createGetCapabilitiesRequest,
  createProcessRequest,
  createTransportRequestEnvelope,
  isJsonRpcErrorResponse,
  isWalletAbiCapabilitiesResponse,
  isWalletAbiProcessResponse,
  type WalletAbiTransportCallback,
  type WalletAbiTransportResponseEnvelope,
} from "./protocol.js";
import type {
  WalletAbiDisplayUriPayload,
  WalletAbiTransportAdapter,
} from "./transports.js";
import type {
  TxCreateRequest,
  TxCreateResponse,
  WalletAbiCapabilities,
} from "./schema.js";

interface WalletAbiClientEventMap {
  connected: WalletAbiCapabilities;
  disconnected: undefined;
  display_uri: WalletAbiDisplayUriPayload;
  response: WalletAbiTransportResponseEnvelope;
}

export interface WalletAbiClientOptions {
  transport: WalletAbiTransportAdapter;
  origin: string;
  requestTimeoutMs?: number;
  callback?: WalletAbiTransportCallback;
  clock?: () => number;
}

export class WalletAbiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAbiClientError";
  }
}

export class WalletAbiClient {
  readonly #transport: WalletAbiTransportAdapter;
  readonly #origin: string;
  readonly #requestTimeoutMs: number;
  readonly #callback: WalletAbiTransportCallback | undefined;
  readonly #clock: () => number;
  readonly #listeners = new Map<
    keyof WalletAbiClientEventMap,
    Set<(payload: unknown) => void>
  >();

  #capabilities: WalletAbiCapabilities | null = null;
  #connectPromise: Promise<WalletAbiCapabilities> | null = null;
  #rpcRequestId = 0;

  constructor(options: WalletAbiClientOptions) {
    this.#transport = options.transport;
    this.#origin = options.origin;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
    this.#callback = options.callback;
    this.#clock = options.clock ?? (() => Date.now());
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

  getCapabilities(): WalletAbiCapabilities | null {
    return this.#capabilities;
  }

  async connect(): Promise<WalletAbiCapabilities> {
    if (this.#capabilities !== null) {
      return this.#capabilities;
    }

    if (this.#connectPromise !== null) {
      return await this.#connectPromise;
    }

    this.#connectPromise = (async () => {
      await this.#transport.connect?.();

      const response = await this.#sendJsonRpc(
        crypto.randomUUID(),
        createGetCapabilitiesRequest(this.#nextRpcRequestId()),
      );

      if (!isWalletAbiCapabilitiesResponse(response.message)) {
        if (isJsonRpcErrorResponse(response.message)) {
          throw new WalletAbiClientError(
            `capabilities request failed: ${response.message.error.message}`,
          );
        }

        throw new WalletAbiClientError(
          `expected ${WALLET_ABI_GET_CAPABILITIES_METHOD} result`,
        );
      }

      this.#capabilities = response.message.result;
      this.#emit("connected", response.message.result);
      return response.message.result;
    })();

    try {
      return await this.#connectPromise;
    } finally {
      this.#connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    this.#capabilities = null;
    await this.#transport.disconnect?.();
    this.#emit("disconnected", undefined);
  }

  async requestTxCreate(request: TxCreateRequest): Promise<TxCreateResponse> {
    const capabilities = await this.connect();

    if (request.abi_version !== capabilities.abi_version) {
      throw new WalletAbiClientError(
        `request abi_version "${request.abi_version}" does not match wallet abi_version "${capabilities.abi_version}"`,
      );
    }

    if (request.network !== capabilities.network) {
      throw new WalletAbiClientError(
        `request network "${request.network}" does not match wallet network "${capabilities.network}"`,
      );
    }

    const response = await this.#sendJsonRpc(
      request.request_id,
      createProcessRequest(this.#nextRpcRequestId(), request),
    );

    if (response.request_id !== request.request_id) {
      throw new WalletAbiClientError(
        `transport request_id mismatch: expected "${request.request_id}", got "${response.request_id}"`,
      );
    }

    if (isJsonRpcErrorResponse(response.message)) {
      throw new WalletAbiClientError(
        `wallet JSON-RPC error ${String(response.message.error.code)}: ${response.message.error.message}`,
      );
    }

    if (!isWalletAbiProcessResponse(response.message)) {
      throw new WalletAbiClientError(
        "wallet returned a non-transaction JSON-RPC result",
      );
    }

    return response.message.result;
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
    requestId: string,
    message:
      | ReturnType<typeof createGetCapabilitiesRequest>
      | ReturnType<typeof createProcessRequest>,
  ): Promise<WalletAbiTransportResponseEnvelope> {
    const createdAt = this.#clock();
    const requestEnvelope = createTransportRequestEnvelope({
      request_id: requestId,
      origin: this.#origin,
      created_at_ms: createdAt,
      expires_at_ms: createdAt + this.#requestTimeoutMs,
      message,
      ...(this.#callback !== undefined ? { callback: this.#callback } : {}),
    });

    const responsePromise = Promise.resolve(
      this.#transport.request(requestEnvelope, {
        now: this.#clock,
        emitDisplayUri: (payload) => {
          this.#emit("display_uri", payload);
        },
      }),
    );

    const response = await this.#withTimeout(
      responsePromise,
      `wallet transport request ${requestId} timed out after ${String(this.#requestTimeoutMs)}ms`,
    );

    if (response.message.id !== message.id) {
      throw new WalletAbiClientError(
        `JSON-RPC id mismatch: expected ${String(message.id)}, got ${String(response.message.id)}`,
      );
    }

    this.#emit("response", response);
    return response;
  }

  async #withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new WalletAbiClientError(message));
      }, this.#requestTimeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}
