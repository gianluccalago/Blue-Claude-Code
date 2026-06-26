import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { TIPO_REGISTRO_DE } from "@/lib/indicadoresRdc";
import type { AgravoEpidemiologico, Residente, TipoAgravo } from "@/types/database";

// ===========================================================================
// Indicadores RDC 502 — dados de cálculo (agravos + residentes) e registro de
// agravo (Coordenação/Médico). O óbito é conciliado com a saída por
// falecimento via trigger no banco (0086). Não exposto à família.
// ===========================================================================

export interface DadosIndicadores {
  agravos: AgravoEpidemiologico[];
  residentes: Residente[]; // ativos + inativos (para população por dia 15 e óbitos)
}

export function useDadosIndicadoresRdc() {
  return useQuery({
    queryKey: ["agravos-rdc"],
    queryFn: async (): Promise<DadosIndicadores> => {
      const [agravosResp, resisResp] = await Promise.all([
        supabase.from("agravo_epidemiologico").select("*").order("data_ocorrencia", { ascending: false }),
        supabase.from("residentes").select("*"),
      ]);
      if (agravosResp.error) throw agravosResp.error;
      if (resisResp.error) throw resisResp.error;
      return { agravos: agravosResp.data ?? [], residentes: resisResp.data ?? [] };
    },
  });
}

/** Lista de agravos (para a tabela de lançamentos), com nome do residente. */
export interface AgravoComNome extends AgravoEpidemiologico {
  residenteNome: string | null;
}

export function useRegistrarAgravo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipo: TipoAgravo;
      dataOcorrencia: string;
      descricao?: string | null;
    }) => {
      const { error } = await supabase.from("agravo_epidemiologico").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        data_ocorrencia: args.dataOcorrencia,
        tipo_registro: TIPO_REGISTRO_DE[args.tipo],
        descricao: args.descricao?.trim() || null,
        registrado_por: usuarioAtual.nome,
        perfil_registrador: usuarioAtual.perfil,
      });
      if (error) throw error;
      // (O óbito inativa o residente por falecimento via trigger no banco.)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agravos-rdc"] });
      // Óbito pode ter inativado um residente → atualiza listas dependentes.
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["residentes-inativos"] });
    },
  });
}
