import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { AssentoControlado, TipoAssentoControlado } from "@/types/database";

// ===========================================================================
// Livro de registro de medicamentos sujeitos a controle especial (Portaria
// 344/98). APPEND-ONLY: assento lançado NUNCA é editado/excluído (trigger +
// RLS no banco); correção = ESTORNO como novo assento. Todo lançamento passa
// pela RPC registrar_assento_controlado (hash encadeado server-side).
// Escrita: farmácia, master (RT), coordenação e enfermeira (validado na RPC).
// ===========================================================================

/** Assentos do livro, do mais recente para o mais antigo. */
export function useAssentosControlados() {
  return useQuery({
    queryKey: ["livro-controlados"],
    queryFn: async (): Promise<AssentoControlado[]> => {
      const { data, error } = await supabase
        .from("livro_controlados")
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Lança um assento (a RPC valida perfil, justificativa e referência de estorno). */
export function useRegistrarAssento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId?: string | null;
      medicamento: string;
      tipo: TipoAssentoControlado;
      quantidade: number;
      unidade?: string;
      justificativa?: string | null;
      referencia?: number | null;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc("registrar_assento_controlado", {
        p_residente_id: args.residenteId ?? null,
        p_medicamento: args.medicamento,
        p_tipo: args.tipo,
        p_quantidade: args.quantidade,
        p_unidade: args.unidade ?? "unidade",
        p_justificativa: args.justificativa ?? null,
        p_referencia: args.referencia ?? null,
        p_registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["livro-controlados"] }),
  });
}

export interface IntegridadeLivro {
  integro: boolean;
  primeiro_numero_violado: number | null;
  total_assentos: number;
}

/** Reprocessa a cadeia de hash no servidor e acusa adulteração. */
export function useVerificarIntegridade() {
  return useMutation({
    mutationFn: async (): Promise<IntegridadeLivro> => {
      const { data, error } = await supabase.rpc("verificar_livro_controlados", {});
      if (error) throw error;
      const linha = (data as IntegridadeLivro[] | null)?.[0];
      return linha ?? { integro: true, primeiro_numero_violado: null, total_assentos: 0 };
    },
  });
}

/** Prescrições ativas marcadas como controladas (para pré-preencher assentos). */
export function useMedicamentosControlados() {
  return useQuery({
    queryKey: ["medicamentos-controlados"],
    queryFn: async (): Promise<{ medicamento: string; residente_id: string }[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("medicamento, residente_id")
        .eq("ativa", true)
        .eq("controlado", true);
      if (error) throw error;
      // Dedup por par medicamento|residente.
      const vistos = new Set<string>();
      return (data ?? []).filter((p) => {
        const chave = `${p.medicamento}|${p.residente_id}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      });
    },
  });
}
