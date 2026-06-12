import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type {
  AvaliacaoIVCF,
  EliminacaoTratamento,
  Evolucao,
  GrauDependencia,
  Intercorrencia,
  PendenciaTratamento,
  Prescricao,
  PeriodoMedicacao,
  Residente,
  ViaMedicacao,
} from "@/types/database";

export type GrupoPrescricao = {
  grupoPrescricao: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string | null;
  linhas: Prescricao[];
};

export type MedicamentoConhecido = {
  medicamento: string;
  /** Via e dose mais comuns para esse medicamento na casa. */
  via: ViaMedicacao;
  dose: string | null;
};

/**
 * Catálogo de medicamentos já usados na casa (distinct de `prescricao`), com a
 * via/dose mais frequente — alimenta o autocomplete da prescrição.
 */
export function useMedicamentosDaCasa() {
  return useQuery({
    queryKey: ["medicamentos-da-casa"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MedicamentoConhecido[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("medicamento, via, dose");
      if (error) throw error;
      // Agrupa por nome do medicamento (case-insensitive) e escolhe via/dose
      // mais frequentes.
      const mapa = new Map<
        string,
        { medicamento: string; vias: Map<string, number>; doses: Map<string, number> }
      >();
      for (const p of data ?? []) {
        const nome = (p.medicamento ?? "").trim();
        if (!nome) continue;
        const chave = nome.toUpperCase();
        const reg = mapa.get(chave) ?? { medicamento: nome, vias: new Map(), doses: new Map() };
        reg.vias.set(p.via, (reg.vias.get(p.via) ?? 0) + 1);
        if (p.dose) reg.doses.set(p.dose, (reg.doses.get(p.dose) ?? 0) + 1);
        mapa.set(chave, reg);
      }
      const maisFrequente = <T,>(m: Map<T, number>): T | null => {
        let melhor: T | null = null;
        let max = 0;
        for (const [k, n] of m) if (n > max) { max = n; melhor = k; }
        return melhor;
      };
      return [...mapa.values()]
        .map((r) => ({
          medicamento: r.medicamento,
          via: (maisFrequente(r.vias) ?? "oral") as ViaMedicacao,
          dose: maisFrequente(r.doses),
        }))
        .sort((a, b) => a.medicamento.localeCompare(b.medicamento, "pt-BR"));
    },
  });
}

/**
 * Busca as prescrições ativas de um residente e as agrupa por grupo_prescricao.
 * Função pura (sem hook) para poder ser chamada em lote (ex.: emissão de
 * receitas da Farmácia) reutilizando exatamente o mesmo agrupamento do Médico.
 */
export async function fetchPrescricoesAtivasAgrupadas(
  residenteId: string,
): Promise<GrupoPrescricao[]> {
  const { data, error } = await supabase
    .from("prescricao")
    .select("*")
    .eq("residente_id", residenteId)
    .eq("ativa", true)
    .order("medicamento");
  if (error) throw error;

  const linhas: Prescricao[] = data ?? [];
  const mapaGrupo = new Map<string, GrupoPrescricao>();

  for (const l of linhas) {
    const chave = l.grupo_prescricao ?? l.id;
    if (!mapaGrupo.has(chave)) {
      mapaGrupo.set(chave, {
        grupoPrescricao: chave,
        medicamento: l.medicamento,
        dose: l.dose,
        via: l.via,
        posologia: l.posologia,
        linhas: [],
      });
    }
    mapaGrupo.get(chave)!.linhas.push(l);
  }

  return Array.from(mapaGrupo.values());
}

/** Todas as prescrições ativas do residente, agrupadas por grupo_prescricao. */
export function usePrescricoesAtivas(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes-medico", residenteId],
    enabled: !!residenteId,
    queryFn: () => fetchPrescricoesAtivasAgrupadas(residenteId!),
  });
}

type PeriodoQuantidade = { periodo: PeriodoMedicacao; quantidade: string };

type NovaPrescricaoArgs = {
  residenteId: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string;
  periodos: PeriodoQuantidade[];
};

export function useCriarPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: NovaPrescricaoArgs) => {
      const grupoPrescricao = crypto.randomUUID();
      const medicamento = args.medicamento.trim().toUpperCase();
      const linhas = args.periodos.map((p) => ({
        residente_id: args.residenteId,
        medicamento,
        dose: args.dose,
        via: args.via,
        posologia: args.posologia,
        periodo: p.periodo,
        quantidade: p.quantidade,
        grupo_prescricao: grupoPrescricao,
        ativa: true,
      }));
      const { error } = await supabase.from("prescricao").insert(linhas);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}

type EditarPrescricaoArgs = {
  residenteId: string;
  grupoPrescricao: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string;
  periodos: PeriodoQuantidade[];
};

/** Edita um grupo: suspende as linhas antigas e cria novas com o mesmo grupo_prescricao. */
export function useEditarPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: EditarPrescricaoArgs) => {
      const { error: suspErr } = await supabase
        .from("prescricao")
        .update({ ativa: false })
        .eq("grupo_prescricao", args.grupoPrescricao);
      if (suspErr) throw suspErr;

      const medicamento = args.medicamento.trim().toUpperCase();
      const linhas = args.periodos.map((p) => ({
        residente_id: args.residenteId,
        medicamento,
        dose: args.dose,
        via: args.via,
        posologia: args.posologia,
        periodo: p.periodo,
        quantidade: p.quantidade,
        grupo_prescricao: args.grupoPrescricao,
        ativa: true,
      }));
      const { error } = await supabase.from("prescricao").insert(linhas);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}

/** Suspende todas as linhas do grupo (ativa=false). */
export function useSuspenderPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; grupoPrescricao: string }) => {
      const { error } = await supabase
        .from("prescricao")
        .update({ ativa: false })
        .eq("grupo_prescricao", args.grupoPrescricao);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}

// ─── Painel de escalados ──────────────────────────────────────────────────────

export type ItemEscaladoIntercorrencia = {
  intercorrencia: Intercorrencia;
  residente: Residente;
  /** Instante do escalamento mais recente (pendencia_tratamento.tratado_em). */
  escaladoEm: string;
};

export type ItemEscaladoEliminacao = {
  /** O registro eliminacao_tratamento com acao="escalado_medico" que originou o item. */
  escalacao: EliminacaoTratamento;
  residente: Residente;
};

/**
 * Busca todos os itens que foram escalados ao médico e ainda não resolvidos.
 * Para intercorrências: pendencia_tratamento acao=escalado_medico, sem resolucao_medica correspondente.
 * Para eliminação: eliminacao_tratamento acao=escalado_medico (mais recente por residente+tipo), sem resolucao.
 */
export function useEscaladosMedico() {
  return useQuery({
    queryKey: ["medico-escalados"],
    queryFn: async (): Promise<{
      intercEscalados: ItemEscaladoIntercorrencia[];
      elimEscalados: ItemEscaladoEliminacao[];
    }> => {
      // Busca em paralelo: escalamentos + resoluções + residentes.
      const [pendRes, elimTratRes, resolRes, residentesRes] = await Promise.all([
        supabase
          .from("pendencia_tratamento")
          .select("*")
          .eq("acao", "escalado_medico")
          .eq("tipo_origem", "intercorrencia")
          .order("tratado_em", { ascending: false }),
        supabase
          .from("eliminacao_tratamento")
          .select("*")
          .eq("acao", "escalado_medico")
          .order("tratado_em", { ascending: false }),
        supabase.from("resolucao_medica").select("*"),
        supabase.from("residentes").select("*"),
      ]);

      if (pendRes.error) throw pendRes.error;
      if (elimTratRes.error) throw elimTratRes.error;
      if (resolRes.error) throw resolRes.error;
      if (residentesRes.error) throw residentesRes.error;

      const pendencias: PendenciaTratamento[] = pendRes.data ?? [];
      const elimEscalados: EliminacaoTratamento[] = elimTratRes.data ?? [];
      const resolucoes = resolRes.data ?? [];
      const residenteMap = new Map<string, Residente>(
        (residentesRes.data ?? []).map((r) => [r.id, r]),
      );

      // IDs de intercorrências já resolvidas pelo médico.
      const resolvidosInter = new Set(
        resolucoes
          .filter((r) => r.tipo_origem === "intercorrencia")
          .map((r) => r.referencia_id),
      );

      // IDs de eliminacao_tratamento já resolvidos.
      const resolvidosElim = new Set(
        resolucoes
          .filter((r) => r.tipo_origem === "eliminacao")
          .map((r) => r.referencia_id),
      );

      // Uma pendência por intercorrência (a mais recente); filtra já resolvidos.
      const escalacoesPorInter = new Map<string, PendenciaTratamento>();
      for (const p of pendencias) {
        if (!escalacoesPorInter.has(p.referencia_id)) {
          escalacoesPorInter.set(p.referencia_id, p);
        }
      }
      const intercIdsPendentes = [...escalacoesPorInter.keys()].filter(
        (id) => !resolvidosInter.has(id),
      );

      // Busca as intercorrências pendentes.
      let intercorrencias: Intercorrencia[] = [];
      if (intercIdsPendentes.length > 0) {
        const { data: iData, error: ie } = await supabase
          .from("intercorrencia")
          .select("*")
          .in("id", intercIdsPendentes);
        if (ie) throw ie;
        intercorrencias = iData ?? [];
      }

      const intercEscalados: ItemEscaladoIntercorrencia[] = intercorrencias
        .map((inter) => ({
          intercorrencia: inter,
          residente: residenteMap.get(inter.residente_id)!,
          escaladoEm: escalacoesPorInter.get(inter.id)?.tratado_em ?? "",
        }))
        .filter((x) => !!x.residente)
        .sort((a, b) => b.escaladoEm.localeCompare(a.escaladoEm));

      // Eliminação: mantém o mais recente por residente+tipo; filtra resolvidos.
      const elimMaisRecentePorChave = new Map<string, EliminacaoTratamento>();
      for (const e of elimEscalados) {
        const k = `${e.residente_id}|${e.tipo_alerta}`;
        if (!elimMaisRecentePorChave.has(k)) {
          elimMaisRecentePorChave.set(k, e);
        }
      }

      const elimPendentes: ItemEscaladoEliminacao[] = [...elimMaisRecentePorChave.values()]
        .filter((e) => !resolvidosElim.has(e.id))
        .map((e) => ({
          escalacao: e,
          residente: residenteMap.get(e.residente_id)!,
        }))
        .filter((x) => !!x.residente)
        .sort((a, b) => b.escalacao.tratado_em.localeCompare(a.escalacao.tratado_em));

      return { intercEscalados, elimEscalados: elimPendentes };
    },
  });
}

// ─── Evoluções clínicas ───────────────────────────────────────────────────────

export function useEvolucoes(residenteId: string | null) {
  return useQuery({
    queryKey: ["evolucoes", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Evolucao[]> => {
      const { data, error } = await supabase
        .from("evolucao")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCriarEvolucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ residenteId, texto }: { residenteId: string; texto: string }) => {
      const { error } = await supabase
        .from("evolucao")
        .insert({ residente_id: residenteId, texto });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["evolucoes", vars.residenteId] });
    },
  });
}

// ─── Avaliações IVCF-20 ───────────────────────────────────────────────────────

export function useAvaliacoesIVCF(residenteId: string | null) {
  return useQuery({
    queryKey: ["avaliacoes-ivcf", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<AvaliacaoIVCF[]> => {
      const { data, error } = await supabase
        .from("avaliacao_ivcf")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

type CriarAvaliacaoArgs = {
  residenteId: string;
  respostas: Record<string, unknown>;
  pontuacaoTotal: number;
  classificacao: "Grau I" | "Grau II" | "Grau III";
  dominiosAlterados: string[];
  itensIndisponiveis: string[];
};

export function useCriarAvaliacaoIVCF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarAvaliacaoArgs) => {
      const { error } = await supabase.from("avaliacao_ivcf").insert({
        residente_id: args.residenteId,
        respostas: args.respostas,
        pontuacao_total: args.pontuacaoTotal,
        classificacao: args.classificacao,
        dominios_alterados: args.dominiosAlterados,
        itens_indisponiveis: args.itensIndisponiveis,
      });
      if (error) throw error;
      // Atualiza grau_dependencia do residente com o resultado da avaliação.
      const grau = args.classificacao.replace("Grau ", "") as GrauDependencia;
      const { error: updErr } = await supabase
        .from("residentes")
        .update({ grau_dependencia: grau })
        .eq("id", args.residenteId);
      if (updErr) throw updErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["avaliacoes-ivcf", vars.residenteId] });
      qc.invalidateQueries({ queryKey: ["residentes"] });
    },
  });
}

/** Grava a resolução de um item escalado pelo médico. */
export function useRegistrarResolucaoMedica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tipoOrigem: "intercorrencia" | "eliminacao";
      referenciaId: string;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.from("resolucao_medica").insert({
        tipo_origem: args.tipoOrigem,
        referencia_id: args.referenciaId,
        observacao: args.observacao ?? null,
        resolvido_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medico-escalados"] });
      qc.invalidateQueries({ queryKey: ["resolucoes-medicas"] });
    },
  });
}
