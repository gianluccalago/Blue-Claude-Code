import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes das funções PURAS (cálculos do módulo Obra e afins). Ambiente node,
// sem DOM — apenas lógica. Reusa o alias "@" do vite.config.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
