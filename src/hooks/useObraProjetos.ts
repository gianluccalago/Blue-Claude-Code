import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import { hojeISO } from "@/lib/utils";
import type {
  Database,
  ObraBimRodada,
  ObraDisciplina,
  ObraDisciplinaMarco,
  ObraMarcoStatus,
} from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 3: projetos complementares (Anexo III). Disciplinas com
// marcos de pagamento (25/40/25/10 ou 50/50), ART, prazo com data-base,
// revisões e rodadas BIM. Pagamento de marco via RPC (gates no banco).
// ===========================================================================

export function useDisciplinas() {
  return useQuery({
    queryKey: ["obra-disciplinas"],
    queryFn: async (): Promise<ObraDisciplina[]> => {
      const { data, error } = await supabase.from("obra_disciplinas").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarcos() {
  return useQuery({
    queryKey: ["obra-marcos"],
    queryFn: async (): Promise<ObraDisciplinaMarco[]> => {
      const { data, error } = await supabase.from("obra_disciplina_marcos").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBimRodadas() {
  return useQuery({
    queryKey: ["obra-bim"],
    queryFn: async (): Promise<ObraBimRodada[]> => {
      const { data, error } = await supabase.from("obra_bim_rodadas").select("*").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["obra-disciplinas"] });
  qc.invalidateQueries({ queryKey: ["obra-marcos"] });
  qc.invalidateQueries({ queryKey: ["obra-bim"] });
}

/** Atualiza dados da disciplina (ART, data-base do prazo, revisões, status). */
export function useAtualizarDisciplina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      dataBase?: string | null;
      revisoesUsadas?: number;
      art?: File | null;
      status?: string;
    }) => {
      const patch: Database["public"]["Tables"]["obra_disciplinas"]["Update"] = {};
      if (args.dataBase !== undefined) patch.data_base = args.dataBase || null;
      if (args.revisoesUsadas !== undefined) patch.revisoes_usadas = args.revisoesUsadas;
      if (args.status) patch.status = args.status;
      if (args.art) {
        const path = await uploadArquivoObra(args.art, `art/${args.id}`);
        if (!path) throw new Error("Falha no upload da ART. Tente novamente.");
        patch.art_url = path;
      }
      const { error } = await supabase.from("obra_disciplinas").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Transições de um marco (entrega em análise / aprovado / reprovado) + upload. */
export function useAtualizarMarco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      status?: ObraMarcoStatus;
      motivo?: string | null;
      entrega?: File | null;
    }) => {
      const patch: Database["public"]["Tables"]["obra_disciplina_marcos"]["Update"] = {};
      if (args.entrega) {
        const path = await uploadArquivoObra(args.entrega, `entregas/${args.id}`);
        if (!path) throw new Error("Falha no upload da entrega. Tente novamente.");
        patch.entrega_url = path;
        patch.status = "Em análise";
      }
      if (args.status) {
        patch.status = args.status;
        if (args.status === "Aprovado") patch.data_aprovacao = hojeISO();
        if (args.status === "Reprovado") patch.motivo = args.motivo?.trim() || null;
      }
      const { error } = await supabase.from("obra_disciplina_marcos").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Paga um marco — RPC com gate (entrega aprovada + ART; retido exige BIM final). */
export function usePagarMarco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (marcoId: string) => {
      const { error } = await supabase.rpc("obra_pagar_marco", { p_marco_id: marcoId });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

// ── BIM ──────────────────────────────────────────────────────────────────────
export function useRegistrarRodadaBim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      numero: number;
      ehFinal: boolean;
      relatorio?: File | null;
      ifc?: File | null;
      observacao?: string;
    }) => {
      if (args.ehFinal && !args.ifc) throw new Error("A rodada final exige o modelo IFC.");
      let relatorioUrl: string | null = null;
      let ifcUrl: string | null = null;
      if (args.relatorio) {
        relatorioUrl = await uploadArquivoObra(args.relatorio, `bim/rodada-${args.numero}/relatorio`);
        if (!relatorioUrl) throw new Error("Falha no upload do relatório de interferências.");
      }
      if (args.ifc) {
        ifcUrl = await uploadArquivoObra(args.ifc, `bim/rodada-${args.numero}/ifc`);
        if (!ifcUrl) throw new Error("Falha no upload do IFC.");
      }
      const { error } = await supabase.from("obra_bim_rodadas").insert({
        numero: args.numero,
        final: args.ehFinal,
        relatorio_url: relatorioUrl,
        ifc_url: ifcUrl,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-bim"] }),
  });
}
