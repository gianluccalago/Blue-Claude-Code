import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Dispensacao, ItemDispensacaoJson } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hojeISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mesRefDeData(data: string): string {
  return data.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Dispensações de um hóspede em uma data. */
export function useDispensacoesDoHospede(residenteId: string | null, data: string) {
  return useQuery({
    queryKey: ["dispensacoes", residenteId, data],
    enabled: !!residenteId,
    queryFn: async (): Promise<Dispensacao[]> => {
      const { data: rows, error } = await supabase
        .from("dispensacao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("data", data)
        .order("dispensado_em", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Dispensacao[];
    },
  });
}

/** Todas as dispensações de uma data (para o mapa de preparo). */
export function useDispensacoesDodia(data: string) {
  return useQuery({
    queryKey: ["dispensacoes-dia", data],
    queryFn: async (): Promise<Dispensacao[]> => {
      const { data: rows, error } = await supabase
        .from("dispensacao")
        .select("*")
        .eq("data", data)
        .order("dispensado_em", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Dispensacao[];
    },
  });
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

/** Confirma a dispensação: grava registro + decrementa estoque_hospede. */
export function useConfirmarDispensacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      periodo: string;
      data: string;
      itens: ItemDispensacaoJson[];
      dispensadoPor?: string;
    }) => {
      const mesRef = mesRefDeData(args.data);

      // Gravar o registro de dispensação
      const { data: rec, error: errD } = await supabase
        .from("dispensacao")
        .insert({
          residente_id: args.residenteId,
          periodo: args.periodo,
          data: args.data,
          itens: args.itens as unknown as never,
          dispensado_por: args.dispensadoPor ?? "Farmácia",
        })
        .select("id")
        .single();
      if (errD) throw errD;
      if (!rec) throw new Error("Dispensação não retornou ID.");

      // Decrementar estoque_hospede de cada item (best-effort; saldo pode ficar negativo)
      for (const item of args.itens) {
        const { data: estoq } = await supabase
          .from("estoque_hospede")
          .select("id, quantidade_atual")
          .eq("residente_id", args.residenteId)
          .eq("medicamento", item.medicamento)
          .eq("mes_referencia", mesRef)
          .maybeSingle();

        if (estoq) {
          await supabase
            .from("estoque_hospede")
            .update({ quantidade_atual: estoq.quantidade_atual - item.quantidade })
            .eq("id", estoq.id);
        }
        // Sem registro no mês: saldo negativo ficará visível no painel da farmácia
      }

      return rec.id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["dispensacoes", vars.residenteId, vars.data] });
      qc.invalidateQueries({ queryKey: ["dispensacoes-dia", vars.data] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", vars.residenteId] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}

/** Desfaz uma dispensação: estorna a baixa + remove o registro. */
export function useDesfazerDispensacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dispensacao: Dispensacao) => {
      const mesRef = mesRefDeData(dispensacao.data);
      const itens = dispensacao.itens as ItemDispensacaoJson[];

      // Estornar: incrementa saldo de cada item
      for (const item of itens) {
        const { data: estoq } = await supabase
          .from("estoque_hospede")
          .select("id, quantidade_atual")
          .eq("residente_id", dispensacao.residente_id)
          .eq("medicamento", item.medicamento)
          .eq("mes_referencia", mesRef)
          .maybeSingle();

        if (estoq) {
          await supabase
            .from("estoque_hospede")
            .update({ quantidade_atual: estoq.quantidade_atual + item.quantidade })
            .eq("id", estoq.id);
        }
      }

      // Remover o registro
      const { error } = await supabase
        .from("dispensacao")
        .delete()
        .eq("id", dispensacao.id);
      if (error) throw error;
    },
    onSuccess: (_r, dispensacao) => {
      qc.invalidateQueries({ queryKey: ["dispensacoes", dispensacao.residente_id, dispensacao.data] });
      qc.invalidateQueries({ queryKey: ["dispensacoes-dia", dispensacao.data] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", dispensacao.residente_id] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}
