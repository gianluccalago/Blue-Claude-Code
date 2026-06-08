import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ModeloRotina, ModeloRotinaItem } from "@/types/database";
import type { ItemTarefaValor } from "@/components/coordenacao/ItemTarefaForm";

export interface ModeloComContagem extends ModeloRotina {
  total_itens: number;
}

/** Modelos ativos com a contagem de itens de cada um. */
export function useModelos() {
  return useQuery({
    queryKey: ["modelos"],
    queryFn: async (): Promise<ModeloComContagem[]> => {
      const { data: modelos, error } = await supabase
        .from("modelo_rotina")
        .select("*")
        .eq("ativo", true);
      if (error) throw error;
      const lista = modelos ?? [];
      if (lista.length === 0) return [];

      const { data: itens, error: errItens } = await supabase
        .from("modelo_rotina_item")
        .select("modelo_id")
        .in(
          "modelo_id",
          lista.map((m) => m.id),
        );
      if (errItens) throw errItens;

      const contagem = new Map<string, number>();
      for (const it of itens ?? []) {
        contagem.set(it.modelo_id, (contagem.get(it.modelo_id) ?? 0) + 1);
      }
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista.map((m) => ({ ...m, total_itens: contagem.get(m.id) ?? 0 }));
    },
  });
}

/** Itens de um modelo, ordenados por horário. */
export function useModeloItens(modeloId: string | undefined) {
  return useQuery({
    queryKey: ["modelo-itens", modeloId],
    enabled: !!modeloId,
    queryFn: async (): Promise<ModeloRotinaItem[]> => {
      const { data, error } = await supabase
        .from("modelo_rotina_item")
        .select("*")
        .eq("modelo_id", modeloId!)
        .order("horario", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Cria um modelo novo (vazio). */
export function useCriarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from("modelo_rotina").insert({ nome });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelos"] }),
  });
}

/** Remoção LÓGICA de um modelo (ativo=false). */
export function useRemoverModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modelo_rotina").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modelos"] }),
  });
}

function invalidarItens(qc: ReturnType<typeof useQueryClient>, modeloId: string) {
  qc.invalidateQueries({ queryKey: ["modelo-itens", modeloId] });
  qc.invalidateQueries({ queryKey: ["modelos"] });
}

export function useAdicionarModeloItem(modeloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: ItemTarefaValor) => {
      const { error } = await supabase.from("modelo_rotina_item").insert({
        modelo_id: modeloId,
        tarefa: valor.tarefa,
        horario: valor.horario,
        responsavel: valor.responsavel,
        tolerancia_minutos: valor.tolerancia_minutos,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarItens(qc, modeloId),
  });
}

export function useEditarModeloItem(modeloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; horario: string; tolerancia_minutos: number }) => {
      const { error } = await supabase
        .from("modelo_rotina_item")
        .update({ horario: args.horario, tolerancia_minutos: args.tolerancia_minutos })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarItens(qc, modeloId),
  });
}

/** Itens de modelo podem ser apagados fisicamente (não há histórico clínico). */
export function useRemoverModeloItem(modeloId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modelo_rotina_item").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarItens(qc, modeloId),
  });
}
