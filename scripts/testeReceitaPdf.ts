/**
 * Teste manual do PDF de receita (rodar com: npx vite-node scripts/testeReceitaPdf.ts).
 * Gera /tmp/receita-teste.pdf (caso normal, com acentos) e
 * /tmp/receita-teste-longa.pdf (paginação com muitos medicamentos).
 * Sem DOM, o logo é omitido graciosamente (no navegador ele aparece).
 */
import { writeFileSync } from "node:fs";
import { construirReceitaDoc } from "../src/lib/exportPrescricao";
import type { GrupoPrescricao } from "../src/hooks/useMedico";
import type { Residente } from "../src/types/database";

const hospede = {
  id: "t1",
  nome: "Alzira Bittencourt",
  data_nascimento: "1938-03-12",
  quarto: "1-2-04",
} as Residente;

const medico = { id: "m1", nome: "Helena Marques", crm: "CRM-PR 45120" };

function grupo(
  med: string,
  dose: string,
  via: GrupoPrescricao["via"],
  linhas: { periodo: string; quantidade: string; horario?: string }[],
): GrupoPrescricao {
  return {
    grupoPrescricao: med,
    medicamento: med,
    dose,
    via,
    posologia: null,
    prescritoPor: "m1",
    linhas: linhas.map((l, i) => ({
      id: `${med}-${i}`,
      residente_id: "t1",
      medicamento: med,
      dose,
      via,
      periodo: l.periodo,
      horario: l.horario ?? null,
      ativa: true,
      quantidade: l.quantidade,
      posologia: null,
      grupo_prescricao: med,
      alerta_alergia: null,
      prescrito_por: "m1",
    })) as GrupoPrescricao["linhas"],
  };
}

const grupos: GrupoPrescricao[] = [
  grupo("Losartana", "50mg", "oral", [{ periodo: "manha", quantidade: "1 comprimido" }]),
  grupo("Insulina NPH", "10 UI", "insulina", [{ periodo: "almoco", quantidade: "10UI" }]),
  grupo("Metformina", "850mg", "oral", [
    { periodo: "manha", quantidade: "1 comprimido" },
    { periodo: "noite", quantidade: "1 comprimido" },
  ]),
  grupo("Enoxaparina", "40mg", "injetavel", [{ periodo: "noite", quantidade: "1 ampola" }]),
  grupo("Suplemento proteico (ação prolongada)", "200ml", "sonda", [
    { periodo: "apos_almoco", quantidade: "200ml" },
  ]),
];

const doc1 = await construirReceitaDoc(hospede, grupos, medico);
writeFileSync("/tmp/receita-teste.pdf", Buffer.from(doc1.output("arraybuffer")));
console.log("OK /tmp/receita-teste.pdf — páginas:", doc1.getNumberOfPages());

// Receita longa: 18 medicamentos → deve paginar com cabeçalho compacto.
const muitos: GrupoPrescricao[] = Array.from({ length: 18 }, (_, i) =>
  grupo(`Medicação çãõéê nº ${i + 1}`, "25mg", "oral", [
    { periodo: "manha", quantidade: "1 comprimido" },
    { periodo: "noite", quantidade: "1 comprimido" },
  ]),
);
const doc2 = await construirReceitaDoc(hospede, muitos, {
  id: "m2",
  nome: "Eduardo Nogueira",
  crm: null, // deve imprimir "CRM não informado"
});
writeFileSync("/tmp/receita-teste-longa.pdf", Buffer.from(doc2.output("arraybuffer")));
console.log("OK /tmp/receita-teste-longa.pdf — páginas:", doc2.getNumberOfPages());
