import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadTesteCognitivo } from "@/lib/storage";
import { pontuacaoTotal, type TipoTeste } from "@/lib/testesCognitivos";
import type { TesteCognitivo } from "@/types/database";

// ===========================================================================
// Testes cognitivos (MEEM/MoCA) — avaliativos. NÃO alteram grau_dependencia.
// Médico aplica/registra; visível ao Médico e à Visão 360º (Master).
// ===========================================================================

export function useTestesCognitivos(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["testes-cognitivos", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<TesteCognitivo[]> => {
      const { data, error } = await supabase
        .from("teste_cognitivo")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("aplicado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistrarTesteCognitivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipo: TipoTeste;
      respostas: Record<string, number>;
      escolaridadeAnos: number | null;
      interpretacao: string | null;
      foto?: File | null;
    }) => {
      // O TOTAL é recalculado aqui (fonte da verdade) — não confia em valor da UI.
      const total = pontuacaoTotal(args.tipo, args.respostas, args.escolaridadeAnos);

      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadTesteCognitivo(args.foto, args.residenteId);
        if (!fotoUrl) throw new Error("Falha no upload da foto. Tente novamente.");
      }

      const { error } = await supabase.from("teste_cognitivo").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        respostas: args.respostas,
        pontuacao_total: total,
        escolaridade_anos: args.escolaridadeAnos,
        interpretacao: args.interpretacao?.trim() || null,
        foto_url: fotoUrl,
        aplicado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => qc.invalidateQueries({ queryKey: ["testes-cognitivos", args.residenteId] }),
  });
}
