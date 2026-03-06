import { readFileSync } from "node:fs";

const tagName = process.argv[2];

if (!tagName) {
  throw new Error("Expected a git tag name as the first argument.");
}

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const expectedTag = `v${packageJson.version}`;

if (tagName !== expectedTag) {
  throw new Error(
    `Tag ${tagName} does not match package.json version ${packageJson.version}. Expected ${expectedTag}.`,
  );
}

console.log(
  `Tag ${tagName} matches package.json version ${packageJson.version}.`,
);
