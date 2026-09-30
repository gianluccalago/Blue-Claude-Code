// Gera docs/deploy/verify-round-arquivo-unico.ts a partir da pasta da função
// (validacaoTag.ts + index.ts), para colar no editor do Supabase.
// Uso: node scripts/gerar-verify-round-arquivo-unico.mjs
import { readFileSync, writeFileSync } from "node:fs";
const pasta = "supabase/functions/verify-round";
const index = readFileSync(`${pasta}/index.ts`, "utf8");
const validacao = readFileSync(`${pasta}/validacaoTag.ts`, "utf8").replace(/^export /gm, "");
const i = index.indexOf('import { validateTagRead } from "./validacaoTag.ts";');
const cabecalho = index.slice(0, i);
const resto = index.slice(i).replace('import { validateTagRead } from "./validacaoTag.ts";\n', "");
const aviso = [
  "// ===========================================================================",
  "// verify-round — VERSÃO EM ARQUIVO ÚNICO para colar no editor do Supabase.",
  "// Gerada por scripts/gerar-verify-round-arquivo-unico.mjs a partir de",
  "// supabase/functions/verify-round (fonte oficial). Não edite aqui.",
  "// ===========================================================================",
].join("\n");
writeFileSync("docs/deploy/verify-round-arquivo-unico.ts", `${aviso}\n${cabecalho}\n${validacao}\n${resto}`);
console.log("ok");
