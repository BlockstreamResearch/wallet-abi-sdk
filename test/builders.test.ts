import { describe, expect, test } from "bun:test";

import { generateRequestId } from "../src/builders.js";

const MOCK_UUID = "11111111-2222-4333-8444-555555555555";

describe("builder utilities", () => {
  test("generateRequestId delegates to crypto.randomUUID", () => {
    const cryptoPrototype = Object.getPrototypeOf(globalThis.crypto) as {
      randomUUID: () => string;
    };
    const originalRandomUuid = cryptoPrototype.randomUUID;

    cryptoPrototype.randomUUID = () => MOCK_UUID;

    try {
      expect(generateRequestId()).toBe(MOCK_UUID);
    } finally {
      cryptoPrototype.randomUUID = originalRandomUuid;
    }
  });
});
