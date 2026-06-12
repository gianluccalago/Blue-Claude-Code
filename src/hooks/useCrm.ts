import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { tarefaVencida } from "@/lib/crm";
import type {
  CrmContato,
  CrmEtapa,
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

// Reexport de tipos úteis às telas.
export type { CrmEvento, CrmTarefa };
