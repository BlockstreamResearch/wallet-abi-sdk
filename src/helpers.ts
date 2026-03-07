import type {
  RuntimeSimfValue,
  RuntimeSimfWitness,
  TaprootPubkeyGen,
  WalletAbiAssetId,
  WalletAbiNetwork,
} from "./schema.js";

export interface WalletAbiWasmNetwork {
  toString(): string;
}

export interface WalletAbiWasmXOnlyPublicKey {
  toString(): string;
}

export type WalletAbiWasmTypedValue = object;

export interface WalletAbiWasmSimplicityArguments {
  addValue(
    name: string,
    value: WalletAbiWasmTypedValue,
  ): WalletAbiWasmSimplicityArguments;
}

export interface WalletAbiWasmSimplicityWitnessValues {
  addValue(
    name: string,
    value: WalletAbiWasmTypedValue,
  ): WalletAbiWasmSimplicityWitnessValues;
}

interface WalletAbiAddressLike {
  toString(): string;
}

type WalletAbiWasmOutPoint = object;

interface WalletAbiWasmContractHash {
  toString(): string;
}

interface WalletAbiWasmAssetId {
  toString(): string;
}

interface WalletAbiWasmProgram {
  createP2trAddress(
    internal_key: WalletAbiWasmXOnlyPublicKey,
    network: WalletAbiWasmNetwork,
  ): WalletAbiAddressLike;
}

export interface WalletAbiLwkWasmModule {
  default(init?: unknown): Promise<unknown>;
  SimplicityArguments: new () => WalletAbiWasmSimplicityArguments;
  SimplicityWitnessValues: new () => WalletAbiWasmSimplicityWitnessValues;
  SimplicityTypedValue: {
    fromU32(value: number): WalletAbiWasmTypedValue;
    fromU256Hex(value: string): WalletAbiWasmTypedValue;
    fromByteArrayHex(value: string): WalletAbiWasmTypedValue;
  };
  SimplicityProgram: {
    load(
      source: string,
      arguments_: WalletAbiWasmSimplicityArguments,
    ): WalletAbiWasmProgram;
  };
  XOnlyPublicKey: {
    fromString(value: string): WalletAbiWasmXOnlyPublicKey;
  };
  Network: {
    mainnet(): WalletAbiWasmNetwork;
    testnet(): WalletAbiWasmNetwork;
    regtestDefault(): WalletAbiWasmNetwork;
  };
  OutPoint: new (value: string) => WalletAbiWasmOutPoint;
  ContractHash: {
    fromString(value: string): WalletAbiWasmContractHash;
  };
  walletAbiSerializeArguments(
    resolved: WalletAbiWasmSimplicityArguments,
    runtime_arguments: Record<string, RuntimeSimfValue>,
  ): Uint8Array;
  walletAbiSerializeWitness(
    resolved: WalletAbiWasmSimplicityWitnessValues,
    runtime_arguments: RuntimeSimfWitness[],
  ): Uint8Array;
  walletAbiCreateTaprootHandle(
    source_simf: string,
    resolved_arguments: WalletAbiWasmSimplicityArguments,
    network: WalletAbiWasmNetwork,
  ): {
    handle: string;
    key: TaprootPubkeyGen;
  };
  walletAbiCreateExternalTaprootHandle(
    source_simf: string,
    resolved_arguments: WalletAbiWasmSimplicityArguments,
    x_only_public_key: WalletAbiWasmXOnlyPublicKey,
    network: WalletAbiWasmNetwork,
  ): {
    handle: string;
    key: TaprootPubkeyGen;
  };
  walletAbiVerifyTaprootHandle(
    handle: string,
    source_simf: string,
    resolved_arguments: WalletAbiWasmSimplicityArguments,
    network: WalletAbiWasmNetwork,
  ): {
    handle: string;
    key: TaprootPubkeyGen;
  };
  generateAssetEntropy(
    outpoint: WalletAbiWasmOutPoint,
    contract_hash: WalletAbiWasmContractHash,
  ): WalletAbiWasmContractHash;
  assetIdFromIssuance(
    outpoint: WalletAbiWasmOutPoint,
    contract_hash: WalletAbiWasmContractHash,
  ): WalletAbiWasmAssetId;
  reissuanceTokenFromIssuance(
    outpoint: WalletAbiWasmOutPoint,
    contract_hash: WalletAbiWasmContractHash,
    is_confidential: boolean,
  ): WalletAbiWasmAssetId;
}

export interface WalletAbiTaprootHandleResult {
  handle: string;
  key: TaprootPubkeyGen;
}

export class WalletAbiHelperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAbiHelperError";
  }
}

let modulePromise: Promise<WalletAbiLwkWasmModule> | undefined;

async function getModule(): Promise<WalletAbiLwkWasmModule> {
  if (modulePromise === undefined) {
    modulePromise = (async () => {
      const imported = (await import(
        new URL("./vendor/lwk_wasm/lwk_wasm.js", import.meta.url).href
      )) as WalletAbiLwkWasmModule;
      await imported.default();
      return imported;
    })();
  }

  return await modulePromise;
}

function resolveNetwork(
  wasm: WalletAbiLwkWasmModule,
  network: WalletAbiNetwork | WalletAbiWasmNetwork,
): WalletAbiWasmNetwork {
  if (typeof network !== "string") {
    return network;
  }

  switch (network) {
    case "liquid":
      return wasm.Network.mainnet();
    case "testnet-liquid":
      return wasm.Network.testnet();
    case "localtest-liquid":
      return wasm.Network.regtestDefault();
  }

  throw new WalletAbiHelperError(`unsupported network "${network}"`);
}

function resolveXOnlyPublicKey(
  wasm: WalletAbiLwkWasmModule,
  value: string | WalletAbiWasmXOnlyPublicKey,
): WalletAbiWasmXOnlyPublicKey {
  return typeof value === "string"
    ? wasm.XOnlyPublicKey.fromString(value)
    : value;
}

function resolveContractHash(
  wasm: WalletAbiLwkWasmModule,
  value: string | WalletAbiWasmContractHash,
): WalletAbiWasmContractHash {
  return typeof value === "string"
    ? wasm.ContractHash.fromString(value)
    : value;
}

export async function loadWalletAbiLwkWasm(): Promise<WalletAbiLwkWasmModule> {
  return await getModule();
}

export async function createSimplicityArgumentsBuilder(): Promise<WalletAbiWasmSimplicityArguments> {
  const wasm = await getModule();
  return new wasm.SimplicityArguments();
}

export async function createSimplicityWitnessValuesBuilder(): Promise<WalletAbiWasmSimplicityWitnessValues> {
  const wasm = await getModule();
  return new wasm.SimplicityWitnessValues();
}

export async function createLwkNetwork(
  network: WalletAbiNetwork,
): Promise<WalletAbiWasmNetwork> {
  const wasm = await getModule();
  return resolveNetwork(wasm, network);
}

export async function createLwkXOnlyPublicKey(
  value: string,
): Promise<WalletAbiWasmXOnlyPublicKey> {
  const wasm = await getModule();
  return wasm.XOnlyPublicKey.fromString(value);
}

export async function serializeSimfArguments(
  resolved: WalletAbiWasmSimplicityArguments,
  runtime_arguments: Record<string, RuntimeSimfValue>,
): Promise<Uint8Array> {
  const wasm = await getModule();
  return wasm.walletAbiSerializeArguments(resolved, runtime_arguments);
}

export async function serializeSimfWitness(
  resolved: WalletAbiWasmSimplicityWitnessValues,
  runtime_arguments: RuntimeSimfWitness[],
): Promise<Uint8Array> {
  const wasm = await getModule();
  return wasm.walletAbiSerializeWitness(resolved, runtime_arguments);
}

export async function createTaprootHandle(input: {
  source_simf: string;
  resolved_arguments: WalletAbiWasmSimplicityArguments;
  network: WalletAbiNetwork | WalletAbiWasmNetwork;
}): Promise<WalletAbiTaprootHandleResult> {
  const wasm = await getModule();
  return wasm.walletAbiCreateTaprootHandle(
    input.source_simf,
    input.resolved_arguments,
    resolveNetwork(wasm, input.network),
  );
}

export async function createExternalTaprootHandle(input: {
  source_simf: string;
  resolved_arguments: WalletAbiWasmSimplicityArguments;
  x_only_public_key: string | WalletAbiWasmXOnlyPublicKey;
  network: WalletAbiNetwork | WalletAbiWasmNetwork;
}): Promise<WalletAbiTaprootHandleResult> {
  const wasm = await getModule();
  return wasm.walletAbiCreateExternalTaprootHandle(
    input.source_simf,
    input.resolved_arguments,
    resolveXOnlyPublicKey(wasm, input.x_only_public_key),
    resolveNetwork(wasm, input.network),
  );
}

export async function verifyTaprootHandle(input: {
  handle: string;
  source_simf: string;
  resolved_arguments: WalletAbiWasmSimplicityArguments;
  network: WalletAbiNetwork | WalletAbiWasmNetwork;
}): Promise<WalletAbiTaprootHandleResult> {
  const wasm = await getModule();
  return wasm.walletAbiVerifyTaprootHandle(
    input.handle,
    input.source_simf,
    input.resolved_arguments,
    resolveNetwork(wasm, input.network),
  );
}

export async function generateIssuanceAssetEntropy(input: {
  outpoint: string;
  contract_hash: string | WalletAbiWasmContractHash;
}): Promise<string> {
  const wasm = await getModule();
  const entropy = wasm.generateAssetEntropy(
    new wasm.OutPoint(input.outpoint),
    resolveContractHash(wasm, input.contract_hash),
  );
  return entropy.toString();
}

export async function deriveAssetIdFromIssuance(input: {
  outpoint: string;
  contract_hash: string | WalletAbiWasmContractHash;
}): Promise<WalletAbiAssetId> {
  const wasm = await getModule();
  return wasm
    .assetIdFromIssuance(
      new wasm.OutPoint(input.outpoint),
      resolveContractHash(wasm, input.contract_hash),
    )
    .toString();
}

export async function deriveReissuanceTokenFromIssuance(input: {
  outpoint: string;
  contract_hash: string | WalletAbiWasmContractHash;
  is_confidential?: boolean;
}): Promise<WalletAbiAssetId> {
  const wasm = await getModule();
  return wasm
    .reissuanceTokenFromIssuance(
      new wasm.OutPoint(input.outpoint),
      resolveContractHash(wasm, input.contract_hash),
      input.is_confidential ?? false,
    )
    .toString();
}

export async function createSimplicityP2trAddress(input: {
  source_simf: string;
  resolved_arguments: WalletAbiWasmSimplicityArguments;
  internal_key: string | WalletAbiWasmXOnlyPublicKey;
  network: WalletAbiNetwork | WalletAbiWasmNetwork;
}): Promise<string> {
  const wasm = await getModule();
  const program = wasm.SimplicityProgram.load(
    input.source_simf,
    input.resolved_arguments,
  );

  return program
    .createP2trAddress(
      resolveXOnlyPublicKey(wasm, input.internal_key),
      resolveNetwork(wasm, input.network),
    )
    .toString();
}
