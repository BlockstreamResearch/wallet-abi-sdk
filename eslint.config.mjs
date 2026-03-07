import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const unusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
  },
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "fixtures/**",
      "node_modules/**",
      "src/vendor/**",
      "*.tgz",
      "scripts/**/*.mjs",
    ],
  },
  {
    files: ["src/**/*.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVarsRule,
    },
  },
  {
    files: ["test/**/*.ts"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      prettier,
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVarsRule,
    },
  },
);
