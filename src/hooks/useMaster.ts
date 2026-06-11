import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dataISO, hojeISO, horarioParaMinutos } from "@/lib/utils";
import type {
  GrauDependencia,
  PlanoCuidadoItem,
  Residente,
  TarefaRegistro,
} from "@/types/database";

// ===========================================================================
// useMaster — fontes de dados do Painel estratégico do Master (MASTER-1).
//
// Regra do painel: TODO indicador vem de dados REAIS do banco. Onde a fonte
// ainda não existe (ex: mensalidades, custos, manutenção, IVCF), a TELA exibe
// "sem dados" e comenta a origem — este arquivo só expõe o que é calculável
// com o schema atual (ver supabase/migrations/0001_init.sql).
// ===========================================================================

// ---------------------------------------------------------------------------
// BLOCO OCUPAÇÃO — distribuições puras sobre a lista de residentes.
// (A lista em si vem de useResidentes(), em usePlanos.)
// ---------------------------------------------------------------------------

export interface DistribuicaoOcupacao {
  /** Residentes cadastrados (= ativos: ainda não há campo de saída/desligamento). */
  totalAtivos: number;
  /** Quantos em cada grau de dependência (I/II/III) e sem grau informado. */
  porGrau: Record<GrauDependencia, number> & { sem: number };
  /** Quantos em cada módulo cadastrado (chave "Módulo N" ou "Sem módulo"). */
  porModulo: { rotulo: string; total: number }[];
}

/** Agrega a ocupação a partir dos residentes (função pura e reutilizável). */
export function calcularOcupacao(residentes: Residente[]): DistribuicaoOcupacao {
  const porGrau = { I: 0, II: 0, III: 0, sem: 0 } as DistribuicaoOcupacao["porGrau"];
  const modulos = new Map<string, number>();
  for (const r of residentes) {
    if (r.grau_dependencia) porGrau[r.grau_dependencia] += 1;
    else porGrau.sem += 1;
    const rotulo = r.modulo === null ? "Sem módulo" : `Módulo ${r.modulo}`;
    modulos.set(rotulo, (modulos.get(rotulo) ?? 0) + 1);
  }
  const porModulo = [...modulos.entries()]
    .map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { totalAtivos: residentes.length, porGrau, porModulo };
}

// ---------------------------------------------------------------------------
// BLOCO OPERACIONAL — Aderência da equipe ao plano de cuidado (hoje).
//
// % das tarefas do plano (com horário definido) que foram registradas no
// prazo hoje. Compara plano_cuidado_item (o que deveria ser feito) com
// tarefa_registro do dia (o que foi feito), pela regra de tolerância do item.
// ---------------------------------------------------------------------------

export interface AderenciaHoje {
  /** Itens do plano com horário definido (denominador). */
  totalComPrazo: number;
  /** Registrados dentro de horário + tolerância. */
  noPrazo: number;
  /** Registrados com atraso (após a tolerância). */
  atrasados: number;
  /** Ainda sem registro hoje. */
  pendentes: number;
  /** % no prazo, ou null quando não há itens com horário (→ "sem dados"). */
  pct: number | null;
}

/** Minutos desde a meia-noite local de um timestamp ISO. */
function minutosDoDia(ts: string): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Calcula a aderência a partir do plano ativo e dos registros de hoje (pura). */
export function calcularAderencia(
  itens: PlanoCuidadoItem[],
  registros: TarefaRegistro[],
): AderenciaHoje {
  // Registros "feito" agrupados por residente|tarefa, guardando o mais cedo.
  const maisCedo = new Map<string, number>();
  for (const r of registros) {
    if (r.status !== "feito") continue;
    const chave = `${r.residente_id}|${r.tarefa}`;
    const m = minutosDoDia(r.feito_em);
    const atual = maisCedo.get(chave);
    if (atual === undefined || m < atual) maisCedo.set(chave, m);
  }

  let noPrazo = 0;
  let atrasados = 0;
  let pendentes = 0;
  let totalComPrazo = 0;
  for (const it of itens) {
    const alvo = horarioParaMinutos(it.horario);
    if (alvo === null) continue; // sem horário não entra na aderência
    totalComPrazo += 1;
    const feito = maisCedo.get(`${it.residente_id}|${it.tarefa}`);
    if (feito === undefined) pendentes += 1;
    else if (feito <= alvo + it.tolerancia_minutos) noPrazo += 1;
    else atrasados += 1;
  }

  const pct = totalComPrazo === 0 ? null : Math.round((noPrazo / totalComPrazo) * 100);
  return { totalComPrazo, noPrazo, atrasados, pendentes, pct };
}

/** Busca o plano ativo (todos) e os registros de hoje para calcular aderência. */
export function useAderenciaHoje() {
  return useQuery({
    queryKey: ["master-aderencia", hojeISO()],
    queryFn: async (): Promise<{ itens: PlanoCuidadoItem[]; registros: TarefaRegistro[] }> => {
      const planoResp = await supabase
        .from("plano_cuidado_item")
        .select("*")
        .eq("ativa", true);
      if (planoResp.error) throw planoResp.error;
      const regResp = await supabase
        .from("tarefa_registro")
        .select("*")
        .eq("data", hojeISO());
      if (regResp.error) throw regResp.error;
      return { itens: planoResp.data ?? [], registros: regResp.data ?? [] };
    },
  });
}

// ---------------------------------------------------------------------------
// BLOCO CLÍNICO — Hóspedes em risco: baixa aceitação alimentar recente.
//
// A aceitação alimentar é registrada pelo Cuidador em tarefa_registro com a
// tarefa "Aceitação <refeição>: <nível>" (níveis: Nada/Pouco/Metade/Quase
// tudo/Tudo). "Em risco" = 2+ refeições "Nada"/"Pouco" nos últimos 3 dias.
// ---------------------------------------------------------------------------

export interface RiscoAlimentar {
  residenteId: string;
  /** Quantidade de refeições "Nada"/"Pouco" no período. */
  baixas: number;
}

export interface AceitacaoRecente {
  /** Houve ALGUM registro de aceitação no período? (distingue risco de "sem dados") */
  comDados: boolean;
  /** Residentes com 2+ refeições de baixa aceitação. */
  riscos: RiscoAlimentar[];
}

/** Refeições com baixa aceitação (Nada/Pouco) nos últimos 3 dias, por residente. */
export function useAceitacaoBaixaRecente() {
  return useQuery({
    queryKey: ["master-aceitacao", hojeISO()],
    queryFn: async (): Promise<AceitacaoRecente> => {
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - 2); // hoje + 2 dias anteriores = janela de 3 dias
      const { data, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .like("tarefa", "Aceitação %")
        .gte("data", dataISO(inicio));
      if (error) throw error;
      const regs = data ?? [];
      const contagem = new Map<string, number>();
      for (const r of regs) {
        if (/:\s*(Nada|Pouco)\s*$/.test(r.tarefa)) {
          contagem.set(r.residente_id, (contagem.get(r.residente_id) ?? 0) + 1);
        }
      }
      const riscos = [...contagem.entries()]
        .filter(([, n]) => n >= 2)
        .map(([residenteId, baixas]) => ({ residenteId, baixas }))
        .sort((a, b) => b.baixas - a.baixas);
      return { comDados: regs.length > 0, riscos };
    },
  });
}
