import parser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

// ===========================================================================
// Lint mínimo e cirúrgico: APENAS as regras de hooks do React. A regra
// rules-of-hooks pega em build o que vira crash em produção (React #310 —
// hook chamado depois de um return condicional / fora de ordem).
// Roda no `npm run lint` (junto do typecheck) e no `npm run build`.
// ===========================================================================

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    // Comentários eslint-disable legados (de regras que não carregamos aqui)
    // não devem virar ruído.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      // exhaustive-deps fica off: é heurística de frescor (não de crash) e
      // geraria ruído retroativo no app inteiro.
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
