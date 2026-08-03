import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { Database, FcLancamento, ObraDisciplinaMarco, ObraMedicao } from "@/types/database";

// ===========================================================================
// FLUXO DE CAIXA — lançamentos por DATA DE PAGAMENTO (visão do diretor).
// A tela sincroniza sozinha os pagamentos do módulo Obra (marcos, medições,
// OCs, indiretos) via origem+origem_id; tudo continua 100% editável.
// ===========================================================================

const KEY = ["fc-lancamentos"];
const KEY_IPCA = ["fc-ipca"];

export function useLancamentosFC() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FcLancamento[]> => {
      const { data, error } = await supabase
        .from("fc_lancamentos")
        .select("*")
        .order("data", { ascending: false })
        .order("valor", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useIpcaFC() {
  return useQuery({
    queryKey: KEY_IPCA,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.from("fc_ipca").select("*");
      if (error) return new Map();
      return new Map((data ?? []).map((r) => [r.mes, r.pct]));
    },
  });
}

export interface LancamentoInput {
  data: string;
  valor: number;
  centroCusto: string;
  fornecedor: string;
  descricao: string;
  pagador: "seniors" | "pht" | "ernesto";
  observacao: string;
}

export function useCriarLancamentoFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: LancamentoInput) => {
      if (!v.data) throw new Error("Informe a data do pagamento.");
      if (!(v.valor > 0)) throw new Error("Informe o valor.");
      if (!v.fornecedor.trim()) throw new Error("Informe o fornecedor/destino.");
      const { error } = await supabase.from("fc_lancamentos").insert({
        data: v.data,
        valor: v.valor,
        centro_custo: v.centroCusto.trim() || "indiretos",
        fornecedor: v.fornecedor.trim(),
        descricao: v.descricao.trim() || null,
        pagador: v.pagador,
        observacao: v.observacao.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEditarLancamentoFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string } & LancamentoInput) => {
      if (!(v.valor > 0)) throw new Error("Informe o valor.");
      const patch: Database["public"]["Tables"]["fc_lancamentos"]["Update"] = {
        data: v.data,
        valor: v.valor,
        centro_custo: v.centroCusto.trim(),
        fornecedor: v.fornecedor.trim(),
        descricao: v.descricao.trim() || null,
        pagador: v.pagador,
        observacao: v.observacao.trim() || null,
      };
      const { error } = await supabase.from("fc_lancamentos").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useExcluirLancamentoFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fc_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDefinirIpca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { mes: string; pct: number }) => {
      const { error } = await supabase.from("fc_ipca").upsert({ mes: v.mes, pct: v.pct });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_IPCA }),
  });
}

// ── Sincronização com o módulo Obra (pagamentos → caixa) ────────────────────

type OC = Database["public"]["Tables"]["obra_ordens_compra"]["Row"];
type Indireto = Database["public"]["Tables"]["obra_custos_indiretos"]["Row"];

/**
 * Lançamentos que FALTAM no caixa, a partir do que já foi pago no módulo Obra
 * (dedup por origem+origem_id). Datas SEMPRE de caixa: data de pagamento dos
 * marcos/medições (as NFs da TRÍADE); OCs pela emissão e indiretos pela
 * competência (dia 10) — ajustáveis depois, como tudo aqui.
 */
export function pendentesDeSincronizacao(args: {
  existentes: FcLancamento[];
  marcos: ObraDisciplinaMarco[];
  nomeDisciplina: Map<string, string>;
  medicoes: ObraMedicao[];
  ocs: OC[];
  indiretos: Indireto[];
}): Database["public"]["Tables"]["fc_lancamentos"]["Insert"][] {
  const ja = new Set(args.existentes.filter((l) => l.origem_id).map((l) => `${l.origem}:${l.origem_id}`));
  const novos: Database["public"]["Tables"]["fc_lancamentos"]["Insert"][] = [];

  for (const m of args.marcos) {
    if (m.status !== "Pago" || !m.data_pagamento || ja.has(`marco:${m.id}`)) continue;
    novos.push({
      data: m.data_pagamento, valor: m.valor, centro_custo: "complementares",
      fornecedor: "TRÍADE", descricao: `${args.nomeDisciplina.get(m.disciplina_id) ?? "Projeto"} — ${m.rotulo}`,
      origem: "marco", origem_id: m.id, registrado_por: "sincronização",
    });
  }
  for (const m of args.medicoes) {
    if (m.status !== "Pago" || !m.data_pagamento || ja.has(`medicao:${m.id}`)) continue;
    novos.push({
      data: m.data_pagamento, valor: m.valor_liquido, centro_custo: "construtora",
      fornecedor: "TRÍADE", descricao: `Medição (BM) de ${m.mes}`,
      origem: "medicao", origem_id: m.id, registrado_por: "sincronização",
    });
  }
  for (const o of args.ocs) {
    if (o.status === "Cancelada" || ja.has(`oc:${o.id}`)) continue;
    novos.push({
      data: o.data_emissao, valor: o.valor_total, centro_custo: "materiais",
      fornecedor: o.fornecedor, descricao: `OC — ${o.item}`,
      origem: "oc", origem_id: o.id, registrado_por: "sincronização",
    });
  }
  for (const c of args.indiretos) {
    if (ja.has(`indireto:${c.id}`)) continue;
    novos.push({
      data: `${c.competencia.slice(0, 7)}-10`, valor: c.valor, centro_custo: "indiretos",
      fornecedor: c.categoria, descricao: c.descricao,
      origem: "indireto", origem_id: c.id, registrado_por: "sincronização",
    });
  }
  return novos.filter((n) => n.valor > 0);
}

/** Insere os pendentes (idempotente — conflito em origem+origem_id é ignorado). */
export function useSincronizarFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novos: Database["public"]["Tables"]["fc_lancamentos"]["Insert"][]): Promise<number> => {
      if (novos.length === 0) return 0;
      const { error } = await supabase
        .from("fc_lancamentos")
        .upsert(novos, { onConflict: "origem,origem_id", ignoreDuplicates: true });
      if (error) throw error;
      return novos.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
