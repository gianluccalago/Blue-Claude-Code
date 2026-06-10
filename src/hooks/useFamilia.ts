import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FAMILIA_ATUAL } from "@/data/profiles";
import { useTabelaPreco, usePagamentosDoMes } from "@/hooks/useMensalidades";
import { useLancamentosDoMes } from "@/hooks/useUpselling";
import { chavePreco } from "@/lib/mensalidade";
import type { AtividadeParticipacao, CompromissoExterno, Residente } from "@/types/database";

/**
 * Dados curados do hóspede vinculado à família atual (ver FAMILIA_ATUAL —
 * a trava real por hóspede depende da autenticação, ainda não implementada).
 */
export function useResidenteFamilia() {
  return useQuery({
    queryKey: ["residente-familia", FAMILIA_ATUAL.residenteId],
    queryFn: async (): Promise<Residente | null> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("id", FAMILIA_ATUAL.residenteId)
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export interface FotoAtividade {
  id: string;
  fotoUrl: string;
  atividadeTitulo: string;
  data: string;
  descricaoGeral: string | null;
}

/**
 * Fotos das atividades em que o hóspede participou: cruza
 * atividade_participacao (presença) com atividade_execucao (foto_url),
 * pareando por (atividade_id, data) — não há FK direta entre as duas.
 */
export function useFotosResidente() {
  const residenteId = FAMILIA_ATUAL.residenteId;
  return useQuery({
    queryKey: ["fotos-familia", residenteId],
    queryFn: async (): Promise<FotoAtividade[]> => {
      const { data: rows, error: errP } = await supabase
        .from("atividade_participacao")
        .select("*, atividade:atividade_id(titulo)")
        .eq("residente_id", residenteId)
        .eq("presente", true)
        .order("data", { ascending: false });
      if (errP) throw errP;

      const participacoes = (rows ?? []).map((row: Record<string, unknown>) => ({
        ...(row as AtividadeParticipacao),
        atividade_titulo: (row.atividade as { titulo?: string } | null)?.titulo,
      }));
      if (participacoes.length === 0) return [];

      const atividadeIds = [...new Set(participacoes.map((p) => p.atividade_id))];
      const { data: execucoes, error: errE } = await supabase
        .from("atividade_execucao")
        .select("*")
        .in("atividade_id", atividadeIds)
        .not("foto_url", "is", null);
      if (errE) throw errE;

      const execMap = new Map((execucoes ?? []).map((e) => [`${e.atividade_id}|${e.data}`, e]));

      const fotos: FotoAtividade[] = [];
      for (const p of participacoes) {
        const exec = execMap.get(`${p.atividade_id}|${p.data}`);
        if (!exec?.foto_url) continue;
        fotos.push({
          id: exec.id,
          fotoUrl: exec.foto_url,
          atividadeTitulo: p.atividade_titulo ?? "Atividade",
          data: p.data,
          descricaoGeral: exec.descricao_geral,
        });
      }
      return fotos;
    },
  });
}

/** Compromissos externos do hóspede, do mais próximo ao mais distante. */
export function useCompromissosResidente() {
  return useQuery({
    queryKey: ["compromissos-familia", FAMILIA_ATUAL.residenteId],
    queryFn: async (): Promise<CompromissoExterno[]> => {
      const { data, error } = await supabase
        .from("compromisso_externo")
        .select("*")
        .eq("residente_id", FAMILIA_ATUAL.residenteId)
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** A família edita/adiciona os detalhes/instruções de um compromisso externo. */
export function useAtualizarDetalhesCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; detalhes: string }) => {
      const { error } = await supabase
        .from("compromisso_externo")
        .update({ detalhes: args.detalhes })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compromissos-familia", FAMILIA_ATUAL.residenteId] }),
  });
}

export interface ItemUpsellingFamilia {
  categoria: string;
  descricao: string | null;
  valor: number;
  data: string;
}

export interface DemonstrativoFamilia {
  mensalidade: number;
  upselling: number;
  total: number;
  pago: boolean;
  itensUpselling: ItemUpsellingFamilia[];
}

/**
 * Demonstrativo do mês do hóspede (mensalidade + upselling = total), em
 * modo leitura — espelha o que a Administração gera.
 */
export function useDemonstrativoFamilia(mes: string) {
  const residente = useResidenteFamilia();
  const tabelaPreco = useTabelaPreco();
  const pagamentos = usePagamentosDoMes(mes);
  const upselling = useLancamentosDoMes(FAMILIA_ATUAL.residenteId, mes);

  const isLoading = residente.isLoading || tabelaPreco.isLoading || pagamentos.isLoading || upselling.isLoading;
  const isError = residente.isError || tabelaPreco.isError || pagamentos.isError || upselling.isError;
  const error = residente.error ?? tabelaPreco.error ?? pagamentos.error ?? upselling.error;

  const demonstrativo: DemonstrativoFamilia | null = useMemo(() => {
    const r = residente.data;
    if (!r) return null;
    const precoMap = new Map((tabelaPreco.data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau), p.valor]));
    const mensalidade = r.mensalidade_valor ?? precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia)) ?? 0;
    const itens = upselling.data ?? [];
    const upsellingTotal = itens.reduce((acc, i) => acc + i.valor, 0);
    const pagamento = (pagamentos.data ?? []).find((p) => p.residente_id === r.id);
    return {
      mensalidade,
      upselling: upsellingTotal,
      total: mensalidade + upsellingTotal,
      pago: pagamento?.status === "pago",
      itensUpselling: itens.map((i) => ({
        categoria: i.categoria,
        descricao: i.descricao,
        valor: i.valor,
        data: i.data,
      })),
    };
  }, [residente.data, tabelaPreco.data, pagamentos.data, upselling.data]);

  return { isLoading, isError, error, demonstrativo, residente: residente.data };
}
