import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { hojeISO } from "@/lib/utils";
import {
  indicadorDaCasa,
  indicadorDoHospede,
  limparItens,
  statusDosDominios,
  type IndicadorCasa,
  type IndicadorHospede,
  type IvcfResumo,
  type StatusDominio,
} from "@/lib/autonomia";
import type {
  AutonomiaAvaliacao,
  AutonomiaObjetivo,
  AutonomiaRevisao,
  DominioAutonomia,
  MotivoAvaliacaoAutonomia,
  RespostaItemAutonomia,
  Residente,
} from "@/types/database";

// ===========================================================================
// Módulo Autonomia (0147) — leitura por hóspede e da casa, e as gravações.
// Cada perfil grava só o seu domínio (RLS); Master, todos.
// ===========================================================================

const KEY = ["autonomia"] as const;

export interface DadosAutonomiaBase {
  ativadoEm: string;
  avaliacoes: AutonomiaAvaliacao[];
  objetivos: AutonomiaObjetivo[];
  revisoes: AutonomiaRevisao[];
  ivcfsPorHospede: Map<string, IvcfResumo[]>;
  escalonamentosPorHospede: Map<string, string[]>;
}

async function carregar(residenteIds?: string[]): Promise<DadosAutonomiaBase> {
  const filtro = <T extends { in: (c: string, v: string[]) => T }>(q: T, col = "residente_id") =>
    residenteIds ? q.in(col, residenteIds) : q;
  const [modResp, avResp, objResp, ivcfResp, intResp] = await Promise.all([
    supabase.from("autonomia_modulo").select("ativado_em").maybeSingle(),
    filtro(supabase.from("autonomia_avaliacao").select("*")),
    filtro(supabase.from("autonomia_objetivo").select("*")),
    filtro(supabase.from("avaliacao_ivcf").select("residente_id, classificacao, registrado_em")),
    filtro(supabase.from("intercorrencia").select("id, residente_id").gte("registrado_em", new Date(Date.now() - 400 * 864e5).toISOString())),
  ]);
  for (const r of [avResp, objResp, ivcfResp, intResp]) if (r.error) throw r.error;
  const objetivos = (objResp.data ?? []) as AutonomiaObjetivo[];

  const idsObj = objetivos.map((o) => o.id);
  const revResp = idsObj.length
    ? await supabase.from("autonomia_revisao").select("*").in("objetivo_id", idsObj).order("revisado_em", { ascending: false })
    : { data: [], error: null };
  if (revResp.error) throw revResp.error;

  // Intercorrências escaladas ao médico → data do escalonamento por hóspede.
  const intercorrencias = (intResp.data ?? []) as { id: string; residente_id: string }[];
  const resDaInt = new Map(intercorrencias.map((i) => [i.id, i.residente_id]));
  const escalonamentosPorHospede = new Map<string, string[]>();
  if (intercorrencias.length) {
    const escResp = await supabase
      .from("pendencia_tratamento")
      .select("referencia_id, tratado_em")
      .eq("tipo_origem", "intercorrencia")
      .eq("acao", "escalado_medico")
      .in("referencia_id", intercorrencias.map((i) => i.id));
    if (escResp.error) throw escResp.error;
    for (const e of escResp.data ?? []) {
      const res = resDaInt.get(e.referencia_id);
      if (!res) continue;
      const l = escalonamentosPorHospede.get(res) ?? [];
      l.push(String(e.tratado_em).slice(0, 10));
      escalonamentosPorHospede.set(res, l);
    }
  }

  const ivcfsPorHospede = new Map<string, IvcfResumo[]>();
  for (const i of (ivcfResp.data ?? []) as { residente_id: string; classificacao: string; registrado_em: string }[]) {
    const l = ivcfsPorHospede.get(i.residente_id) ?? [];
    l.push({ classificacao: i.classificacao, registrado_em: i.registrado_em });
    ivcfsPorHospede.set(i.residente_id, l);
  }

  return {
    ativadoEm: (modResp.data?.ativado_em as string | undefined) ?? hojeISO(),
    avaliacoes: (avResp.data ?? []) as AutonomiaAvaliacao[],
    objetivos,
    revisoes: (revResp.data ?? []) as AutonomiaRevisao[],
    ivcfsPorHospede,
    escalonamentosPorHospede,
  };
}

export interface AutonomiaHospede {
  status: StatusDominio[];
  avaliacoes: AutonomiaAvaliacao[];
  objetivos: AutonomiaObjetivo[];
  revisoes: AutonomiaRevisao[];
  indicador: IndicadorHospede;
}

function montarHospede(r: Pick<Residente, "id" | "data_admissao">, base: DadosAutonomiaBase, hoje: string): AutonomiaHospede {
  const avaliacoes = base.avaliacoes.filter((a) => a.residente_id === r.id);
  const objetivos = base.objetivos.filter((o) => o.residente_id === r.id);
  const idsObj = new Set(objetivos.map((o) => o.id));
  const revisoes = base.revisoes.filter((v) => idsObj.has(v.objetivo_id));
  const status = statusDosDominios({
    avaliacoes,
    dataAdmissao: r.data_admissao,
    ativadoEm: base.ativadoEm,
    ivcfs: base.ivcfsPorHospede.get(r.id) ?? [],
    escalonamentos: base.escalonamentosPorHospede.get(r.id) ?? [],
    hoje,
  });
  return {
    status,
    avaliacoes,
    objetivos,
    revisoes,
    indicador: indicadorDoHospede({ residenteId: r.id, status, objetivos, revisoes, hoje }),
  };
}

/** Tudo de autonomia de UM hóspede (tela do módulo, ficha, cuidadora). */
export function useAutonomiaHospede(residente: Pick<Residente, "id" | "data_admissao"> | undefined) {
  return useQuery({
    queryKey: [...KEY, "hospede", residente?.id, residente?.data_admissao ?? null],
    enabled: !!residente,
    queryFn: async (): Promise<AutonomiaHospede> => montarHospede(residente!, await carregar([residente!.id]), hojeISO()),
  });
}

export interface HospedeAutonomiaCasa extends AutonomiaHospede {
  residente: Pick<Residente, "id" | "nome" | "quarto" | "data_admissao">;
}

export interface AutonomiaCasa {
  hospedes: HospedeAutonomiaCasa[];
  indicador: IndicadorCasa;
}

/** Todos os hóspedes ativos: pendências por domínio e indicador da casa. */
export function useAutonomiaCasa(enabled = true) {
  return useQuery({
    queryKey: [...KEY, "casa"],
    enabled,
    queryFn: async (): Promise<AutonomiaCasa> => {
      const resResp = await supabase
        .from("residentes")
        .select("id, nome, quarto, data_admissao")
        .eq("status_hospede", "ativo");
      if (resResp.error) throw resResp.error;
      const residentes = (resResp.data ?? []) as HospedeAutonomiaCasa["residente"][];
      const base = await carregar();
      const hoje = hojeISO();
      const hospedes = residentes
        .map((r) => ({ residente: r, ...montarHospede(r, base, hoje) }))
        .sort((a, b) => a.residente.nome.localeCompare(b.residente.nome, "pt-BR"));
      return { hospedes, indicador: indicadorDaCasa(hospedes.map((h) => h.indicador)) };
    },
  });
}

// ─── Gravações ────────────────────────────────────────────────────────────────

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["plano-itens"] });
}

/** Salva (cria ou atualiza) o rascunho do domínio; `assinar` fecha a avaliação. */
export function useSalvarAvaliacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      rascunhoId: string | null;
      residenteId: string;
      dominio: DominioAutonomia;
      motivo: MotivoAvaliacaoAutonomia;
      itens: Record<string, RespostaItemAutonomia>;
      sintese: string;
      assinar: boolean;
    }): Promise<void> => {
      const itens = limparItens(v.itens);
      if (v.assinar && Object.keys(itens).length === 0) throw new Error("Preencha ao menos um item antes de assinar.");
      const campos = {
        motivo: v.motivo,
        itens,
        sintese: v.sintese.trim() || null,
        assinada: v.assinar,
        registrado_por: usuarioAtual.nome,
        ...(v.assinar ? { assinada_por: usuarioAtual.nome } : {}),
      };
      const { error } = v.rascunhoId
        ? await supabase.from("autonomia_avaliacao").update(campos).eq("id", v.rascunhoId)
        : await supabase.from("autonomia_avaliacao").insert({ residente_id: v.residenteId, dominio: v.dominio, ...campos });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useDescartarRascunho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("autonomia_avaliacao").delete().eq("id", id).eq("assinada", false);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useCriarObjetivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      residenteId: string;
      dominio: DominioAutonomia;
      avaliacaoId: string | null;
      descricao: string;
      meta: string;
      responsavel: string;
      prazoRevisao: string;
      acordadoResidente: boolean;
      acordadoFamilia: boolean;
    }) => {
      if (!v.descricao.trim()) throw new Error("Descreva o objetivo.");
      if (!v.meta.trim()) throw new Error("Informe a meta observável.");
      const hoje = hojeISO();
      const { error } = await supabase.from("autonomia_objetivo").insert({
        residente_id: v.residenteId,
        dominio: v.dominio,
        avaliacao_id: v.avaliacaoId,
        descricao: v.descricao.trim(),
        meta: v.meta.trim(),
        responsavel: v.responsavel.trim() || null,
        prazo_revisao: v.prazoRevisao,
        acordado_residente_em: v.acordadoResidente ? hoje : null,
        acordado_familia_em: v.acordadoFamilia ? hoje : null,
        criado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Revisão do objetivo: observado + fala do residente + resultado (o banco atualiza o objetivo). */
export function useRevisarObjetivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      objetivoId: string;
      observado: string;
      falaResidente: string;
      resultado: AutonomiaRevisao["resultado"];
      participantes: AutonomiaRevisao["participantes"];
      proximaRevisao: string | null;
    }) => {
      if (!v.observado.trim()) throw new Error("Registre o que foi observado.");
      if (!v.falaResidente.trim()) throw new Error("Registre o que o residente disse.");
      if (v.participantes.length === 0) throw new Error("Marque quem participou da revisão.");
      const { error } = await supabase.from("autonomia_revisao").insert({
        objetivo_id: v.objetivoId,
        observado: v.observado.trim(),
        fala_residente: v.falaResidente.trim(),
        resultado: v.resultado,
        participantes: v.participantes,
        proxima_revisao: v.proximaRevisao,
        revisado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
