import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Intercorrencia } from "@/types/database";

// ===========================================================================
// Alertas de ACIONAMENTO DE AMBULÂNCIA — visibilidade IMEDIATA para o Médico e
// o Master, sem depender da escalação da Coordenação. Lista as intercorrências
// com ambulância acionada nas últimas horas e marca quais já tiveram resolução
// médica (para sair do alerta). Sem realtime: recarrega ao trocar de tela
// (mesma estratégia das notificações).
// ===========================================================================

const HORAS_JANELA = 48;

export interface AlertaAmbulancia {
  intercorrencia: Intercorrencia;
  residenteNome: string | null;
  residenteQuarto: string | null;
  /** Já houve resolução médica registrada para esta intercorrência. */
  resolvida: boolean;
}

export function useAlertasAmbulancia() {
  return useQuery({
    queryKey: ["alertas-ambulancia"],
    queryFn: async (): Promise<AlertaAmbulancia[]> => {
      const limite = new Date(Date.now() - HORAS_JANELA * 60 * 60 * 1000).toISOString();

      const [interResp, resolResp] = await Promise.all([
        supabase
          .from("intercorrencia")
          .select("*")
          .eq("ambulancia_acionada", true)
          .gte("registrado_em", limite)
          .order("registrado_em", { ascending: false }),
        supabase
          .from("resolucao_medica")
          .select("referencia_id, tipo_origem")
          .eq("tipo_origem", "intercorrencia"),
      ]);
      if (interResp.error) throw interResp.error;
      if (resolResp.error) throw resolResp.error;

      const intercorrencias = interResp.data ?? [];
      const resolvidas = new Set((resolResp.data ?? []).map((r) => r.referencia_id));

      // Nome/quarto do hóspede vêm de `residentes` (a intercorrência guarda só o id).
      const ids = [...new Set(intercorrencias.map((i) => i.residente_id))];
      const residentes = new Map<string, { nome: string; quarto: string | null }>();
      if (ids.length > 0) {
        const { data, error } = await supabase
          .from("residentes")
          .select("id, nome, quarto")
          .in("id", ids);
        if (error) throw error;
        for (const r of data ?? []) residentes.set(r.id, { nome: r.nome, quarto: r.quarto });
      }

      return intercorrencias.map((i) => ({
        intercorrencia: i,
        residenteNome: residentes.get(i.residente_id)?.nome ?? null,
        residenteQuarto: residentes.get(i.residente_id)?.quarto ?? null,
        resolvida: resolvidas.has(i.id),
      }));
    },
  });
}
