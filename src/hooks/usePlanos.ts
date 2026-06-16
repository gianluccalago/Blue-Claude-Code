import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PlanoCuidadoItem, Residente } from "@/types/database";
import type { ItemTarefaValor } from "@/components/coordenacao/ItemTarefaForm";

/**
 * Residentes ATIVOS que OCUPAM LEITO (longa + curta permanência). Hook central
 * das telas operacionais e de ocupação. Inativos somem (status); e o DAY CARE é
 * EXCLUÍDO aqui (não ocupa leito; vive em useFrequentadoresDayCare) — assim ele
 * não polui checklist do cuidador, médico, farmácia, mapa de suítes, etc.
 */
export function useResidentes() {
  return useQuery({
    queryKey: ["residentes"],
    queryFn: async (): Promise<Residente[]> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("status_hospede", "ativo")
        .neq("modalidade", "day_care");
      if (error) throw error;
      const residentes = data ?? [];
      residentes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return residentes;
    },
  });
}

/** Mapa residente_id → modalidade (TODOS — para segmentar vendas do funil). */
export function useModalidadePorResidente() {
  return useQuery({
    queryKey: ["modalidade-por-residente"],
    queryFn: async (): Promise<Map<string, Residente["modalidade"]>> => {
      const { data, error } = await supabase.from("residentes").select("id, modalidade");
      if (error) throw error;
      const m = new Map<string, Residente["modalidade"]>();
      for (const r of data ?? []) m.set(r.id as string, r.modalidade as Residente["modalidade"]);
      return m;
    },
  });
}

/** Frequentadores ATIVOS do Day Care (não ocupam leito; período da tarde). */
export function useFrequentadoresDayCare() {
  return useQuery({
    queryKey: ["frequentadores-day-care"],
    queryFn: async (): Promise<Residente[]> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("status_hospede", "ativo")
        .eq("modalidade", "day_care");
      if (error) throw error;
      const lista = data ?? [];
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });
}

/** Itens ativos do plano de cuidado de um residente, ordenados por horário. */
export function usePlanoItens(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["plano-itens", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<PlanoCuidadoItem[]> => {
      const { data, error } = await supabase
        .from("plano_cuidado_item")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .order("horario", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  qc.invalidateQueries({ queryKey: ["plano-itens", residenteId] });
}

/**
 * Adiciona a MESMA tarefa ao plano de VÁRIOS hóspedes de uma vez (lote —
 * menos cliques para rotinas comuns, ex.: "hidratação 10:00" para 12 pessoas).
 */
export function useAdicionarPlanoItemEmLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteIds: string[]; valor: ItemTarefaValor }) => {
      const rows = args.residenteIds.map((residenteId) => ({
        residente_id: residenteId,
        tarefa: args.valor.tarefa,
        horario: args.valor.horario,
        responsavel: args.valor.responsavel,
        tolerancia_minutos: args.valor.tolerancia_minutos,
        ativa: true,
      }));
      const { error } = await supabase.from("plano_cuidado_item").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_r, args) => {
      for (const id of args.residenteIds) invalidar(qc, id);
    },
  });
}

/** Adiciona uma tarefa ao plano de cuidado (ativa=true). */
export function useAdicionarPlanoItem(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: ItemTarefaValor) => {
      const { error } = await supabase.from("plano_cuidado_item").insert({
        residente_id: residenteId,
        tarefa: valor.tarefa,
        horario: valor.horario,
        responsavel: valor.responsavel,
        tolerancia_minutos: valor.tolerancia_minutos,
        ativa: true,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc, residenteId),
  });
}

/** Edita apenas horário e tolerância de um item do plano. */
export function useEditarPlanoItem(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; horario: string; tolerancia_minutos: number }) => {
      const { error } = await supabase
        .from("plano_cuidado_item")
        .update({ horario: args.horario, tolerancia_minutos: args.tolerancia_minutos })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc, residenteId),
  });
}

/** Remoção LÓGICA do item do plano (ativa=false; nunca apaga fisicamente). */
export function useRemoverPlanoItem(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plano_cuidado_item")
        .update({ ativa: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc, residenteId),
  });
}

/**
 * Aplica um modelo de rotina ao plano do hóspede: COPIA todos os itens do
 * modelo como novos registros (ativa=true). Apenas ADICIONA — nunca apaga as
 * tarefas existentes.
 */
export function useAplicarModelo(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modeloId: string) => {
      const { data: itens, error: errItens } = await supabase
        .from("modelo_rotina_item")
        .select("*")
        .eq("modelo_id", modeloId);
      if (errItens) throw errItens;
      if (!itens || itens.length === 0) return;

      const novos = itens.map((it) => ({
        residente_id: residenteId,
        tarefa: it.tarefa,
        horario: it.horario,
        responsavel: it.responsavel,
        tolerancia_minutos: it.tolerancia_minutos,
        ativa: true,
      }));
      const { error } = await supabase.from("plano_cuidado_item").insert(novos);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc, residenteId),
  });
}
