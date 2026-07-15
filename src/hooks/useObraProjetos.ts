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

/**
 * Cria uma disciplina PERSONALIZADA (controle interno) com marcos de pagamento
 * proporcionais (percentuais informados; valores = % × valor da disciplina).
 */
export function useCriarDisciplina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      nome: string;
      valor: number;
      prazoDias: number | null;
      revisoesMax: number;
      marcos: { rotulo: string; percentual: number; exigeEntrega: boolean }[];
      ordem: number;
    }) => {
      if (!args.nome.trim()) throw new Error("Informe o nome da disciplina.");
      if (!Number.isFinite(args.valor) || args.valor < 0) throw new Error("Valor inválido.");
      const somaPct = args.marcos.reduce((s, m) => s + m.percentual, 0);
      if (args.marcos.length > 0 && Math.round(somaPct * 100) / 100 !== 100)
        throw new Error(`Os percentuais dos marcos precisam somar 100% (soma: ${somaPct}%).`);
      const { data: disc, error } = await supabase
        .from("obra_disciplinas")
        .insert({
          ordem: args.ordem,
          nome: args.nome.trim(),
          valor: args.valor,
          prazo_dias: args.prazoDias,
          revisoes_max: args.revisoesMax,
          observacao: "Disciplina adicionada pelo Contratante (fora do Anexo III).",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (args.marcos.length > 0) {
        const CHAVES = ["inicio", "r00", "r01", "entrega", "retido"] as const;
        const { error: e2 } = await supabase.from("obra_disciplina_marcos").insert(
          args.marcos.map((m, i) => ({
            disciplina_id: disc.id,
            ordem: i + 1,
            chave: CHAVES[Math.min(i, CHAVES.length - 1)],
            rotulo: m.rotulo.trim() || `Marco ${i + 1}`,
            percentual: m.percentual,
            valor: Math.round(args.valor * m.percentual) / 100,
            exige_entrega: m.exigeEntrega,
          })),
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => invalidar(qc),
  });
}

/**
 * Edita o CONTRATO da disciplina (nome, valor, prazo, revisões máx.). Ao mudar
 * o valor, os marcos NÃO PAGOS são recalculados (% × novo valor); marcos pagos
 * ficam como estão (dinheiro já saiu — o histórico não se reescreve).
 */
export function useEditarDisciplina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; nome: string; valor: number; prazoDias: number | null; revisoesMax: number }) => {
      if (!args.nome.trim()) throw new Error("Informe o nome da disciplina.");
      if (!Number.isFinite(args.valor) || args.valor < 0) throw new Error("Valor inválido.");
      const { error } = await supabase
        .from("obra_disciplinas")
        .update({ nome: args.nome.trim(), valor: args.valor, prazo_dias: args.prazoDias, revisoes_max: args.revisoesMax })
        .eq("id", args.id);
      if (error) throw error;
      // Recalcula os marcos não pagos a partir do novo valor.
      const { data: marcos, error: e2 } = await supabase
        .from("obra_disciplina_marcos")
        .select("id, percentual, status")
        .eq("disciplina_id", args.id);
      if (e2) throw e2;
      for (const m of marcos ?? []) {
        if (m.status === "Pago") continue;
        const { error: e3 } = await supabase
          .from("obra_disciplina_marcos")
          .update({ valor: Math.round(args.valor * m.percentual) / 100 })
          .eq("id", m.id);
        if (e3) throw e3;
      }
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Exclui uma disciplina SEM marco pago (marcos caem por cascade). */
export function useExcluirDisciplina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: pagos, error } = await supabase
        .from("obra_disciplina_marcos")
        .select("id")
        .eq("disciplina_id", id)
        .eq("status", "Pago")
        .limit(1);
      if (error) throw error;
      if ((pagos ?? []).length > 0) throw new Error("Disciplina com marco PAGO não pode ser excluída.");
      const { error: e2 } = await supabase.from("obra_disciplinas").delete().eq("id", id);
      if (e2) throw e2;
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
