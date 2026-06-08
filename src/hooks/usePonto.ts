import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import type { Usuario } from "@/types/database";

/**
 * Usuário/profissional atual (fixo: Ana Paula, enquanto não há login).
 * Usado para saber se ela é isenta do ponto do app (isento_ponto_app).
 */
export function useProfissionalAtual() {
  return useQuery({
    queryKey: ["profissional", CUIDADOR_ATUAL.id],
    queryFn: async (): Promise<Usuario | null> => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", CUIDADOR_ATUAL.id)
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export type TipoPonto = "entrada" | "saida";

/**
 * Registra o ponto (entrada/saída) num turno.
 * - Pela profissional: passa lat/lng obtidos do GPS (já validados no raio).
 * - Pela Coordenação (ajuste manual): manual=true, sem coordenadas, e pode
 *   informar `quando` (timestamp escolhido); senão usa agora.
 */
export function useRegistrarPonto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      turnoId: string;
      tipo: TipoPonto;
      lat?: number | null;
      lng?: number | null;
      manual?: boolean;
      quando?: string; // ISO; default = agora
    }) => {
      const ts = args.quando ?? new Date().toISOString();
      const patch =
        args.tipo === "entrada"
          ? {
              check_in: ts,
              check_in_lat: args.lat ?? null,
              check_in_lng: args.lng ?? null,
              check_in_manual: !!args.manual,
            }
          : {
              check_out: ts,
              check_out_lat: args.lat ?? null,
              check_out_lng: args.lng ?? null,
              check_out_manual: !!args.manual,
            };
      const { error } = await supabase.from("turnos").update(patch).eq("id", args.turnoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minha-escala"] });
      qc.invalidateQueries({ queryKey: ["turnos"] });
      qc.invalidateQueries({ queryKey: ["plantao"] });
    },
  });
}
