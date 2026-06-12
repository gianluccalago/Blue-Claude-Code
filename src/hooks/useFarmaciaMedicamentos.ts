import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ===========================================================================
// Hooks do módulo de medicamentos da Farmácia:
//  - quais residentes têm prescrição ativa (indicador da emissão em lote);
//  - médico(s) PRESCRITOR(ES) de cada residente — transparência da autoria:
//    a receita sai SEMPRE assinada pelo médico que prescreveu; a Farmácia
//    apenas extrai o documento;
//  - lançamento do custo da "caixinha" mensal, que grava na MESMA tabela
//    `upselling` que a Administração lê (categoria "Medicamentos",
//    lancado_por "Farmácia") — sem tabela nova nem duplicação.
// ===========================================================================

/** Descrição padrão do lançamento de custo da caixinha mensal. */
export const DESCRICAO_CAIXINHA = "Caixinha mensal de medicamentos";

/** Conjunto de residente_id que possuem ao menos uma prescrição ativa. */
export function useResidentesComPrescricao() {
  return useQuery({
    queryKey: ["farmacia-residentes-com-prescricao"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("residente_id")
        .eq("ativa", true);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.residente_id));
    },
  });
}

export type PrescritoresDoResidente = {
  /** Nomes dos médicos prescritores das prescrições ativas do residente. */
  nomes: string[];
  /** true se algum grupo de prescrição está sem médico (bloqueia a receita). */
  semMedico: boolean;
};

/**
 * Médico(s) PRESCRITOR(ES) por residente (prescrições ativas) — exibido na
 * emissão em lote para deixar claro QUEM assina cada receita gerada.
 */
export function usePrescritoresPorResidente() {
  return useQuery({
    queryKey: ["farmacia-prescritores-por-residente"],
    queryFn: async (): Promise<Map<string, PrescritoresDoResidente>> => {
      const [presc, usuarios] = await Promise.all([
        supabase.from("prescricao").select("residente_id, prescrito_por").eq("ativa", true),
        supabase.from("usuarios").select("id, nome"),
      ]);
      if (presc.error) throw presc.error;
      if (usuarios.error) throw usuarios.error;

      const nomePorId = new Map((usuarios.data ?? []).map((u) => [u.id, u.nome]));
      const mapa = new Map<string, PrescritoresDoResidente>();
      for (const p of presc.data ?? []) {
        const reg = mapa.get(p.residente_id) ?? { nomes: [], semMedico: false };
        if (!p.prescrito_por) {
          reg.semMedico = true;
        } else {
          const nome = nomePorId.get(p.prescrito_por) ?? "Médico não encontrado";
          if (!reg.nomes.includes(nome)) reg.nomes.push(nome);
        }
        mapa.set(p.residente_id, reg);
      }
      return mapa;
    },
  });
}

function invalidarUpselling(qc: ReturnType<typeof useQueryClient>, residenteId: string, mes: string) {
  qc.invalidateQueries({ queryKey: ["upselling", residenteId, mes] });
  qc.invalidateQueries({ queryKey: ["upselling-todos", mes] });
}

export type LancarCustoMedicamentoInput = {
  residenteId: string;
  valor: number;
  data: string;
  /** Observação opcional; vira a descrição do lançamento (default = caixinha). */
  observacao: string | null;
};

/** Lança o custo da caixinha mensal de um hóspede na tabela upselling. */
export function useLancarCustoMedicamento(mes: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: LancarCustoMedicamentoInput) => {
      const { error } = await supabase.from("upselling").insert({
        residente_id: args.residenteId,
        categoria: "Medicamentos",
        descricao: args.observacao?.trim() || DESCRICAO_CAIXINHA,
        valor: args.valor,
        data: args.data,
        mes_referencia: mes,
        lancado_por: "Farmácia",
      });
      if (error) throw error;
    },
    onSuccess: (_r, args) => invalidarUpselling(qc, args.residenteId, mes),
  });
}

export type EditarCustoMedicamentoInput = {
  id: string;
  residenteId: string;
  valor: number;
  data: string;
  observacao: string | null;
};

/** Edita um custo de medicamento já lançado no mês. */
export function useEditarCustoMedicamento(mes: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: EditarCustoMedicamentoInput) => {
      const { error } = await supabase
        .from("upselling")
        .update({
          valor: args.valor,
          data: args.data,
          descricao: args.observacao?.trim() || DESCRICAO_CAIXINHA,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => invalidarUpselling(qc, args.residenteId, mes),
  });
}

/** Remove um custo de medicamento do mês. */
export function useRemoverCustoMedicamento(mes: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string }) => {
      const { error } = await supabase.from("upselling").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => invalidarUpselling(qc, args.residenteId, mes),
  });
}
