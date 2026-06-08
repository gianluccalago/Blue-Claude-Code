import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO, inicioDoDiaISO } from "@/lib/utils";
import { calcularAlertasEliminacao, type AlertasEliminacao } from "@/hooks/useEliminacao";
import type {
  Administracao,
  Eliminacao,
  Intercorrencia,
  PendenciaTratamento,
  Prescricao,
  TipoOrigemPendencia,
  AcaoPendencia,
} from "@/types/database";

/** Quem trata as pendências neste painel (sem login ainda). */
const COORDENACAO = "Coordenação";

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
        tratado_por: COORDENACAO,
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

export interface ResidenteEmAlerta {
  residenteId: string;
  alertas: AlertasEliminacao;
}

/**
 * Alertas de eliminação de TODOS os residentes, calculados sob demanda ao
 * abrir o painel (reutiliza calcularAlertasEliminacao). Busca os registros das
 * últimas 72h de uma vez e agrupa por residente.
 */
export function useAlertasEliminacaoGlobais() {
  return useQuery({
    queryKey: ["coord-alertas-eliminacao", hojeISO()],
    queryFn: async (): Promise<ResidenteEmAlerta[]> => {
      const residentesResp = await supabase.from("residentes").select("id");
      if (residentesResp.error) throw residentesResp.error;
      const ids = (residentesResp.data ?? []).map((r) => r.id);
      if (ids.length === 0) return [];

      const limite72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: regs, error } = await supabase
        .from("eliminacao")
        .select("*")
        .gte("registrado_em", limite72h);
      if (error) throw error;

      const porResidente = new Map<string, Eliminacao[]>();
      for (const r of regs ?? []) {
        const arr = porResidente.get(r.residente_id) ?? [];
        arr.push(r);
        porResidente.set(r.residente_id, arr);
      }

      const emAlerta: ResidenteEmAlerta[] = [];
      for (const id of ids) {
        const alertas = calcularAlertasEliminacao(porResidente.get(id) ?? []);
        if (alertas.semUrinaHoje || alertas.semEvacuacao72h) {
          emAlerta.push({ residenteId: id, alertas });
        }
      }
      return emAlerta;
    },
  });
}
