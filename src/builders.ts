import {
  TX_CREATE_ABI_VERSION,
  type AssetVariant,
  type BlinderVariant,
  type FinalizerSpec,
  type InputSchema,
  type InputUnblinding,
  type InternalKeySource,
  type LockVariant,
  type OutputSchema,
  type RuntimeParams,
  type TxCreateRequest,
  type WalletAbiLockTime,
  type WalletAbiNetwork,
  type WalletSourceFilter,
} from "./schema.js";

const DEFAULT_SEQUENCE = 0xffff_ffff;

export function generateRequestId(): string {
  const cryptoApi = Reflect.get(globalThis, "crypto") as
    | {
        randomUUID?: () => string;
      }
    | undefined;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  throw new Error(
    "Wallet ABI SDK requires globalThis.crypto.randomUUID() support.",
  );
}

function createWalletSourceFilter(
  overrides: Partial<WalletSourceFilter> = {},
): WalletSourceFilter {
  return {
    asset: "none",
    amount: "none",
    lock: "none",
    ...overrides,
  };
}

function createWalletFinalizer(): FinalizerSpec {
  return {
    type: "wallet",
  };
}

export function createSimfFinalizer(input: {
  source_simf: string;
  arguments: Uint8Array | number[];
  witness: Uint8Array | number[];
  internal_key?: InternalKeySource;
}): FinalizerSpec {
  return {
    type: "simf",
    source_simf: input.source_simf,
    internal_key: input.internal_key ?? "bip0341",
    arguments: Array.from(input.arguments),
    witness: Array.from(input.witness),
  };
}

export function createWalletInput(input: {
  id: string;
  filter?: Partial<WalletSourceFilter>;
  unblinding?: InputUnblinding;
  sequence?: number;
  finalizer?: FinalizerSpec;
  issuance?: InputSchema["issuance"];
}): InputSchema {
  return {
    id: input.id,
    utxo_source: {
      wallet: {
        filter: createWalletSourceFilter(input.filter),
      },
    },
    unblinding: input.unblinding ?? "wallet",
    sequence: input.sequence ?? DEFAULT_SEQUENCE,
    ...(input.issuance !== undefined ? { issuance: input.issuance } : {}),
    finalizer: input.finalizer ?? createWalletFinalizer(),
  };
}

export function createProvidedInput(input: {
  id: string;
  outpoint: string;
  unblinding?: InputUnblinding;
  sequence?: number;
  finalizer?: FinalizerSpec;
  issuance?: InputSchema["issuance"];
}): InputSchema {
  return {
    id: input.id,
    utxo_source: {
      provided: {
        outpoint: input.outpoint,
      },
    },
    unblinding: input.unblinding ?? "explicit",
    sequence: input.sequence ?? DEFAULT_SEQUENCE,
    ...(input.issuance !== undefined ? { issuance: input.issuance } : {}),
    finalizer: input.finalizer ?? createWalletFinalizer(),
  };
}

export function createScriptLock(script: string): LockVariant {
  return {
    type: "script",
    script,
  };
}

export function createFinalizerLock(finalizer: FinalizerSpec): LockVariant {
  return {
    type: "finalizer",
    finalizer,
  };
}

export function createExplicitAsset(asset_id: string): AssetVariant {
  return {
    type: "asset_id",
    asset_id,
  };
}

export function createNewIssuanceAsset(input_index: number): AssetVariant {
  return {
    type: "new_issuance_asset",
    input_index,
  };
}

export function createNewIssuanceToken(input_index: number): AssetVariant {
  return {
    type: "new_issuance_token",
    input_index,
  };
}

export function createReIssuanceAsset(input_index: number): AssetVariant {
  return {
    type: "re_issuance_asset",
    input_index,
  };
}

function createWalletBlinder(): BlinderVariant {
  return "wallet";
}

export function createExplicitBlinder(): BlinderVariant {
  return "explicit";
}

export function createProvidedBlinder(pubkey: string): BlinderVariant {
  return {
    provided: {
      pubkey,
    },
  };
}

export function createOutput(input: {
  id: string;
  amount_sat: number;
  lock: LockVariant;
  asset: AssetVariant;
  blinder?: BlinderVariant;
}): OutputSchema {
  return {
    id: input.id,
    amount_sat: input.amount_sat,
    lock: input.lock,
    asset: input.asset,
    blinder: input.blinder ?? createWalletBlinder(),
  };
}

export function createRuntimeParams(input: {
  inputs?: InputSchema[];
  outputs?: OutputSchema[];
  fee_rate_sat_kvb?: number;
  lock_time?: WalletAbiLockTime;
}): RuntimeParams {
  return {
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    ...(input.fee_rate_sat_kvb !== undefined
      ? { fee_rate_sat_kvb: input.fee_rate_sat_kvb }
      : {}),
    ...(input.lock_time !== undefined ? { lock_time: input.lock_time } : {}),
  };
}

export function createTxCreateRequest(input: {
  network: WalletAbiNetwork;
  params: RuntimeParams;
  broadcast?: boolean;
  request_id?: string;
  abi_version?: string;
}): TxCreateRequest {
  return {
    abi_version: input.abi_version ?? TX_CREATE_ABI_VERSION,
    request_id: input.request_id ?? generateRequestId(),
    network: input.network,
    params: input.params,
    broadcast: input.broadcast ?? false,
  };
}
