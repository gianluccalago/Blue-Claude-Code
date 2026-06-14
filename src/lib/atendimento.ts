import type {
  CategoriaUpselling,
  StatusCobrancaAtendimento,
  TipoAtendimentoIndividual,
} from "@/types/database";

// ===========================================================================
// Atendimento individual da Equipe Multidisciplinar — rótulos, sugestão de
// tipo pelo cargo do profissional e mapeamento para a categoria de upselling
// usada pela Administração ao cobrar.
// ===========================================================================

export const TIPOS_ATENDIMENTO: { value: TipoAtendimentoIndividual; label: string }[] = [
  { value: "fisioterapia", label: "Fisioterapia" },
  { value: "terapia_ocupacional", label: "Terapia Ocupacional" },
  { value: "educacao_fisica", label: "Educação Física" },
];

export const TIPO_ATENDIMENTO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_ATENDIMENTO.map((t) => [t.value, t.label]),
);

/** Sugere o tipo a partir do cargo/função do profissional logado (Multi). */
export function tipoSugeridoPorFuncao(funcao: string | null | undefined): TipoAtendimentoIndividual {
  const f = (funcao ?? "").toLowerCase();
  if (f.includes("ocupacional") || /\bto\b/.test(f)) return "terapia_ocupacional";
  if (f.includes("educa") || f.includes("físic") || f.includes("fisic") || /\bef\b/.test(f))
    return "educacao_fisica";
  return "fisioterapia";
}

/** Categoria de upselling para a cobrança, conforme o tipo de atendimento. */
export function categoriaUpsellingDoTipo(tipo: TipoAtendimentoIndividual): CategoriaUpselling {
  return tipo === "fisioterapia" ? "Fisioterapia avulsa" : "Terapia avulsa";
}

export const STATUS_COBRANCA_ATENDIMENTO_LABEL: Record<StatusCobrancaAtendimento, string> = {
  pendente_avaliacao: "Pendente de avaliação",
  cobrado: "Cobrado",
  nao_cobrar: "Não cobrar (incluso)",
};

export const STATUS_COBRANCA_ATENDIMENTO_VARIANTE: Record<
  StatusCobrancaAtendimento,
  "warning" | "success" | "muted"
> = {
  pendente_avaliacao: "warning",
  cobrado: "success",
  nao_cobrar: "muted",
};
