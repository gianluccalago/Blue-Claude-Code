import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { intervaloDoMes } from "@/lib/mensalidade";
import type { Desperdicio, RefeicaoDesperdicio } from "@/types/database";

// ===========================================================================
// Desperdício (N4). O custo_estimado é calculado na tela (lib/desperdicio) e
// GRAVADO como snapshot — não recalculamos depois (o cardápio pode mudar).
// ===========================================================================

const KEY = ["desperdicio"];

/** Registros de desperdício de um mês ("YYYY-MM"). */
export function useDesperdicioDoMes(mes: string) {
  const { inicio, fim } = intervaloDoMes(mes);
  return useQuery({
    queryKey: [...KEY, mes],
    queryFn: async (): Promise<Desperdicio[]> => {
      const { data, error } = await supabase
        .from("desperdicio")
        .select("*")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type DesperdicioInput = {
  data: string;
  refeicao: RefeicaoDesperdicio;
  pesoKg: number;
  custoEstimado: number;
  metodoEstimativa: string;
  observacao: string | null;
};

/** Registra um descarte (custo já estimado na tela). */
export function useRegistrarDesperdicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: DesperdicioInput) => {
      const { error } = await supabase.from("desperdicio").insert({
        data: args.data,
        refeicao: args.refeicao,
        peso_kg: args.pesoKg,
        custo_estimado: args.custoEstimado,
        metodo_estimativa: args.metodoEstimativa,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Edita um registro (recalcula o custo na tela e regrava o snapshot). */
export function useEditarDesperdicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string } & DesperdicioInput) => {
      const { error } = await supabase
        .from("desperdicio")
        .update({
          data: args.data,
          refeicao: args.refeicao,
          peso_kg: args.pesoKg,
          custo_estimado: args.custoEstimado,
          metodo_estimativa: args.metodoEstimativa,
          observacao: args.observacao?.trim() || null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Remove um registro de desperdício. */
export function useRemoverDesperdicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("desperdicio").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
