import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type {
  AgravoEpidemiologico, EventoSentinela, RelatorioSanitarioExtraido, Residente,
} from "@/types/database";
import type { PeriodoTipo, ValoresRelatorio } from "@/lib/relatorioSanitario";

// ===========================================================================
// Relatório Sanitário — dados de cálculo, trilha interna (original × editado)
// e histórico. Só Master/RT. Os registros do sistema NÃO são alterados.
// ===========================================================================

export interface DadosRelatorio {
  agravos: AgravoEpidemiologico[];
  residentes: Residente[];
  eventos: EventoSentinela[];
}

export function useDadosRelatorio() {
  return useQuery({
    queryKey: ["dados-relatorio-sanitario"],
    queryFn: async (): Promise<DadosRelatorio> => {
      const [agr, resis, evt] = await Promise.all([
        supabase.from("agravo_epidemiologico").select("*"),
        supabase.from("residentes").select("*"),
        supabase.from("evento_sentinela").select("*"),
      ]);
      if (agr.error) throw agr.error;
      if (resis.error) throw resis.error;
      if (evt.error) throw evt.error;
      return { agravos: agr.data ?? [], residentes: resis.data ?? [], eventos: evt.data ?? [] };
    },
  });
}

export function useRelatoriosExtraidos() {
  return useQuery({
    queryKey: ["relatorios-extraidos"],
    queryFn: async (): Promise<RelatorioSanitarioExtraido[]> => {
      const { data, error } = await supabase
        .from("relatorio_sanitario_extraido")
        .select("*")
        .order("extraido_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarRelatorioExtraido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tipo: PeriodoTipo;
      inicio: string;
      fim: string;
      originais: ValoresRelatorio;
      extraidos: ValoresRelatorio;
      houveEdicao: boolean;
      hash: string;
    }) => {
      const { error } = await supabase.from("relatorio_sanitario_extraido").insert({
        periodo_tipo: args.tipo,
        periodo_inicio: args.inicio,
        periodo_fim: args.fim,
        valores_originais: args.originais as unknown as Record<string, unknown>,
        valores_extraidos: args.extraidos as unknown as Record<string, unknown>,
        houve_edicao: args.houveEdicao,
        extraido_por: usuarioAtual.nome,
        hash: args.hash,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relatorios-extraidos"] }),
  });
}
