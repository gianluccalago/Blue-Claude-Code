import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GrauDependencia, Ocupacao, TipoSuite } from "@/types/database";

// ===========================================================================
// MASTER · Gestão de residentes — criar/editar a ficha completa do hóspede.
// A LISTAGEM usa useResidentes() (usePlanos); aqui ficam as MUTAÇÕES. Não há
// exclusão: residentes não têm campo de status e são referenciados por várias
// tabelas (plano, registros, eliminações, compromissos…).
// ===========================================================================

/** Todos os campos editáveis da ficha do residente. */
export interface ResidenteValor {
  nome: string;
  data_nascimento: string | null;
  grau_dependencia: GrauDependencia | null; // grau ATUAL (IVCF)
  grau_contratual: GrauDependencia | null; // grau do contrato
  modulo: number | null;
  andar: number | null;
  quarto: string | null;
  tipo_suite: TipoSuite | null;
  ocupacao: Ocupacao | null;
  data_admissao: string | null;
  responsavel_legal: string | null;
  contato: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  plano_saude_operadora: string | null;
  plano_saude_numero: string | null;
  hospital_referencia: string | null;
  alergias: string | null;
  proteses: string | null;
  mensalidade_valor: number | null;
  historia_vida: string | null;
}

function paraRegistro(v: ResidenteValor) {
  // Texto vazio → null para manter a ficha limpa (exibida como "Não informado").
  const t = (s: string | null) => (s && s.trim() !== "" ? s.trim() : null);
  return {
    nome: v.nome.trim(),
    data_nascimento: v.data_nascimento,
    grau_dependencia: v.grau_dependencia,
    grau_contratual: v.grau_contratual,
    modulo: v.modulo,
    andar: v.andar,
    quarto: t(v.quarto),
    tipo_suite: v.tipo_suite,
    ocupacao: v.ocupacao,
    data_admissao: v.data_admissao,
    responsavel_legal: t(v.responsavel_legal),
    contato: t(v.contato),
    contato_emergencia_nome: t(v.contato_emergencia_nome),
    contato_emergencia_telefone: t(v.contato_emergencia_telefone),
    plano_saude_operadora: t(v.plano_saude_operadora),
    plano_saude_numero: t(v.plano_saude_numero),
    hospital_referencia: t(v.hospital_referencia),
    alergias: t(v.alergias),
    proteses: t(v.proteses),
    mensalidade_valor: v.mensalidade_valor,
    historia_vida: t(v.historia_vida),
  };
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["residentes"] });
}

export function useCriarResidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ResidenteValor) => {
      const { error } = await supabase.from("residentes").insert(paraRegistro(v));
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEditarResidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: ResidenteValor }) => {
      const { error } = await supabase
        .from("residentes")
        .update(paraRegistro(args.valor))
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
