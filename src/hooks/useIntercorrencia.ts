import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadFotoIntercorrencia } from "@/lib/storage";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import type { DadosAmbulancia } from "@/lib/ambulancia";

// Converte os dados de ambulância da UI para as colunas da intercorrência.
// `null` quando não foi acionada (mantém as colunas limpas).
function patchAmbulancia(amb: DadosAmbulancia | null) {
  if (!amb) {
    return {
      ambulancia_acionada: false,
      ambulancia_medico: null,
      ambulancia_tempo_resposta_min: null,
      ambulancia_desfecho: null,
      ambulancia_hospital_destino: null,
    } as const;
  }
  return {
    ambulancia_acionada: true,
    ambulancia_medico: amb.medico.trim() || null,
    ambulancia_tempo_resposta_min: amb.tempoRespostaMin,
    ambulancia_desfecho: amb.desfecho,
    // Hospital de destino só faz sentido quando houve remoção.
    ambulancia_hospital_destino:
      amb.desfecho === "removido_hospital" ? amb.hospitalDestino.trim() || null : null,
  } as const;
}

export function useRegistrarIntercorrencia() {
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipo: string;
      observacao: string;
      foto?: File | null;
      /** Chamado de ambulância (opcional) registrado já no momento da ocorrência. */
      ambulancia?: DadosAmbulancia | null;
    }) => {
      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadFotoIntercorrencia(args.foto, args.residenteId);
      }
      const { error } = await supabase.from("intercorrencia").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        observacao: args.observacao.trim() || null,
        registrado_por: CUIDADOR_ATUAL.nome,
        foto_url: fotoUrl,
        ...patchAmbulancia(args.ambulancia ?? null),
      });
      if (error) throw error;
    },
  });
}

/**
 * Registra/edita o chamado de ambulância de uma intercorrência já existente —
 * os detalhes (médico, tempo de resposta, desfecho) em geral chegam DEPOIS do
 * registro inicial. Usado pela Coordenação. Passar `ambulancia: null` desfaz.
 */
export function useRegistrarAmbulancia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; ambulancia: DadosAmbulancia | null }) => {
      const { error } = await supabase
        .from("intercorrencia")
        .update({ ...patchAmbulancia(args.ambulancia) })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coord-intercorrencias-todas"] });
      qc.invalidateQueries({ queryKey: ["coord-intercorrencias"] });
    },
  });
}
