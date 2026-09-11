import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { valorComSinal, type GrupoFC } from "@/lib/fluxoCaixa";
import type { Database, FcLancamento, ObraDisciplinaMarco, ObraMedicao, ObraNotaFiscal } from "@/types/database";

// ===========================================================================
// FLUXO DE CAIXA — FONTE ÚNICA (fc_lancamentos), por DATA DE PAGAMENTO.
// Carrega a planilha inteira do sócio-diretor (entradas, saídas, saldo) e
// recebe sozinho os pagamentos do módulo Obra (origem+origem_id), sem contar
// duas vezes o que a planilha já trouxe. Tudo continua 100% editável.
// Valores COM SINAL: saída negativa, entrada como na planilha.
// ===========================================================================

export const KEY_FC = ["fc-lancamentos"];
const KEY_IPCA = ["fc-ipca"];

export function useLancamentosFC() {
  return useQuery({
    queryKey: KEY_FC,
    queryFn: async (): Promise<FcLancamento[]> => {
      const { data, error } = await supabase
        .from("fc_lancamentos")
        .select("*")
        .order("data", { ascending: false })
        .order("grupo", { ascending: false })
        .order("ordem", { ascending: true });
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
  grupo: GrupoFC;
  valor: number;          // como digitado; o sinal é aplicado pelo grupo
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
      if (!v.data) throw new Error("Informe a data.");
      if (!v.valor) throw new Error("Informe o valor.");
      if (!v.fornecedor.trim()) throw new Error("Informe o fornecedor/origem.");
      const { error } = await supabase.from("fc_lancamentos").insert({
        data: v.data,
        valor: valorComSinal(v.grupo, v.valor),
        grupo: v.grupo,
        centro_custo: v.centroCusto.trim() || (v.grupo === "entrada" ? "socios" : "indiretos"),
        fornecedor: v.fornecedor.trim(),
        descricao: v.descricao.trim() || null,
        pagador: v.pagador,
        observacao: v.observacao.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FC }),
  });
}

export function useEditarLancamentoFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string } & LancamentoInput) => {
      if (!v.valor) throw new Error("Informe o valor.");
      const patch: Database["public"]["Tables"]["fc_lancamentos"]["Update"] = {
        data: v.data,
        valor: valorComSinal(v.grupo, v.valor),
        grupo: v.grupo,
        centro_custo: v.centroCusto.trim(),
        fornecedor: v.fornecedor.trim(),
        descricao: v.descricao.trim() || null,
        pagador: v.pagador,
        observacao: v.observacao.trim() || null,
      };
      const { error } = await supabase.from("fc_lancamentos").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FC }),
  });
}

export function useExcluirLancamentoFC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fc_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FC }),
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

const EH_TRIADE = /tr[ií]ade/i;

/**
 * REGRA DA PLANILHA: quando o sócio-diretor já registrou pagamento à TRÍADE
 * num mês (linha "Triade" da planilha, ou digitada à mão), aquele mês está
 * fechado para a TRÍADE — a transferência dele cobre os itens (entradas de
 * projeto, medições, NF) pagos naquele mês, e o módulo Obra NÃO cria outra
 * linha. Foi exatamente o caso de agosto/2026: uma linha "Triade" de
 * 149.580 cobria os 11 itens da NF 13, inclusive a entrada da Terraplanagem
 * que tinha entrado em separado (10.000) e contava duas vezes.
 * Em meses sem linha da planilha, o módulo Obra alimenta o caixa sozinho.
 */
export function jaNoCaixaPelaPlanilha(existentes: FcLancamento[], mes: string): boolean {
  return existentes.some((l) =>
    !l.origem_id && l.grupo === "saida" && l.data.slice(0, 7) === mes && EH_TRIADE.test(l.fornecedor),
  );
}

/**
 * Lançamentos que FALTAM no caixa, a partir do que já foi pago no módulo Obra
 * (dedup por origem+origem_id e pela REGRA DA PLANILHA acima). Datas SEMPRE
 * de caixa: data de pagamento das NFs; OCs pela emissão e indiretos pela
 * competência (dia 10) — ajustáveis depois, como tudo aqui.
 * NF PAGA entra como DUAS pernas: o LÍQUIDO pago à TRÍADE (valor − retenções)
 * e as RETENÇÕES (guias IRRF/CSRF/ISS). Marcos/medições cobertos por alguma
 * NF NÃO entram individualmente — só os pagos direto, fora do fluxo de NF.
 * Tudo sai NEGATIVO (é saída de caixa).
 */
export function pendentesDeSincronizacao(args: {
  existentes: FcLancamento[];
  marcos: ObraDisciplinaMarco[];
  nomeDisciplina: Map<string, string>;
  medicoes: ObraMedicao[];
  ocs: OC[];
  indiretos: Indireto[];
  notas: ObraNotaFiscal[];
}): Database["public"]["Tables"]["fc_lancamentos"]["Insert"][] {
  const ja = new Set(args.existentes.filter((l) => l.origem_id).map((l) => `${l.origem}:${l.origem_id}`));
  const novos: Database["public"]["Tables"]["fc_lancamentos"]["Insert"][] = [];
  const saida = (valor: number) => -Math.abs(valor);

  // Itens (marcos/medições) cobertos por qualquer NF — o caixa deles é a NF.
  const cobertosPorNF = new Set<string>();
  for (const n of args.notas) for (const i of n.itens) cobertosPorNF.add(i.id);

  for (const n of args.notas) {
    if (n.status !== "paga" || !n.data_pagamento) continue;
    const soMedicoes = n.itens.length > 0 && n.itens.every((i) => i.tipo === "medicao");
    const centro = soMedicoes ? "construtora" : "complementares";
    const liquido = Math.max(0, n.valor - (n.retencoes ?? 0));
    const resumo = n.itens.map((i) => i.rotulo).join(" · ");
    if (jaNoCaixaPelaPlanilha(args.existentes, n.data_pagamento.slice(0, 7))) continue;
    if (!ja.has(`nf:${n.id}`) && liquido > 0) {
      novos.push({
        data: n.data_pagamento, valor: saida(liquido), grupo: "saida", centro_custo: centro,
        fornecedor: "TRÍADE", descricao: `NF ${n.numero} (líquido)${resumo ? ` — ${resumo}` : ""}`,
        origem: "nf", origem_id: n.id, registrado_por: "sincronização",
      });
    }
    if (!ja.has(`nf_retencao:${n.id}`) && (n.retencoes ?? 0) > 0) {
      novos.push({
        data: n.data_pagamento, valor: saida(n.retencoes), grupo: "saida", centro_custo: centro,
        fornecedor: "Guias de retenção", descricao: `NF ${n.numero} — IRRF/CSRF/ISS retidos (ajuste a data se as guias saírem depois)`,
        origem: "nf_retencao", origem_id: n.id, registrado_por: "sincronização",
      });
    }
  }

  for (const m of args.marcos) {
    if (m.status !== "Pago" || !m.data_pagamento || ja.has(`marco:${m.id}`) || cobertosPorNF.has(m.id)) continue;
    if (jaNoCaixaPelaPlanilha(args.existentes, m.data_pagamento.slice(0, 7))) continue;
    novos.push({
      data: m.data_pagamento, valor: saida(m.valor), grupo: "saida", centro_custo: "complementares",
      fornecedor: "TRÍADE", descricao: `${args.nomeDisciplina.get(m.disciplina_id) ?? "Projeto"} — ${m.rotulo}`,
      origem: "marco", origem_id: m.id, registrado_por: "sincronização",
    });
  }
  for (const m of args.medicoes) {
    if (m.status !== "Pago" || !m.data_pagamento || ja.has(`medicao:${m.id}`) || cobertosPorNF.has(m.id)) continue;
    if (jaNoCaixaPelaPlanilha(args.existentes, m.data_pagamento.slice(0, 7))) continue;
    novos.push({
      data: m.data_pagamento, valor: saida(m.valor_liquido), grupo: "saida", centro_custo: "construtora",
      fornecedor: "TRÍADE", descricao: `Medição (BM) de ${m.mes}`,
      origem: "medicao", origem_id: m.id, registrado_por: "sincronização",
    });
  }
  for (const o of args.ocs) {
    if (o.status === "Cancelada" || ja.has(`oc:${o.id}`)) continue;
    novos.push({
      data: o.data_emissao, valor: saida(o.valor_total), grupo: "saida", centro_custo: "materiais",
      fornecedor: o.fornecedor, descricao: `OC — ${o.item}`,
      origem: "oc", origem_id: o.id, registrado_por: "sincronização",
    });
  }
  for (const c of args.indiretos) {
    if (ja.has(`indireto:${c.id}`)) continue;
    novos.push({
      data: `${c.competencia.slice(0, 7)}-10`, valor: saida(c.valor), grupo: "saida", centro_custo: "indiretos",
      fornecedor: c.categoria, descricao: c.descricao,
      origem: "indireto", origem_id: c.id, registrado_por: "sincronização",
    });
  }
  return novos.filter((n) => n.valor < 0);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FC }),
  });
}
