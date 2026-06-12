import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { tarefaVencida, ETAPA_ADMISSAO } from "@/lib/crm";
import type {
  CrmContato,
  CrmEtapa,
  CrmMotivoPerda,
  CrmOportunidade,
  CrmOrigem,
  CrmTarefa,
  CrmEvento,
} from "@/types/database";

// ===========================================================================
// Hooks do CRM comercial. RLS no banco já restringe a Administração/Master;
// estes hooks assumem que a tela só é exposta a esses perfis.
// ===========================================================================

const KEY = {
  etapas: ["crm-etapas"],
  origens: ["crm-origens"],
  motivos: ["crm-motivos"],
  contatos: ["crm-contatos"],
  oportunidades: ["crm-oportunidades"],
};

function invalidarPipeline(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY.oportunidades });
}

/** Grava um evento na timeline da oportunidade (best-effort). */
export async function registrarEventoCrm(
  oportunidadeId: string,
  tipo: string,
  descricao: string,
): Promise<void> {
  const { error } = await supabase.from("crm_evento").insert({
    oportunidade_id: oportunidadeId,
    tipo,
    descricao,
    autor: usuarioAtual.nome,
  });
  if (error) console.error("Falha ao registrar evento CRM:", error.message);
}

// ─── Catálogos ──────────────────────────────────────────────────────────────

/** Etapas ATIVAS do funil, em ordem. */
export function useCrmEtapas() {
  return useQuery({
    queryKey: KEY.etapas,
    queryFn: async (): Promise<CrmEtapa[]> => {
      const { data, error } = await supabase
        .from("crm_etapa")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCrmOrigens(incluirInativas = false) {
  return useQuery({
    queryKey: [...KEY.origens, incluirInativas],
    queryFn: async (): Promise<CrmOrigem[]> => {
      let q = supabase.from("crm_origem").select("*").order("nome");
      if (!incluirInativas) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCrmContatos() {
  return useQuery({
    queryKey: KEY.contatos,
    queryFn: async (): Promise<CrmContato[]> => {
      const { data, error } = await supabase
        .from("crm_contato")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Oportunidades (cartões do pipeline) ──────────────────────────────────────

export type OportunidadeCard = CrmOportunidade & {
  contato: CrmContato | null;
  origemNome: string | null;
  temTarefaVencida: boolean;
};

/**
 * Carrega oportunidades + contatos + origens + tarefas pendentes e monta os
 * cartões enriquecidos do pipeline (join no cliente para tipos previsíveis).
 */
export function useOportunidades() {
  return useQuery({
    queryKey: KEY.oportunidades,
    queryFn: async (): Promise<OportunidadeCard[]> => {
      const [ops, contatos, origens, tarefas] = await Promise.all([
        supabase.from("crm_oportunidade").select("*").order("criado_em", { ascending: false }),
        supabase.from("crm_contato").select("*"),
        supabase.from("crm_origem").select("id, nome"),
        supabase.from("crm_tarefa").select("oportunidade_id, data, concluida").eq("concluida", false),
      ]);
      if (ops.error) throw ops.error;
      if (contatos.error) throw contatos.error;
      if (origens.error) throw origens.error;
      if (tarefas.error) throw tarefas.error;

      const contatoPorId = new Map((contatos.data ?? []).map((c) => [c.id, c]));
      const origemPorId = new Map((origens.data ?? []).map((o) => [o.id, o.nome]));
      const vencidaPorOp = new Set(
        (tarefas.data ?? []).filter((t) => tarefaVencida(t)).map((t) => t.oportunidade_id),
      );

      return (ops.data ?? []).map((o) => ({
        ...o,
        contato: contatoPorId.get(o.contato_id) ?? null,
        origemNome: o.origem_id ? origemPorId.get(o.origem_id) ?? null : null,
        temTarefaVencida: vencidaPorOp.has(o.id),
      }));
    },
  });
}

/** Uma oportunidade + o contato vinculado (para a tela de detalhe). */
export function useOportunidade(id: string | undefined) {
  return useQuery({
    queryKey: ["crm-oportunidade", id],
    enabled: !!id,
    queryFn: async (): Promise<{ oportunidade: CrmOportunidade; contato: CrmContato | null } | null> => {
      const { data: op, error } = await supabase
        .from("crm_oportunidade")
        .select("*")
        .eq("id", id as string)
        .maybeSingle();
      if (error) throw error;
      if (!op) return null;
      const { data: contato } = await supabase
        .from("crm_contato")
        .select("*")
        .eq("id", op.contato_id)
        .maybeSingle();
      return { oportunidade: op, contato: contato ?? null };
    },
  });
}

// ─── Criação / movimentação ───────────────────────────────────────────────────

export type NovoContatoInput = {
  nome: string;
  telefone: string | null;
  relacao: string | null;
  nomeIdoso: string | null;
  idadeIdoso: number | null;
  grauEstimado: "I" | "II" | "III" | null;
};

export type NovaOportunidadeInput = {
  /** Contato existente; se ausente, cria a partir de `novoContato`. */
  contatoId: string | null;
  novoContato: NovoContatoInput | null;
  nome: string | null; // nome da oportunidade (auto se vazio)
  origemId: string | null;
  qualificacao: number;
  valorMensalidade: number | null;
  tipoSuiteInteresse: string | null;
  etapa: string;
};

export function useCriarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaOportunidadeInput): Promise<string> => {
      let contatoId = input.contatoId;
      let nomeContato = "";
      let nomeIdoso: string | null = null;

      if (!contatoId && input.novoContato) {
        const nc = input.novoContato;
        const { data, error } = await supabase
          .from("crm_contato")
          .insert({
            nome: nc.nome.trim(),
            telefones: nc.telefone ? [nc.telefone] : [],
            relacao: nc.relacao,
            nome_idoso: nc.nomeIdoso,
            idade_idoso: nc.idadeIdoso,
            grau_estimado: nc.grauEstimado,
          })
          .select("id, nome, nome_idoso")
          .single();
        if (error) throw error;
        contatoId = data.id;
        nomeContato = data.nome;
        nomeIdoso = data.nome_idoso;
      } else if (contatoId) {
        const { data } = await supabase
          .from("crm_contato")
          .select("nome, nome_idoso")
          .eq("id", contatoId)
          .maybeSingle();
        nomeContato = data?.nome ?? "";
        nomeIdoso = data?.nome_idoso ?? null;
      }
      if (!contatoId) throw new Error("Informe um contato (existente ou novo).");

      const nomeOp =
        input.nome?.trim() ||
        [nomeContato, nomeIdoso].filter(Boolean).join(" — ") ||
        "Nova oportunidade";

      const { data: op, error: errOp } = await supabase
        .from("crm_oportunidade")
        .insert({
          nome: nomeOp,
          contato_id: contatoId,
          origem_id: input.origemId,
          qualificacao: input.qualificacao,
          valor_mensalidade_estimado: input.valorMensalidade,
          tipo_suite_interesse: input.tipoSuiteInteresse,
          etapa: input.etapa,
          status: "nova",
          responsavel: usuarioAtual.nome,
        })
        .select("id")
        .single();
      if (errOp) throw errOp;

      await registrarEventoCrm(op.id, "criacao", `Oportunidade criada na etapa "${input.etapa}".`);
      return op.id;
    },
    onSuccess: () => {
      invalidarPipeline(qc);
      qc.invalidateQueries({ queryKey: KEY.contatos });
    },
  });
}

/** Move a oportunidade para outra etapa (drag-and-drop). Gera evento. */
export function useMoverEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; etapa: string; etapaAnterior: string }) => {
      if (args.etapa === args.etapaAnterior) return;
      const { error } = await supabase
        .from("crm_oportunidade")
        .update({ etapa: args.etapa, status: "em_andamento" })
        .eq("id", args.id)
        .in("status", ["nova", "em_andamento", "pausada"]); // não mexe em ganha/perdida
      if (error) throw error;
      await registrarEventoCrm(
        args.id,
        "mudanca_etapa",
        `Etapa alterada de "${args.etapaAnterior}" para "${args.etapa}".`,
      );
    },
    onSuccess: () => invalidarPipeline(qc),
  });
}

export function useCrmMotivos(incluirInativos = false) {
  return useQuery({
    queryKey: [...KEY.motivos, incluirInativos],
    queryFn: async (): Promise<CrmMotivoPerda[]> => {
      let q = supabase.from("crm_motivo_perda").select("*").order("nome");
      if (!incluirInativos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Timeline (eventos) ───────────────────────────────────────────────────────

export function useEventos(oportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-eventos", oportunidadeId],
    enabled: !!oportunidadeId,
    queryFn: async (): Promise<CrmEvento[]> => {
      const { data, error } = await supabase
        .from("crm_evento")
        .select("*")
        .eq("oportunidade_id", oportunidadeId as string)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Anotação livre na timeline (evento tipo "anotacao"). */
export function useAnotar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { oportunidadeId: string; texto: string }) => {
      await registrarEventoCrm(args.oportunidadeId, "anotacao", args.texto.trim());
    },
    onSuccess: (_r, args) =>
      qc.invalidateQueries({ queryKey: ["crm-eventos", args.oportunidadeId] }),
  });
}

// ─── Tarefas ──────────────────────────────────────────────────────────────────

export function useTarefasOportunidade(oportunidadeId: string | undefined) {
  return useQuery({
    queryKey: ["crm-tarefas", oportunidadeId],
    enabled: !!oportunidadeId,
    queryFn: async (): Promise<CrmTarefa[]> => {
      const { data, error } = await supabase
        .from("crm_tarefa")
        .select("*")
        .eq("oportunidade_id", oportunidadeId as string)
        .order("data", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type TarefaComOportunidade = CrmTarefa & { oportunidadeNome: string };

/** Todas as tarefas do CRM (tela global), com o nome da oportunidade. */
export function useTodasTarefas() {
  return useQuery({
    queryKey: ["crm-tarefas-todas"],
    queryFn: async (): Promise<TarefaComOportunidade[]> => {
      const [tarefas, ops] = await Promise.all([
        supabase.from("crm_tarefa").select("*"),
        supabase.from("crm_oportunidade").select("id, nome"),
      ]);
      if (tarefas.error) throw tarefas.error;
      if (ops.error) throw ops.error;
      const nomePorOp = new Map((ops.data ?? []).map((o) => [o.id, o.nome]));
      return (tarefas.data ?? []).map((t) => ({
        ...t,
        oportunidadeNome: nomePorOp.get(t.oportunidade_id) ?? "—",
      }));
    },
  });
}

export type NovaTarefaInput = {
  oportunidadeId: string;
  tipo: string;
  assunto: string;
  descricao: string | null;
  responsavel: string | null;
  data: string | null;
  hora: string | null;
};

export function useCriarTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaTarefaInput) => {
      const { error } = await supabase.from("crm_tarefa").insert({
        oportunidade_id: input.oportunidadeId,
        tipo: input.tipo,
        assunto: input.assunto.trim(),
        descricao: input.descricao,
        responsavel: input.responsavel ?? usuarioAtual.nome,
        data: input.data,
        hora: input.hora,
      });
      if (error) throw error;
    },
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ["crm-tarefas", input.oportunidadeId] });
      qc.invalidateQueries({ queryKey: ["crm-tarefas-todas"] });
      invalidarPipeline(qc);
    },
  });
}

/** Conclui uma tarefa em 1 clique e registra evento na timeline. */
export function useConcluirTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Pick<CrmTarefa, "id" | "oportunidade_id" | "assunto">) => {
      const { error } = await supabase
        .from("crm_tarefa")
        .update({ concluida: true })
        .eq("id", t.id);
      if (error) throw error;
      await registrarEventoCrm(t.oportunidade_id, "tarefa_concluida", `Tarefa concluída: ${t.assunto}.`);
    },
    onSuccess: (_r, t) => {
      qc.invalidateQueries({ queryKey: ["crm-tarefas", t.oportunidade_id] });
      qc.invalidateQueries({ queryKey: ["crm-tarefas-todas"] });
      qc.invalidateQueries({ queryKey: ["crm-eventos", t.oportunidade_id] });
      invalidarPipeline(qc);
    },
  });
}

// ─── Perda / Admissão (status terminais) ──────────────────────────────────────

function invalidarOportunidade(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["crm-oportunidade", id] });
  qc.invalidateQueries({ queryKey: ["crm-eventos", id] });
  invalidarPipeline(qc);
}

export function useMarcarPerda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("crm_oportunidade")
        .update({ status: "perdida", motivo_perda: args.motivo, fechado_em: new Date().toISOString() })
        .eq("id", args.id);
      if (error) throw error;
      await registrarEventoCrm(args.id, "perda", `Oportunidade perdida — motivo: ${args.motivo}.`);
    },
    onSuccess: (_r, args) => invalidarOportunidade(qc, args.id),
  });
}

/**
 * Marca ADMISSÃO: status "ganha", etapa "Admissão", fechado_em. O vínculo com
 * o cadastro de residente (residente_id) é gravado pelo fluxo de criação de
 * residente (Bloco 4) — aqui só fecha a oportunidade como ganha.
 */
export function useMarcarAdmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string }) => {
      const { error } = await supabase
        .from("crm_oportunidade")
        .update({ status: "ganha", etapa: ETAPA_ADMISSAO, fechado_em: new Date().toISOString() })
        .eq("id", args.id);
      if (error) throw error;
      await registrarEventoCrm(args.id, "admissao", "Oportunidade marcada como ADMISSÃO (ganha).");
    },
    onSuccess: (_r, args) => invalidarOportunidade(qc, args.id),
  });
}

/** Vincula a oportunidade ao residente criado (rastreabilidade lead→hóspede). */
export function useVincularResidente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string }) => {
      const { error } = await supabase
        .from("crm_oportunidade")
        .update({ residente_id: args.residenteId })
        .eq("id", args.id);
      if (error) throw error;
      await registrarEventoCrm(args.id, "admissao", "Cadastro de residente criado a partir desta oportunidade.");
    },
    onSuccess: (_r, args) => invalidarOportunidade(qc, args.id),
  });
}

// ─── Contatos (CRUD + oportunidades vinculadas) ──────────────────────────────

export type ContatoComOportunidades = CrmContato & {
  oportunidades: { id: string; nome: string }[];
};

export function useContatosCrm() {
  return useQuery({
    queryKey: ["crm-contatos-full"],
    queryFn: async (): Promise<ContatoComOportunidades[]> => {
      const [contatos, ops] = await Promise.all([
        supabase.from("crm_contato").select("*").order("nome"),
        supabase.from("crm_oportunidade").select("id, nome, contato_id"),
      ]);
      if (contatos.error) throw contatos.error;
      if (ops.error) throw ops.error;
      const porContato = new Map<string, { id: string; nome: string }[]>();
      for (const o of ops.data ?? []) {
        const arr = porContato.get(o.contato_id) ?? [];
        arr.push({ id: o.id, nome: o.nome });
        porContato.set(o.contato_id, arr);
      }
      return (contatos.data ?? []).map((c) => ({ ...c, oportunidades: porContato.get(c.id) ?? [] }));
    },
  });
}

export type SalvarContatoInput = {
  id?: string;
  nome: string;
  telefones: string[];
  emails: string[];
  relacao: string | null;
  nomeIdoso: string | null;
  idadeIdoso: number | null;
  grauEstimado: "I" | "II" | "III" | null;
  baseLegal: "consentimento" | "legitimo_interesse" | "nao_definida";
  observacoes: string | null;
};

export function useSalvarContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: SalvarContatoInput) => {
      const row = {
        nome: v.nome.trim(),
        telefones: v.telefones,
        emails: v.emails,
        relacao: v.relacao,
        nome_idoso: v.nomeIdoso,
        idade_idoso: v.idadeIdoso,
        grau_estimado: v.grauEstimado,
        base_legal_lgpd: v.baseLegal,
        observacoes: v.observacoes,
      };
      if (v.id) {
        const { error } = await supabase.from("crm_contato").update(row).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_contato").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contatos-full"] });
      qc.invalidateQueries({ queryKey: KEY.contatos });
      invalidarPipeline(qc);
    },
  });
}

// ─── Origens (CRUD) ───────────────────────────────────────────────────────────

export function useCrmOrigensTodas() {
  return useQuery({
    queryKey: [...KEY.origens, "todas"],
    queryFn: async (): Promise<CrmOrigem[]> => {
      const { data, error } = await supabase.from("crm_origem").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarOrigem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; nome: string; tipo: string | null; ativo?: boolean }) => {
      if (v.id) {
        const { error } = await supabase.from("crm_origem").update({ nome: v.nome.trim(), tipo: v.tipo, ativo: v.ativo }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_origem").insert({ nome: v.nome.trim(), tipo: v.tipo });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.origens }),
  });
}

// ─── Configuração do funil: etapas + motivos ──────────────────────────────────

export function useCrmEtapasTodas() {
  return useQuery({
    queryKey: [...KEY.etapas, "todas"],
    queryFn: async (): Promise<CrmEtapa[]> => {
      const { data, error } = await supabase.from("crm_etapa").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; nome: string; ordem?: number; ativo?: boolean }) => {
      if (v.id) {
        const patch: { nome: string; ativo?: boolean; ordem?: number } = { nome: v.nome.trim() };
        if (v.ativo !== undefined) patch.ativo = v.ativo;
        if (v.ordem !== undefined) patch.ordem = v.ordem;
        const { error } = await supabase.from("crm_etapa").update(patch).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_etapa").insert({ nome: v.nome.trim(), ordem: v.ordem ?? 99 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY.etapas });
      invalidarPipeline(qc);
    },
  });
}

/** Troca a ordem de duas etapas (mover para cima/baixo). */
export function useReordenarEtapas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { a: { id: string; ordem: number }; b: { id: string; ordem: number } }) => {
      const { error: e1 } = await supabase.from("crm_etapa").update({ ordem: args.b.ordem }).eq("id", args.a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("crm_etapa").update({ ordem: args.a.ordem }).eq("id", args.b.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY.etapas });
      invalidarPipeline(qc);
    },
  });
}

export function useCrmMotivosTodos() {
  return useQuery({
    queryKey: [...KEY.motivos, "todos"],
    queryFn: async (): Promise<CrmMotivoPerda[]> => {
      const { data, error } = await supabase.from("crm_motivo_perda").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarMotivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; nome: string; ativo?: boolean }) => {
      if (v.id) {
        const patch: { nome: string; ativo?: boolean } = { nome: v.nome.trim() };
        if (v.ativo !== undefined) patch.ativo = v.ativo;
        const { error } = await supabase.from("crm_motivo_perda").update(patch).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_motivo_perda").insert({ nome: v.nome.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.motivos }),
  });
}

// Reexport de tipos úteis às telas.
export type { CrmEvento, CrmTarefa };
