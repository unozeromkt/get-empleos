import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // Los tests no deben tocar red ni base de datos: el motor de matching y la
    // capa de documentos son puros por diseño (ver docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §5)
    globals: false,
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
