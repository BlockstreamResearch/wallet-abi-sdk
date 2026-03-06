import { describe, expect, test } from "bun:test";

import { packageName } from "../src/index.js";

describe("packageName", () => {
  test("matches the published package name", () => {
    expect(packageName).toBe("wallet-abi-sdk-alpha");
  });
});
