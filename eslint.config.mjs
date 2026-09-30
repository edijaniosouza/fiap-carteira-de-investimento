import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import checkFile from "eslint-plugin-check-file";

// Project naming convention (see README "Convenções de nomenclatura"):
// - variables, functions, parameters, properties, files and folders: snake_case
// - constants: UPPER_SNAKE_CASE
// - React components, types, interfaces, enums: PascalCase
// - React hooks: useXxx (required by the Rules of Hooks)
const SNAKE_CASE_FOLDER = "+([a-z0-9_])";
const NEXT_ROUTE_FOLDER = "@(+([a-z0-9_])|\\(+([a-z0-9_])\\)|\\[+([a-z0-9_])\\])";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}", "prisma/**/*.ts"],
    ignores: ["src/components/ui/**", "src/generated/**", "src/lib/utils.ts"],
    plugins: { "check-file": checkFile },
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["snake_case"], leadingUnderscore: "allow" },
        { selector: "import", format: null },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
        // Components are PascalCase functions; everything else snake_case.
        { selector: "function", format: ["snake_case", "PascalCase"] },
        {
          selector: "function",
          filter: { regex: "^(GET|POST|PUT|PATCH|DELETE)$", match: true },
          format: ["UPPER_CASE"],
        },
        { selector: "variable", format: ["snake_case", "UPPER_CASE"], leadingUnderscore: "allow" },
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["snake_case", "UPPER_CASE", "PascalCase"],
        },
        // Hooks (custom and RTK Query generated) keep the useXxx form.
        {
          selector: ["variable", "function"],
          filter: { regex: "^use[A-Z]", match: true },
          format: ["camelCase"],
        },
        { selector: "parameter", format: ["snake_case"], leadingUnderscore: "allow" },
        // Props/keys we own are snake_case. Object literals passed to libraries
        // (createSlice, createApi, fetch, Prisma, cookies...) require camelCase keys.
        { selector: "typeProperty", format: ["snake_case", "UPPER_CASE"], leadingUnderscore: "allow" },
        {
          selector: ["objectLiteralProperty", "objectLiteralMethod"],
          format: ["snake_case", "camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: [
            "typeProperty",
            "objectLiteralProperty",
            "objectLiteralMethod",
          ],
          modifiers: ["requiresQuotes"],
          format: null,
        },
        { selector: "classProperty", format: ["snake_case"] },
      ],
      "check-file/filename-naming-convention": [
        "error",
        { "src/**/*.{ts,tsx}": "SNAKE_CASE", "prisma/**/*.ts": "SNAKE_CASE" },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "src/app/**/": NEXT_ROUTE_FOLDER,
          "src/!(app)/**/": SNAKE_CASE_FOLDER,
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
