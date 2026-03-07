export const TX_CREATE_ABI_VERSION = "wallet-abi-0.1";

export const WALLET_ABI_NETWORKS = [
  "liquid",
  "testnet-liquid",
  "localtest-liquid",
] as const;

export type WalletAbiNetwork = (typeof WALLET_ABI_NETWORKS)[number];
export type WalletAbiTxid = string;
export type WalletAbiAssetId = string;
export type WalletAbiAddress = string;
export type WalletAbiScriptHex = string;
export type WalletAbiPublicKeyHex = string;
export type WalletAbiSecretKeyHex = string;
export type WalletAbiXOnlyPublicKeyHex = string;
export type WalletAbiOutPoint = string;
export type WalletAbiUuid = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type WalletAbiErrorCode =
  | "invalid_request"
  | "serde"
  | "program_error"
  | "derivation"
  | "try_from_int"
  | "funding"
  | "invalid_signer_config"
  | "invalid_response"
  | "pset"
  | "pset_blind"
  | "amount_proof_verification"
  | "invalid_finalization_steps"
  | (string & {});

export interface ErrorInfo {
  code: WalletAbiErrorCode;
  message: string;
  details?: JsonValue;
}

export type WalletAbiLockTime =
  | {
      Blocks: number;
    }
  | {
      Seconds: number;
    };

export type AssetFilter =
  | "none"
  | {
      exact: {
        asset_id: WalletAbiAssetId;
      };
    };

export type AmountFilter =
  | "none"
  | {
      exact: {
        amount_sat: number;
      };
    }
  | {
      min: {
        amount_sat: number;
      };
    };

export type LockFilter =
  | "none"
  | {
      script: {
        script: WalletAbiScriptHex;
      };
    };

export interface WalletSourceFilter {
  asset: AssetFilter;
  amount: AmountFilter;
  lock: LockFilter;
}

export type UTXOSource =
  | {
      wallet: {
        filter: WalletSourceFilter;
      };
    }
  | {
      provided: {
        outpoint: WalletAbiOutPoint;
      };
    };

export type InputIssuanceKind = "new" | "reissue";

export interface InputIssuance {
  kind: InputIssuanceKind;
  asset_amount_sat: number;
  token_amount_sat: number;
  entropy: number[];
}

export type TaprootIdentity =
  | {
      Seed: number[];
    }
  | {
      ExternalXOnly: WalletAbiXOnlyPublicKeyHex;
    };

export interface TaprootPubkeyGen {
  identity: TaprootIdentity;
  pubkey: WalletAbiPublicKeyHex;
  address: WalletAbiAddress;
}

export type InternalKeySource =
  | "bip0341"
  | {
      external: {
        key: TaprootPubkeyGen;
      };
    };

export type FinalizerSpec =
  | {
      type: "wallet";
    }
  | {
      type: "simf";
      source_simf: string;
      internal_key: InternalKeySource;
      arguments: number[];
      witness: number[];
    };

export type InputUnblinding =
  | "wallet"
  | "explicit"
  | {
      provided: {
        secret_key: WalletAbiSecretKeyHex;
      };
    };

export interface InputSchema {
  id: string;
  utxo_source: UTXOSource;
  unblinding: InputUnblinding;
  sequence: number;
  issuance?: InputIssuance;
  finalizer: FinalizerSpec;
}

export type LockVariant =
  | {
      type: "script";
      script: WalletAbiScriptHex;
    }
  | {
      type: "finalizer";
      finalizer: FinalizerSpec;
    };

export type AssetVariant =
  | {
      type: "asset_id";
      asset_id: WalletAbiAssetId;
    }
  | {
      type: "new_issuance_asset";
      input_index: number;
    }
  | {
      type: "new_issuance_token";
      input_index: number;
    }
  | {
      type: "re_issuance_asset";
      input_index: number;
    };

export type BlinderVariant =
  | "wallet"
  | "explicit"
  | {
      provided: {
        pubkey: WalletAbiPublicKeyHex;
      };
    };

export interface OutputSchema {
  id: string;
  amount_sat: number;
  lock: LockVariant;
  asset: AssetVariant;
  blinder: BlinderVariant;
}

export interface RuntimeParams {
  inputs: InputSchema[];
  outputs: OutputSchema[];
  fee_rate_sat_kvb?: number;
  lock_time?: WalletAbiLockTime;
}

export interface TxCreateRequest {
  abi_version: string;
  request_id: WalletAbiUuid;
  network: WalletAbiNetwork;
  params: RuntimeParams;
  broadcast: boolean;
}

export interface TransactionInfo {
  tx_hex: string;
  txid: WalletAbiTxid;
}

export type TxCreateArtifacts = Record<string, JsonValue>;
export type WalletAbiStatus = "ok" | "error";

interface TxCreateResponseBase {
  abi_version: string;
  request_id: WalletAbiUuid;
  network: WalletAbiNetwork;
  artifacts?: TxCreateArtifacts;
}

export interface TxCreateOkResponse extends TxCreateResponseBase {
  status: "ok";
  transaction: TransactionInfo;
  error?: never;
}

export interface TxCreateErrorResponse extends TxCreateResponseBase {
  status: "error";
  error: ErrorInfo;
  transaction?: never;
}

export type TxCreateResponse = TxCreateOkResponse | TxCreateErrorResponse;

export type RuntimeSimfValue =
  | {
      new_issuance_asset: {
        input_index: number;
      };
    }
  | {
      new_issuance_token: {
        input_index: number;
      };
    };

export type RuntimeSimfWitness = {
  sig_hash_all: {
    name: string;
    public_key: WalletAbiXOnlyPublicKeyHex;
  };
};

export interface SimfArguments {
  resolved: Record<string, JsonValue>;
  runtime_arguments: Record<string, RuntimeSimfValue>;
}

export interface SimfWitness {
  resolved: Record<string, JsonValue>;
  runtime_arguments: RuntimeSimfWitness[];
}

export interface WalletAbiCapabilities {
  abi_version: string;
  network: WalletAbiNetwork;
  signer_receive_address: WalletAbiAddress;
  signing_x_only_pubkey: WalletAbiXOnlyPublicKeyHex;
}

export class WalletAbiSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAbiSchemaError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(value: unknown, context: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new WalletAbiSchemaError(`${context} must be an object`);
  }

  return value;
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new WalletAbiSchemaError(`${context} must be a string`);
  }

  return value;
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new WalletAbiSchemaError(`${context} must be a finite number`);
  }

  return value;
}

function expectBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new WalletAbiSchemaError(`${context} must be a boolean`);
  }

  return value;
}

function expectArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new WalletAbiSchemaError(`${context} must be an array`);
  }

  return value;
}

export function isWalletAbiNetwork(value: unknown): value is WalletAbiNetwork {
  return (
    typeof value === "string" &&
    WALLET_ABI_NETWORKS.includes(value as WalletAbiNetwork)
  );
}

function parseJsonValue(value: unknown, context: string): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return expectNumber(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      parseJsonValue(entry, `${context}[${String(index)}]`),
    );
  }

  return parseJsonObject(value, context);
}

function parseJsonObject(value: unknown, context: string): JsonObject {
  const record = expectRecord(value, context);
  const parsed: JsonObject = {};

  for (const [key, entry] of Object.entries(record)) {
    parsed[key] = parseJsonValue(entry, `${context}.${key}`);
  }

  return parsed;
}

function parseNumberArray(value: unknown, context: string): number[] {
  return expectArray(value, context).map((entry, index) =>
    expectNumber(entry, `${context}[${String(index)}]`),
  );
}

function parseTaprootIdentity(value: unknown): TaprootIdentity {
  const record = expectRecord(value, "taproot_identity");

  if (record.Seed !== undefined) {
    return {
      Seed: parseNumberArray(record.Seed, "taproot_identity.Seed"),
    };
  }

  if (record.ExternalXOnly !== undefined) {
    return {
      ExternalXOnly: expectString(
        record.ExternalXOnly,
        "taproot_identity.ExternalXOnly",
      ),
    };
  }

  throw new WalletAbiSchemaError(
    'taproot_identity must contain "Seed" or "ExternalXOnly"',
  );
}

function parseTaprootPubkeyGen(value: unknown): TaprootPubkeyGen {
  const record = expectRecord(value, "taproot_pubkey_gen");

  return {
    identity: parseTaprootIdentity(record.identity),
    pubkey: expectString(record.pubkey, "taproot_pubkey_gen.pubkey"),
    address: expectString(record.address, "taproot_pubkey_gen.address"),
  };
}

function parseAssetFilter(value: unknown): AssetFilter {
  if (value === "none") {
    return value;
  }

  const record = expectRecord(value, "wallet_source_filter.asset");
  const exact = expectRecord(record.exact, "wallet_source_filter.asset.exact");

  return {
    exact: {
      asset_id: expectString(
        exact.asset_id,
        "wallet_source_filter.asset.exact.asset_id",
      ),
    },
  };
}

function parseAmountFilter(value: unknown): AmountFilter {
  if (value === "none") {
    return value;
  }

  const record = expectRecord(value, "wallet_source_filter.amount");

  if (record.exact !== undefined) {
    const exact = expectRecord(
      record.exact,
      "wallet_source_filter.amount.exact",
    );

    return {
      exact: {
        amount_sat: expectNumber(
          exact.amount_sat,
          "wallet_source_filter.amount.exact.amount_sat",
        ),
      },
    };
  }

  if (record.min !== undefined) {
    const min = expectRecord(record.min, "wallet_source_filter.amount.min");

    return {
      min: {
        amount_sat: expectNumber(
          min.amount_sat,
          "wallet_source_filter.amount.min.amount_sat",
        ),
      },
    };
  }

  throw new WalletAbiSchemaError(
    'wallet_source_filter.amount must be "none", "exact", or "min"',
  );
}

function parseLockFilter(value: unknown): LockFilter {
  if (value === "none") {
    return value;
  }

  const record = expectRecord(value, "wallet_source_filter.lock");
  const script = expectRecord(
    record.script,
    "wallet_source_filter.lock.script",
  );

  return {
    script: {
      script: expectString(
        script.script,
        "wallet_source_filter.lock.script.script",
      ),
    },
  };
}

function parseWalletSourceFilter(value: unknown): WalletSourceFilter {
  const record = expectRecord(value, "wallet_source_filter");

  return {
    asset: parseAssetFilter(record.asset),
    amount: parseAmountFilter(record.amount),
    lock: parseLockFilter(record.lock),
  };
}

function parseUtxoSource(value: unknown): UTXOSource {
  const record = expectRecord(value, "input.utxo_source");

  if (record.wallet !== undefined) {
    const wallet = expectRecord(record.wallet, "input.utxo_source.wallet");
    return {
      wallet: {
        filter: parseWalletSourceFilter(wallet.filter),
      },
    };
  }

  if (record.provided !== undefined) {
    const provided = expectRecord(
      record.provided,
      "input.utxo_source.provided",
    );

    return {
      provided: {
        outpoint: expectString(
          provided.outpoint,
          "input.utxo_source.provided.outpoint",
        ),
      },
    };
  }

  throw new WalletAbiSchemaError(
    'input.utxo_source must contain "wallet" or "provided"',
  );
}

function parseInputIssuance(value: unknown): InputIssuance {
  const record = expectRecord(value, "input.issuance");
  const kind = expectString(record.kind, "input.issuance.kind");

  if (kind !== "new" && kind !== "reissue") {
    throw new WalletAbiSchemaError(
      `input.issuance.kind must be "new" or "reissue", got "${kind}"`,
    );
  }

  return {
    kind,
    asset_amount_sat: expectNumber(
      record.asset_amount_sat,
      "input.issuance.asset_amount_sat",
    ),
    token_amount_sat: expectNumber(
      record.token_amount_sat,
      "input.issuance.token_amount_sat",
    ),
    entropy: parseNumberArray(record.entropy, "input.issuance.entropy"),
  };
}

function parseInputUnblinding(value: unknown): InputUnblinding {
  if (value === "wallet" || value === "explicit") {
    return value;
  }

  const record = expectRecord(value, "input.unblinding");
  const provided = expectRecord(record.provided, "input.unblinding.provided");

  return {
    provided: {
      secret_key: expectString(
        provided.secret_key,
        "input.unblinding.provided.secret_key",
      ),
    },
  };
}

function parseLockVariant(value: unknown): LockVariant {
  const record = expectRecord(value, "output.lock");
  const type = expectString(record.type, "output.lock.type");

  if (type === "script") {
    return {
      type,
      script: expectString(record.script, "output.lock.script"),
    };
  }

  if (type === "finalizer") {
    return {
      type,
      finalizer: parseFinalizerSpec(record.finalizer),
    };
  }

  throw new WalletAbiSchemaError(
    `output.lock.type must be "script" or "finalizer", got "${type}"`,
  );
}

function parseAssetVariant(value: unknown): AssetVariant {
  const record = expectRecord(value, "output.asset");
  const type = expectString(record.type, "output.asset.type");

  switch (type) {
    case "asset_id":
      return {
        type,
        asset_id: expectString(record.asset_id, "output.asset.asset_id"),
      };
    case "new_issuance_asset":
    case "new_issuance_token":
    case "re_issuance_asset":
      return {
        type,
        input_index: expectNumber(
          record.input_index,
          "output.asset.input_index",
        ),
      };
    default:
      throw new WalletAbiSchemaError(
        `output.asset.type is unsupported: "${type}"`,
      );
  }
}

function parseBlinderVariant(value: unknown): BlinderVariant {
  if (value === "wallet" || value === "explicit") {
    return value;
  }

  const record = expectRecord(value, "output.blinder");
  const provided = expectRecord(record.provided, "output.blinder.provided");

  return {
    provided: {
      pubkey: expectString(provided.pubkey, "output.blinder.provided.pubkey"),
    },
  };
}

function parseInputSchema(value: unknown, context: string): InputSchema {
  const record = expectRecord(value, context);

  return {
    id: expectString(record.id, `${context}.id`),
    utxo_source: parseUtxoSource(record.utxo_source),
    unblinding: parseInputUnblinding(record.unblinding),
    sequence: expectNumber(record.sequence, `${context}.sequence`),
    ...(record.issuance !== undefined
      ? { issuance: parseInputIssuance(record.issuance) }
      : {}),
    finalizer: parseFinalizerSpec(record.finalizer),
  };
}

function parseOutputSchema(value: unknown, context: string): OutputSchema {
  const record = expectRecord(value, context);

  return {
    id: expectString(record.id, `${context}.id`),
    amount_sat: expectNumber(record.amount_sat, `${context}.amount_sat`),
    lock: parseLockVariant(record.lock),
    asset: parseAssetVariant(record.asset),
    blinder: parseBlinderVariant(record.blinder),
  };
}

function parseLockTime(value: unknown): WalletAbiLockTime {
  const record = expectRecord(value, "runtime_params.lock_time");
  const hasBlocks = record.Blocks !== undefined;
  const hasSeconds = record.Seconds !== undefined;

  if (hasBlocks === hasSeconds) {
    throw new WalletAbiSchemaError(
      'runtime_params.lock_time must contain exactly one of "Blocks" or "Seconds"',
    );
  }

  if (hasBlocks) {
    return {
      Blocks: expectNumber(record.Blocks, "runtime_params.lock_time.Blocks"),
    };
  }

  return {
    Seconds: expectNumber(record.Seconds, "runtime_params.lock_time.Seconds"),
  };
}

function parseRuntimeParams(value: unknown): RuntimeParams {
  const record = expectRecord(value, "tx_create_request.params");
  const inputs = expectArray(record.inputs, "tx_create_request.params.inputs");
  const outputs = expectArray(
    record.outputs,
    "tx_create_request.params.outputs",
  );

  return {
    inputs: inputs.map((entry, index) =>
      parseInputSchema(
        entry,
        `tx_create_request.params.inputs[${String(index)}]`,
      ),
    ),
    outputs: outputs.map((entry, index) =>
      parseOutputSchema(
        entry,
        `tx_create_request.params.outputs[${String(index)}]`,
      ),
    ),
    ...(record.fee_rate_sat_kvb !== undefined
      ? {
          fee_rate_sat_kvb: expectNumber(
            record.fee_rate_sat_kvb,
            "tx_create_request.params.fee_rate_sat_kvb",
          ),
        }
      : {}),
    ...(record.lock_time !== undefined
      ? { lock_time: parseLockTime(record.lock_time) }
      : {}),
  };
}

function parseTransactionInfo(value: unknown): TransactionInfo {
  const record = expectRecord(value, "tx_create_response.transaction");

  return {
    tx_hex: expectString(
      record.tx_hex,
      "tx_create_response.transaction.tx_hex",
    ),
    txid: expectString(record.txid, "tx_create_response.transaction.txid"),
  };
}

export function parseErrorInfo(value: unknown): ErrorInfo {
  const record = expectRecord(value, "error_info");

  return {
    code: expectString(record.code, "error_info.code"),
    message: expectString(record.message, "error_info.message"),
    ...(record.details !== undefined
      ? { details: parseJsonValue(record.details, "error_info.details") }
      : {}),
  };
}

export function parseInternalKeySource(value: unknown): InternalKeySource {
  if (value === "bip0341") {
    return value;
  }

  const record = expectRecord(value, "internal_key_source");
  const external = expectRecord(
    record.external,
    "internal_key_source.external",
  );

  return {
    external: {
      key: parseTaprootPubkeyGen(external.key),
    },
  };
}

export function parseFinalizerSpec(value: unknown): FinalizerSpec {
  const record = expectRecord(value, "finalizer");
  const type = expectString(record.type, "finalizer.type");

  if (type === "wallet") {
    return {
      type,
    };
  }

  if (type !== "simf") {
    throw new WalletAbiSchemaError(
      `finalizer.type must be "wallet" or "simf", got "${type}"`,
    );
  }

  return {
    type,
    source_simf: expectString(record.source_simf, "finalizer.source_simf"),
    internal_key: parseInternalKeySource(record.internal_key),
    arguments: parseNumberArray(record.arguments, "finalizer.arguments"),
    witness: parseNumberArray(record.witness, "finalizer.witness"),
  };
}

export function parseWalletAbiCapabilities(
  value: unknown,
): WalletAbiCapabilities {
  const record = expectRecord(value, "wallet_abi_capabilities");
  const network = record.network;

  if (!isWalletAbiNetwork(network)) {
    throw new WalletAbiSchemaError(
      "wallet_abi_capabilities.network must be a supported wallet ABI network",
    );
  }

  return {
    abi_version: expectString(
      record.abi_version,
      "wallet_abi_capabilities.abi_version",
    ),
    network,
    signer_receive_address: expectString(
      record.signer_receive_address,
      "wallet_abi_capabilities.signer_receive_address",
    ),
    signing_x_only_pubkey: expectString(
      record.signing_x_only_pubkey,
      "wallet_abi_capabilities.signing_x_only_pubkey",
    ),
  };
}

export function parseTxCreateRequest(value: unknown): TxCreateRequest {
  const record = expectRecord(value, "tx_create_request");
  const network = record.network;

  if (!isWalletAbiNetwork(network)) {
    throw new WalletAbiSchemaError(
      "tx_create_request.network must be a supported wallet ABI network",
    );
  }

  return {
    abi_version: expectString(
      record.abi_version,
      "tx_create_request.abi_version",
    ),
    request_id: expectString(record.request_id, "tx_create_request.request_id"),
    network,
    params: parseRuntimeParams(record.params),
    broadcast: expectBoolean(record.broadcast, "tx_create_request.broadcast"),
  };
}

export function parseTxCreateResponse(value: unknown): TxCreateResponse {
  const record = expectRecord(value, "tx_create_response");
  const network = record.network;

  if (!isWalletAbiNetwork(network)) {
    throw new WalletAbiSchemaError(
      "tx_create_response.network must be a supported wallet ABI network",
    );
  }

  const base = {
    abi_version: expectString(
      record.abi_version,
      "tx_create_response.abi_version",
    ),
    request_id: expectString(
      record.request_id,
      "tx_create_response.request_id",
    ),
    network,
    ...(record.artifacts !== undefined
      ? {
          artifacts: parseJsonObject(
            record.artifacts,
            "tx_create_response.artifacts",
          ),
        }
      : {}),
  };

  const status = expectString(record.status, "tx_create_response.status");
  if (status === "ok") {
    if (record.error !== undefined) {
      throw new WalletAbiSchemaError(
        'tx_create_response with status "ok" must not include error',
      );
    }

    return {
      ...base,
      status,
      transaction: parseTransactionInfo(record.transaction),
    };
  }

  if (status === "error") {
    if (record.transaction !== undefined) {
      throw new WalletAbiSchemaError(
        'tx_create_response with status "error" must not include transaction',
      );
    }

    return {
      ...base,
      status,
      error: parseErrorInfo(record.error),
    };
  }

  throw new WalletAbiSchemaError(
    `tx_create_response.status must be "ok" or "error", got "${status}"`,
  );
}
