import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  createExternalTaprootHandle,
  createSimplicityArgumentsBuilder,
  createSimplicityP2trAddress,
  createSimplicityWitnessValuesBuilder,
  deriveAssetIdFromIssuance,
  deriveReissuanceTokenFromIssuance,
  generateIssuanceAssetEntropy,
  loadWalletAbiLwkWasm,
  serializeSimfArguments,
  serializeSimfWitness,
  verifyTaprootHandle,
} from "../src/helpers.js";

const p2pkSource = readFileSync(
  new URL("./fixtures/p2pk.simf", import.meta.url),
  "utf8",
);

describe("lwk_wasm helper wrappers", () => {
  test("serializes Simplicity arguments and witness payloads", async () => {
    const wasm = await loadWalletAbiLwkWasm();

    let argumentsBuilder = await createSimplicityArgumentsBuilder();
    argumentsBuilder = argumentsBuilder.addValue(
      "PUBLIC_KEY",
      wasm.SimplicityTypedValue.fromU32(7),
    );

    const argumentsBytes = await serializeSimfArguments(argumentsBuilder, {
      ISSUED_ASSET: {
        new_issuance_asset: {
          input_index: 0,
        },
      },
    });

    expect(JSON.parse(new TextDecoder().decode(argumentsBytes))).toEqual({
      resolved: {
        PUBLIC_KEY: {
          type: "u32",
          value: "7",
        },
      },
      runtime_arguments: {
        ISSUED_ASSET: {
          new_issuance_asset: {
            input_index: 0,
          },
        },
      },
    });

    let witnessBuilder = await createSimplicityWitnessValuesBuilder();
    witnessBuilder = witnessBuilder.addValue(
      "STATIC_SIG",
      wasm.SimplicityTypedValue.fromByteArrayHex(
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    );

    const witnessBytes = await serializeSimfWitness(witnessBuilder, [
      {
        sig_hash_all: {
          name: "SIG_ALL",
          public_key:
            "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        },
      },
    ]);

    expect(JSON.parse(new TextDecoder().decode(witnessBytes))).toEqual({
      resolved: {
        STATIC_SIG: {
          type: "[u8; 32]",
          value:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      },
      runtime_arguments: [
        {
          sig_hash_all: {
            name: "SIG_ALL",
            public_key:
              "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
          },
        },
      ],
    });
  });

  test("wraps taproot handle and issuance helper flows", async () => {
    const wasm = await loadWalletAbiLwkWasm();

    let argumentsBuilder = await createSimplicityArgumentsBuilder();
    argumentsBuilder = argumentsBuilder.addValue(
      "PUBLIC_KEY",
      wasm.SimplicityTypedValue.fromU256Hex(
        "8a65c55726dc32b59b649ad0187eb44490de681bb02601b8d3f58c8b9fff9083",
      ),
    );

    const handle = await createExternalTaprootHandle({
      source_simf: p2pkSource,
      resolved_arguments: argumentsBuilder,
      x_only_public_key:
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      network: "localtest-liquid",
    });

    expect(handle.handle.startsWith("ext-")).toBe(true);

    const verified = await verifyTaprootHandle({
      handle: handle.handle,
      source_simf: p2pkSource,
      resolved_arguments: argumentsBuilder,
      network: "localtest-liquid",
    });

    expect(verified.handle).toBe(handle.handle);

    const address = await createSimplicityP2trAddress({
      source_simf: p2pkSource,
      resolved_arguments: argumentsBuilder,
      internal_key:
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      network: "localtest-liquid",
    });

    expect(address.length).toBeGreaterThan(20);

    const outpoint = `${"00".repeat(32)}:0`;
    const contractHash = "00".repeat(32);

    expect(
      await generateIssuanceAssetEntropy({
        outpoint,
        contract_hash: contractHash,
      }),
    ).toHaveLength(64);
    expect(
      await deriveAssetIdFromIssuance({
        outpoint,
        contract_hash: contractHash,
      }),
    ).toHaveLength(64);
    expect(
      await deriveReissuanceTokenFromIssuance({
        outpoint,
        contract_hash: contractHash,
      }),
    ).toHaveLength(64);
  });
});
