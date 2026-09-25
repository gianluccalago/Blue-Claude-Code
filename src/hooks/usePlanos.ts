import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PlanoCuidadoItem, Residente } from "@/types/database";
import type { ItemTarefaValor } from "@/components/coordenacao/ItemTarefaForm";
import type { ResultadoAplicacaoModelo } from "@/lib/planoCuidado";

/**
 * Residentes ATIVOS que OCUPAM LEITO (longa + curta permanência). Hook de
 * OCUPAÇÃO: mapa de suítes, mensalidades, financeiro, hotelaria. Inativos somem
 * (status); e o DAY CARE é EXCLUÍDO aqui (não ocupa leito; vive em
 * useFrequentadoresDayCare). Para fluxos ASSISTENCIAIS (prescrição, plano de
 * cuidado, dieta, atividades, atendimentos, ficha, painel da coordenação) use
 * useHospedesAtendidos(), que inclui o Day Care (CLI-07).
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

/**
 * Hóspedes ATENDIDOS pela casa: todos os ATIVOS, INCLUINDO o Day Care (que
 * recebe prescrição, plano de cuidado, dieta, atividades e atendimentos como
 * qualquer outro). Inativos ficam fora. É a lista das telas assistenciais —
 * CLI-07: o Day Care não aparecia nelas porque usavam useResidentes() (leitos).
 *
 * A chave começa com "residentes" de propósito: as invalidações existentes
 * (`invalidateQueries({ queryKey: ["residentes"] })` em admissão, saída, peso,
 * mensalidade…) casam por prefixo e atualizam esta lista também.
 */
export function useHospedesAtendidos() {
  return useQuery({
    queryKey: ["residentes", "atendidos"],
    queryFn: async (): Promise<Residente[]> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("status_hospede", "ativo");
      if (error) throw error;
      const lista = data ?? [];
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
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

/**
 * Edita apenas horário e tolerância de um item do plano — in-place, de
 * propósito: tarefa_registro guarda o ID do item em `tarefa` e o horário DA
 * ÉPOCA em `horario`, então os registros passados não mudam. Texto, responsável
 * e hóspede do item são imutáveis no banco (trigger 0137): para trocá-los,
 * remova o item e crie outro.
 */
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
 * Aplica um modelo de rotina ao plano do hóspede pela RPC aplicar_modelo_rotina
 * (0137): numa transação, entram SÓ as tarefas do modelo que ainda não existem
 * ativas no plano (tarefa + horário + responsável). Reaplicar não duplica
 * (CLI-06). Nunca apaga as tarefas existentes. A chave de idempotência é gerada
 * por chamada: uma retentativa (rede/duplo clique) devolve o mesmo resultado.
 * Devolve quantas tarefas entraram e quantas já existiam.
 */
export function useAplicarModelo(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modeloId: string): Promise<ResultadoAplicacaoModelo> => {
      const { data, error } = await supabase.rpc("aplicar_modelo_rotina", {
        p_modelo: modeloId,
        p_residentes: [residenteId],
        p_idempotencia: crypto.randomUUID(),
      });
      if (error) throw error;
      const linha = data?.[0];
      return { inseridas: linha?.inseridas ?? 0, existentes: linha?.existentes ?? 0 };
    },
    onSuccess: () => invalidar(qc, residenteId),
  });
}
