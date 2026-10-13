import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src_dir = fileURLToPath(new URL("./src", import.meta.url));
const server_only_stub = fileURLToPath(new URL("./tests/support/server_only_stub.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src_dir,
      // "server-only" throws outside the React Server bundle; tests import server modules directly.
      "server-only": server_only_stub,
    },
  },
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    // UI tests opt into jsdom with a `@vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./tests/support/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/generated/**",
        // shadcn/ui primitives (third-party generated code).
        "src/components/ui/**",
        "src/types/**",
      ],
      reporter: ["text", "html", "lcov"],
    },
  },
});
