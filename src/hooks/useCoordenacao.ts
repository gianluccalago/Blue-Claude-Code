import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO, inicioDoDiaISO } from "@/lib/utils";
import { calcularAlertasEliminacao, estadoAlertaEliminacao } from "@/hooks/useEliminacao";
import type {
  Administracao,
  Eliminacao,
  EliminacaoTratamento,
  Intercorrencia,
  PendenciaTratamento,
  Prescricao,
  ResolucaoMedica,
  TipoEliminacao,
  TipoOrigemPendencia,
  AcaoPendencia,
  AcaoEliminacaoTratamento,
} from "@/types/database";
import { usuarioAtual } from "@/auth/usuarioAtual";

/** Janela (dias) para listar intercorrências "recentes" no painel. */
const DIAS_INTERCORRENCIAS = 7;

// ---------------------------------------------------------------------------
// Tratamentos de pendência (resolvido / escalado ao médico)
// ---------------------------------------------------------------------------

export function useTratamentos() {
  return useQuery({
    queryKey: ["tratamentos"],
    queryFn: async (): Promise<PendenciaTratamento[]> => {
      const { data, error } = await supabase
        .from("pendencia_tratamento")
        .select("*")
        .order("tratado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface EstadoPendencia {
  /** Existe tratamento "resolvido" → pendência encerrada. */
  resolvido: boolean;
  /** Instante do escalamento ao médico mais recente (ou null). */
  escaladoEm: string | null;
}

/**
 * Calcula o estado de UMA pendência a partir da lista de tratamentos.
 * Função pura e reutilizável. Escalar ao médico NÃO encerra a pendência —
 * apenas "resolvido" a tira da lista de abertas.
 */
export function estadoDaPendencia(
  tratamentos: PendenciaTratamento[],
  tipoOrigem: TipoOrigemPendencia,
  referenciaId: string,
): EstadoPendencia {
  let resolvido = false;
  let escaladoEm: string | null = null;
  for (const t of tratamentos) {
    if (t.tipo_origem !== tipoOrigem || t.referencia_id !== referenciaId) continue;
    if (t.acao === "resolvido") resolvido = true;
    // tratamentos já vêm ordenados do mais recente p/ o mais antigo.
    if (t.acao === "escalado_medico" && !escaladoEm) escaladoEm = t.tratado_em;
  }
  return { resolvido, escaladoEm };
}

/** Registra um tratamento de pendência (resolvido ou escalado ao médico). */
export function useRegistrarTratamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tipoOrigem: TipoOrigemPendencia;
      referenciaId: string;
      acao: AcaoPendencia;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.from("pendencia_tratamento").insert({
        tipo_origem: args.tipoOrigem,
        referencia_id: args.referenciaId,
        acao: args.acao,
        tratado_por: usuarioAtual.nome,
        observacao: args.observacao ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tratamentos"] }),
  });
}

// ---------------------------------------------------------------------------
// Fontes de pendência
// ---------------------------------------------------------------------------

/** Medicações de hoje com status parcial/nao (origem das pendências de medicação). */
export function useMedicacoesPendentesHoje() {
  return useQuery({
    queryKey: ["coord-medicacoes", hojeISO()],
    queryFn: async (): Promise<Administracao[]> => {
      const { data, error } = await supabase
        .from("administracao")
        .select("*")
        .in("status", ["parcial", "nao"])
        .gte("administrado_em", inicioDoDiaISO())
        .order("administrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Intercorrências recentes (últimos dias) — origem das pendências de intercorrência. */
export function useIntercorrenciasRecentes() {
  return useQuery({
    queryKey: ["coord-intercorrencias", hojeISO()],
    queryFn: async (): Promise<Intercorrencia[]> => {
      const limite = new Date(
        Date.now() - DIAS_INTERCORRENCIAS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("intercorrencia")
        .select("*")
        .gte("registrado_em", limite)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico COMPLETO de intercorrências (todos os residentes), recentes primeiro. */
export function useTodasIntercorrencias() {
  return useQuery({
    queryKey: ["coord-intercorrencias-todas"],
    queryFn: async (): Promise<Intercorrencia[]> => {
      const { data, error } = await supabase
        .from("intercorrencia")
        .select("*")
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Procedimentos exclusivos da enfermagem: prescrições injetável/insulina/sonda ativas. */
export function useProcedimentosEnfermagem() {
  return useQuery({
    queryKey: ["coord-enfermagem"],
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("ativa", true)
        .in("via", ["injetavel", "insulina", "sonda"]);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Um alerta de eliminação VISÍVEL no painel (já considerada a regra de 24h). */
export interface AlertaEliminacaoPainel {
  residenteId: string;
  tipo: TipoEliminacao;
  /** Silenciado há 24h+ e a condição persiste. */
  reincidente: boolean;
  escaladoEm: string | null;
  /** ID do registro eliminacao_tratamento do escalamento mais recente (para cruzar com resolucao_medica). */
  escalacaoId: string | null;
  condutaEm: string | null;
  condutaPor: string | null;
  condutaObs: string | null;
}

/** Todos os tratamentos de alerta de eliminação registrados. */
export function useEliminacaoTratamentos() {
  return useQuery({
    queryKey: ["eliminacao-tratamentos"],
    queryFn: async (): Promise<EliminacaoTratamento[]> => {
      const { data, error } = await supabase
        .from("eliminacao_tratamento")
        .select("*")
        .order("tratado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Alertas de eliminação VISÍVEIS de TODOS os residentes, recalculados ao abrir
 * o painel. Combina a condição clínica (calcularAlertasEliminacao, 72h) com o
 * tratamento mais recente (estadoAlertaEliminacao): alertas silenciados há
 * menos de 24h são omitidos; os que persistem após a conduta voltam como
 * reincidentes. Busca tudo em poucas consultas e agrupa em memória.
 */
export function useAlertasEliminacaoPainel() {
  return useQuery({
    queryKey: ["coord-alertas-eliminacao", hojeISO()],
    queryFn: async (): Promise<AlertaEliminacaoPainel[]> => {
      const residentesResp = await supabase.from("residentes").select("id");
      if (residentesResp.error) throw residentesResp.error;
      const ids = (residentesResp.data ?? []).map((r) => r.id);
      if (ids.length === 0) return [];

      const limite72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const elimResp = await supabase
        .from("eliminacao")
        .select("*")
        .gte("registrado_em", limite72h);
      if (elimResp.error) throw elimResp.error;

      const tratResp = await supabase.from("eliminacao_tratamento").select("*");
      if (tratResp.error) throw tratResp.error;

      const elimPorResidente = new Map<string, Eliminacao[]>();
      for (const r of elimResp.data ?? []) {
        const arr = elimPorResidente.get(r.residente_id) ?? [];
        arr.push(r);
        elimPorResidente.set(r.residente_id, arr);
      }
      // chave "residenteId|tipo_alerta"
      const tratPorChave = new Map<string, EliminacaoTratamento[]>();
      for (const t of tratResp.data ?? []) {
        const k = `${t.residente_id}|${t.tipo_alerta}`;
        const arr = tratPorChave.get(k) ?? [];
        arr.push(t);
        tratPorChave.set(k, arr);
      }

      const agora = new Date();
      const resultado: AlertaEliminacaoPainel[] = [];
      for (const id of ids) {
        const cond = calcularAlertasEliminacao(elimPorResidente.get(id) ?? [], agora);
        // Evacuação primeiro (mais grave), depois urina.
        const tipos: { tipo: TipoEliminacao; ativo: boolean }[] = [
          { tipo: "evacuacao", ativo: cond.semEvacuacao72h },
          { tipo: "urina", ativo: cond.semUrinaHoje },
        ];
        for (const { tipo, ativo } of tipos) {
          if (!ativo) continue;
          const estado = estadoAlertaEliminacao(tratPorChave.get(`${id}|${tipo}`) ?? [], agora);
          if (estado.oculto) continue; // silenciado há < 24h
          resultado.push({
            residenteId: id,
            tipo,
            reincidente: estado.reincidente,
            escaladoEm: estado.escaladoEm,
            escalacaoId: estado.escalacaoId,
            condutaEm: estado.condutaEm,
            condutaPor: estado.condutaPor,
            condutaObs: estado.condutaObs,
          });
        }
      }
      return resultado;
    },
  });
}

/**
 * Todas as resoluções médicas (para o reflexo nas telas da Coordenação).
 * Falha graciosamente — se a tabela ainda não existir, retorna array vazio.
 */
export function useResolucoesMedicas() {
  return useQuery({
    queryKey: ["resolucoes-medicas"],
    queryFn: async (): Promise<ResolucaoMedica[]> => {
      const { data, error } = await supabase.from("resolucao_medica").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Registra um tratamento de alerta de eliminação (silenciar / escalar). */
export function useRegistrarEliminacaoTratamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipoAlerta: TipoEliminacao;
      acao: AcaoEliminacaoTratamento;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.from("eliminacao_tratamento").insert({
        residente_id: args.residenteId,
        tipo_alerta: args.tipoAlerta,
        acao: args.acao,
        observacao: args.observacao ?? null,
        tratado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coord-alertas-eliminacao"] });
      qc.invalidateQueries({ queryKey: ["eliminacao-tratamentos"] });
    },
  });
}
