import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GrauDependencia, ModalidadeEstadia, Ocupacao, TipoSuite } from "@/types/database";

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
  // Modalidade de estadia (longa/curta permanência, day care).
  modalidade: ModalidadeEstadia;
  data_fim_prevista: string | null; // término previsto (temporários)
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
  celular_proprio: string | null;
  foto_url: string | null;
  // Responsável financeiro (quem paga). asaas_customer_id NÃO entra aqui:
  // é reservado p/ a futura integração e nunca editado manualmente.
  resp_fin_nome: string | null;
  resp_fin_cpf: string | null;
  resp_fin_email: string | null;
  resp_fin_telefone: string | null;
  resp_fin_relacao: string | null;
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
    modalidade: v.modalidade,
    // Início da estadia = admissão (regra simples; pode evoluir).
    data_inicio_estadia: v.data_admissao,
    // Término previsto só faz sentido em temporários; longa → null.
    data_fim_prevista: v.modalidade === "longa_permanencia" ? null : v.data_fim_prevista,
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
    celular_proprio: t(v.celular_proprio),
    foto_url: t(v.foto_url),
    resp_fin_nome: t(v.resp_fin_nome),
    resp_fin_cpf: t(v.resp_fin_cpf),
    resp_fin_email: t(v.resp_fin_email),
    resp_fin_telefone: t(v.resp_fin_telefone),
    resp_fin_relacao: t(v.resp_fin_relacao),
  };
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["residentes"] });
  // Mudança de modalidade afeta a lista de Day Care e a ocupação.
  qc.invalidateQueries({ queryKey: ["frequentadores-day-care"] });
}

export function useCriarResidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ResidenteValor): Promise<string> => {
      const { data, error } = await supabase
        .from("residentes")
        .insert(paraRegistro(v))
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
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

/** Atualiza somente a foto do hóspede (upload/remoção pelo cabeçalho da ficha). */
export function useDefinirFotoResidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; fotoUrl: string | null }) => {
      const { error } = await supabase
        .from("residentes")
        .update({ foto_url: args.fotoUrl })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
