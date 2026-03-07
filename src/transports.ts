import {
  buildWalletAbiAppLinkUri,
  decodeWalletAbiTransportResponseEnvelope,
  encodeWalletAbiTransportRequestEnvelope,
  parseWalletAbiCallback,
  chunkWalletAbiTransportPayload,
  type WalletAbiTransportRequestEnvelope,
  type WalletAbiTransportResponseEnvelope,
} from "./protocol.js";

type MaybePromise<T> = Promise<T> | T;

export interface WalletAbiDisplayUriPayload {
  uri: string;
  chunks: string[];
  encoded: string;
  request: WalletAbiTransportRequestEnvelope;
}

export interface WalletAbiTransportRequestContext {
  now(): number;
  emitDisplayUri(payload: WalletAbiDisplayUriPayload): void;
}

export interface WalletAbiTransportAdapter {
  readonly kind: string;
  connect?(): MaybePromise<void>;
  disconnect?(): MaybePromise<void>;
  request(
    envelope: WalletAbiTransportRequestEnvelope,
    context: WalletAbiTransportRequestContext,
  ): MaybePromise<WalletAbiTransportResponseEnvelope>;
}

export interface WalletAbiPendingAppLinkRequest {
  request: WalletAbiTransportRequestEnvelope;
  encoded: string;
  uri: string;
  chunks: string[];
}

export interface CreateAppLinkTransportOptions {
  baseUrl?: string;
  chunkSize?: number;
  openUri?(uri: string): MaybePromise<void>;
  awaitResponse(
    pending: WalletAbiPendingAppLinkRequest,
  ): MaybePromise<string | WalletAbiTransportResponseEnvelope>;
}

function parseAppLinkResponse(
  response: string | WalletAbiTransportResponseEnvelope,
): WalletAbiTransportResponseEnvelope {
  if (typeof response !== "string") {
    return response;
  }

  try {
    return parseWalletAbiCallback(response);
  } catch {
    return decodeWalletAbiTransportResponseEnvelope(response);
  }
}

export function createAppLinkTransport(
  options: CreateAppLinkTransportOptions,
): WalletAbiTransportAdapter {
  return {
    kind: "app-link",
    async request(envelope, context) {
      const encoded = encodeWalletAbiTransportRequestEnvelope(envelope);
      const uri = buildWalletAbiAppLinkUri(
        envelope,
        options.baseUrl !== undefined ? { baseUrl: options.baseUrl } : {},
      );
      const chunks = chunkWalletAbiTransportPayload(encoded, options.chunkSize);

      context.emitDisplayUri({
        uri,
        chunks,
        encoded,
        request: envelope,
      });

      if (options.openUri !== undefined) {
        await options.openUri(uri);
      }

      const response = await options.awaitResponse({
        request: envelope,
        encoded,
        uri,
        chunks,
      });

      return parseAppLinkResponse(response);
    },
  };
}
