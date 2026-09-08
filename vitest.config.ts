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
    // Alguns módulos testados (ex.: lib/storage) importam o cliente Supabase,
    // que exige as variáveis para inicializar. Valores fictícios: os testes
    // são de funções puras e nunca chegam a fazer chamada de rede.
    env: {
      VITE_SUPABASE_URL: "http://localhost:9999",
      VITE_SUPABASE_ANON_KEY: "chave-de-teste",
    },
  },
});
