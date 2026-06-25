import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FAMILIA_ATUAL } from "@/data/profiles";
import { useTabelaPreco, usePagamentosDoMes } from "@/hooks/useMensalidades";
import { useLancamentosDoMes } from "@/hooks/useUpselling";
import { useCobrancasTemporariasDoMes } from "@/hooks/useCobrancaTemporaria";
import { precoVigenteEm, hojeISO } from "@/lib/mensalidade";
import { valorParcelaDecimo } from "@/lib/decimoTerceiro";
import type { AtividadeParticipacao, CompromissoExterno, Residente } from "@/types/database";

/**
 * Dados curados do hóspede vinculado à família atual (ver FAMILIA_ATUAL —
 * a trava real por hóspede depende da autenticação, ainda não implementada).
 */
export function useResidenteFamilia() {
  return useQuery({
    queryKey: ["residente-familia", FAMILIA_ATUAL.residenteId],
    // Família sem residente vinculado não consulta (evita eq com uuid vazio).
    enabled: !!FAMILIA_ATUAL.residenteId,
    queryFn: async (): Promise<Residente | null> => {
      // Família só vê o hóspede enquanto ATIVO (inativado some do portal).
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("id", FAMILIA_ATUAL.residenteId)
        .eq("status_hospede", "ativo")
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
    enabled: !!residenteId,
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

export interface ParticipacaoResidente {
  id: string;
  atividadeTitulo: string;
  data: string;
}

/**
 * Atividades em que o hóspede PARTICIPOU (presença), mais recentes primeiro —
 * para o card "O dia de" e o resumo de vida ativa do mês. Só bem-estar/vida,
 * sem nada clínico.
 */
export function useParticipacoesResidente() {
  const residenteId = FAMILIA_ATUAL.residenteId;
  return useQuery({
    queryKey: ["participacoes-familia", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<ParticipacaoResidente[]> => {
      const { data, error } = await supabase
        .from("atividade_participacao")
        .select("id, data, atividade:atividade_id(titulo)")
        .eq("residente_id", residenteId)
        .eq("presente", true)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        data: String(row.data),
        atividadeTitulo: (row.atividade as { titulo?: string } | null)?.titulo ?? "Atividade",
      }));
    },
  });
}

/** Compromissos externos do hóspede, do mais próximo ao mais distante. */
export function useCompromissosResidente() {
  return useQuery({
    queryKey: ["compromissos-familia", FAMILIA_ATUAL.residenteId],
    enabled: !!FAMILIA_ATUAL.residenteId,
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

export type CriarCompromissoInput = {
  titulo: string;
  data: string;
  horario: string;
  horarioTransporte: string;
  detalhes: string;
};

/** A família cadastra um novo compromisso externo do hóspede. */
export function useCriarCompromisso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarCompromissoInput) => {
      const { error } = await supabase.from("compromisso_externo").insert({
        residente_id: FAMILIA_ATUAL.residenteId,
        titulo: args.titulo,
        data: args.data || null,
        horario: args.horario || null,
        horario_transporte: args.horarioTransporte || null,
        detalhes: args.detalhes || null,
      });
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
  decimoTerceiro: number;
  cobrancaTemporaria: number;
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
  const cobrancas = useCobrancasTemporariasDoMes(mes);

  const isLoading =
    residente.isLoading || tabelaPreco.isLoading || pagamentos.isLoading || upselling.isLoading || cobrancas.isLoading;
  const isError =
    residente.isError || tabelaPreco.isError || pagamentos.isError || upselling.isError || cobrancas.isError;
  const error = residente.error ?? tabelaPreco.error ?? pagamentos.error ?? upselling.error ?? cobrancas.error;

  const demonstrativo: DemonstrativoFamilia | null = useMemo(() => {
    const r = residente.data;
    if (!r) return null;
    // Só longa permanência paga mensalidade; temporários pagam por cobrança.
    // Fallback = preço vigente na data de ENTRADA do hóspede (espelha a Adm).
    const mensalidade =
      r.modalidade === "longa_permanencia"
        ? r.mensalidade_valor ??
          precoVigenteEm(tabelaPreco.data ?? [], r.tipo_suite, r.grau_dependencia, r.ocupacao, r.data_admissao ?? hojeISO()) ??
          0
        : 0;
    const itens = upselling.data ?? [];
    const upsellingTotal = itens.reduce((acc, i) => acc + i.valor, 0);
    const decimoTerceiro = valorParcelaDecimo(mensalidade, r.data_admissao, mes);
    // RLS entrega à família só as cobranças do seu hóspede.
    const cobrancaTemporaria = (cobrancas.data ?? [])
      .filter((c) => c.residente_id === r.id)
      .reduce((acc, c) => acc + c.valor, 0);
    const pagamento = (pagamentos.data ?? []).find((p) => p.residente_id === r.id);
    return {
      mensalidade,
      upselling: upsellingTotal,
      decimoTerceiro,
      cobrancaTemporaria,
      total: mensalidade + upsellingTotal + decimoTerceiro + cobrancaTemporaria,
      pago: pagamento?.status === "paga",
      itensUpselling: itens.map((i) => ({
        categoria: i.categoria,
        descricao: i.descricao,
        valor: i.valor,
        data: i.data,
      })),
    };
  }, [residente.data, tabelaPreco.data, pagamentos.data, upselling.data, cobrancas.data]);

  return { isLoading, isError, error, demonstrativo, residente: residente.data };
}
