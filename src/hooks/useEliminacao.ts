import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { hojeISO } from "@/lib/utils";
import type { Eliminacao, TipoEliminacao } from "@/types/database";

/** Janela de busca (horas) suficiente para cobrir o alerta de evacuação (72h). */
const JANELA_HORAS = 72;

/**
 * Registros de eliminação dos últimos 3 dias do residente (mais recente
 * primeiro). Essa janela cobre tanto o resumo de hoje quanto o alerta de
 * evacuação (72h), evitando duas consultas.
 */
export function useEliminacoes(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["eliminacao", residenteId, hojeISO()],
    enabled: !!residenteId,
    queryFn: async (): Promise<Eliminacao[]> => {
      const limite = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("eliminacao")
        .select("*")
        .eq("residente_id", residenteId!)
        .gte("registrado_em", limite)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Registra um evento de eliminação (cada toque = um registro). */
export function useRegistrarEliminacao(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tipo: TipoEliminacao) => {
      const { error } = await supabase.from("eliminacao").insert({
        residente_id: residenteId,
        tipo,
        registrado_por: CUIDADOR_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eliminacao", residenteId] }),
  });
}

/** Remove um registro de eliminação pelo id (toque acidental). */
export function useRemoverEliminacao(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eliminacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eliminacao", residenteId] }),
  });
}

export interface AlertasEliminacao {
  /** Não houve registro de urina no dia civil de hoje (00:00 até agora). */
  semUrinaHoje: boolean;
  /** Não houve registro de evacuação nas últimas 72h. */
  semEvacuacao72h: boolean;
}

/**
 * Calcula os alertas de vigilância clínica a partir de uma lista de registros
 * de eliminação de UM residente.
 *
 * É uma função PURA e reutilizável de propósito: o cálculo acontece sob
 * demanda (quando a tela é aberta) — NÃO é notificação push nem processo em
 * segundo plano. O futuro painel da Coordenação/Enfermagem poderá chamá-la
 * para cada residente e listar todos os que estão em alerta (basta passar os
 * registros do residente cobrindo a janela de 72h).
 */
export function calcularAlertasEliminacao(
  registros: Eliminacao[],
  agora: Date = new Date(),
): AlertasEliminacao {
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  const limite72h = new Date(agora.getTime() - 72 * 60 * 60 * 1000);

  const temUrinaHoje = registros.some(
    (r) => r.tipo === "urina" && new Date(r.registrado_em) >= inicioHoje,
  );
  const temEvacuacaoRecente = registros.some(
    (r) => r.tipo === "evacuacao" && new Date(r.registrado_em) >= limite72h,
  );

  return {
    semUrinaHoje: !temUrinaHoje,
    semEvacuacao72h: !temEvacuacaoRecente,
  };
}

const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

export interface EstadoAlertaEliminacao {
  /** Silenciado há menos de 24h → o alerta deve ficar oculto na lista. */
  oculto: boolean;
  /** Silenciado há 24h+ e a condição persiste → destacar como reincidente. */
  reincidente: boolean;
  /** Escalamento ao médico mais recente (selo), ou null. */
  escaladoEm: string | null;
  /** Conduta (silenciamento) mais recente — para "Persiste após conduta de…". */
  condutaEm: string | null;
  condutaPor: string | null;
  condutaObs: string | null;
}

/**
 * Decide COMO um alerta de eliminação (cuja condição clínica já está ATIVA)
 * deve aparecer, a partir dos tratamentos daquele residente+tipo.
 *
 * Função PURA e reutilizável (cálculo sob demanda ao abrir a tela):
 * - silenciado há < 24h  → oculto;
 * - silenciado há ≥ 24h e condição persiste → reincidente (visível, vermelho);
 * - só escalado / nunca tratado → visível normal;
 * - escalar ao médico NÃO oculta, apenas adiciona o selo.
 *
 * `tratamentos` é a lista (de qualquer ordem) de eliminacao_tratamento do
 * residente para um único tipo de alerta.
 */
export function estadoAlertaEliminacao(
  tratamentos: EliminacaoTratamentoLike[],
  agora: Date = new Date(),
): EstadoAlertaEliminacao {
  let ultimoSilenciado: EliminacaoTratamentoLike | null = null;
  let escaladoEm: string | null = null;

  for (const t of tratamentos) {
    if (t.acao === "silenciado") {
      if (!ultimoSilenciado || new Date(t.tratado_em) > new Date(ultimoSilenciado.tratado_em)) {
        ultimoSilenciado = t;
      }
    } else if (t.acao === "escalado_medico") {
      if (!escaladoEm || new Date(t.tratado_em) > new Date(escaladoEm)) {
        escaladoEm = t.tratado_em;
      }
    }
  }

  let oculto = false;
  let reincidente = false;
  if (ultimoSilenciado) {
    const diff = agora.getTime() - new Date(ultimoSilenciado.tratado_em).getTime();
    if (diff < VINTE_QUATRO_HORAS_MS) oculto = true;
    else reincidente = true;
  }

  return {
    oculto,
    reincidente,
    escaladoEm,
    condutaEm: ultimoSilenciado?.tratado_em ?? null,
    condutaPor: ultimoSilenciado?.tratado_por ?? null,
    condutaObs: ultimoSilenciado?.observacao ?? null,
  };
}

/** Campos mínimos usados por estadoAlertaEliminacao (compatível com a Row). */
interface EliminacaoTratamentoLike {
  acao: string;
  tratado_em: string;
  tratado_por: string | null;
  observacao: string | null;
}
