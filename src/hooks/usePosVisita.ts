import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { registrarEventoCrm } from "@/hooks/useCrm";
import { dadosDaOportunidade, mensagemDeModelo, somarDiasISO } from "@/lib/posVisita";
import { hojeISO } from "@/lib/utils";
import type { CrmBiblioteca, CrmModeloMensagem, CrmTarefa, VisitaAgendamento } from "@/types/database";

// ===========================================================================
// CRM · Pós-visita: biblioteca de dores/objeções, modelos de mensagem,
// registro do pós-visita (RPC crm_salvar_pos_visita) e a condução das
// mensagens (enviar pelo WhatsApp, família respondeu, perdido sem retorno,
// pausar com nutrição). Cancelamentos da sequência ficam no servidor (0154).
// ===========================================================================

const KEY_BIB = ["crm-biblioteca"];
const KEY_MOD = ["crm-modelos"];

function invalidarOportunidade(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: ["crm-oportunidade", id] });
  qc.invalidateQueries({ queryKey: ["crm-eventos", id] });
  qc.invalidateQueries({ queryKey: ["crm-tarefas", id] });
  qc.invalidateQueries({ queryKey: ["crm-tarefas-todas"] });
  qc.invalidateQueries({ queryKey: ["crm-oportunidades"] });
}

export function useBiblioteca() {
  return useQuery({
    queryKey: KEY_BIB,
    queryFn: async (): Promise<CrmBiblioteca[]> => {
      const { data, error } = await supabase.from("crm_biblioteca").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useModelosMensagem() {
  return useQuery({
    queryKey: KEY_MOD,
    queryFn: async (): Promise<CrmModeloMensagem[]> => {
      const { data, error } = await supabase.from("crm_modelo_mensagem").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarBloco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Pick<CrmBiblioteca, "codigo" | "texto_whatsapp" | "conteudo_titulo" | "conteudo_link" | "ativo">) => {
      const { error } = await supabase.from("crm_biblioteca").update({
        texto_whatsapp: v.texto_whatsapp.trim(),
        conteudo_titulo: v.conteudo_titulo?.trim() || null,
        conteudo_link: v.conteudo_link?.trim() || null,
        ativo: v.ativo,
        atualizado_em: new Date().toISOString(),
      }).eq("codigo", v.codigo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_BIB }),
  });
}

export function useSalvarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Pick<CrmModeloMensagem, "codigo" | "texto" | "ativo">) => {
      const { error } = await supabase.from("crm_modelo_mensagem").update({
        texto: v.texto.trim(), ativo: v.ativo, atualizado_em: new Date().toISOString(),
      }).eq("codigo", v.codigo);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_MOD }),
  });
}

/** Visita da agenda (para abrir o pós-visita a partir dela). */
export function useVisitaAgendamento(id: string | undefined) {
  return useQuery({
    queryKey: ["visita-agendamento", id],
    enabled: !!id,
    queryFn: async (): Promise<VisitaAgendamento | null> => {
      const { data, error } = await supabase.from("visita_agendamento").select("*").eq("id", id as string).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Grava o pós-visita inteiro numa transação (cria a oportunidade se precisar). Devolve o id. */
export function useSalvarPosVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Record<string, unknown>): Promise<string> => {
      const { data, error } = await supabase.rpc("crm_salvar_pos_visita", { p });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as string;
    },
    onSuccess: (id) => {
      invalidarOportunidade(qc, id);
      qc.invalidateQueries({ queryKey: ["crm-contatos"] });
      qc.invalidateQueries({ queryKey: ["visita-agendamentos"] });
    },
  });
}

/** Mensagem enviada: guarda o texto final e marca a tarefa como feita. */
export function useMarcarEnviada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Pick<CrmTarefa, "id" | "oportunidade_id" | "assunto" | "canal"> & { mensagem: string | null }) => {
      const { error } = await supabase.from("crm_tarefa")
        .update({ concluida: true, concluida_em: new Date().toISOString(), mensagem: t.mensagem })
        .eq("id", t.id);
      if (error) throw error;
      await registrarEventoCrm(t.oportunidade_id, "mensagem_enviada",
        `${t.canal === "email" ? "E-mail" : "WhatsApp"} enviado: ${t.assunto}.`);
    },
    onSuccess: (_r, t) => invalidarOportunidade(qc, t.oportunidade_id),
  });
}

export function useEditarMensagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id: string; oportunidadeId: string; mensagem: string }) => {
      const { error } = await supabase.from("crm_tarefa").update({ mensagem: t.mensagem }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: (_r, t) => invalidarOportunidade(qc, t.oportunidadeId),
  });
}

/** A família respondeu: registra o retorno (a regra dos 3 contatos deixa de valer). */
export function useFamiliaRespondeu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { oportunidadeId: string; nota: string }) => {
      const { error } = await supabase.from("crm_oportunidade")
        .update({ ultimo_retorno_em: new Date().toISOString() }).eq("id", v.oportunidadeId);
      if (error) throw error;
      await registrarEventoCrm(v.oportunidadeId, "resposta", v.nota.trim() ? `Família respondeu: ${v.nota.trim()}` : "Família respondeu.");
    },
    onSuccess: (_r, v) => invalidarOportunidade(qc, v.oportunidadeId),
  });
}

/** Família pediu para não receber mais mensagens (LGPD): o servidor cancela a sequência. */
export function useOptOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oportunidadeId: string) => {
      const { error } = await supabase.from("crm_oportunidade").update({ opt_out: true }).eq("id", oportunidadeId);
      if (error) throw error;
      await registrarEventoCrm(oportunidadeId, "opt_out", "Família pediu para não receber mais mensagens.");
    },
    onSuccess: (_r, id) => invalidarOportunidade(qc, id),
  });
}

async function carregarParaMensagem(oportunidadeId: string) {
  const [op, bib, mod] = await Promise.all([
    supabase.from("crm_oportunidade").select("*").eq("id", oportunidadeId).single(),
    supabase.from("crm_biblioteca").select("*"),
    supabase.from("crm_modelo_mensagem").select("*"),
  ]);
  if (op.error) throw op.error;
  if (bib.error) throw bib.error;
  if (mod.error) throw mod.error;
  const { data: contato } = await supabase.from("crm_contato").select("*").eq("id", op.data.contato_id).maybeSingle();
  const hoje = hojeISO();
  return {
    op: op.data,
    dados: dadosDaOportunidade(op.data, contato ?? null, usuarioAtual.nome, hoje),
    biblioteca: bib.data ?? [],
    modelos: mod.data ?? [],
    hoje,
  };
}

/** Cria uma mensagem a partir de um modelo (convite, nutrição, contrato…). */
export async function criarMensagemDeModelo(oportunidadeId: string, codigo: string, data: string, canal: "whatsapp" | "email" = "whatsapp") {
  const c = await carregarParaMensagem(oportunidadeId);
  const modelo = c.modelos.find((m) => m.codigo === codigo);
  const mensagem = mensagemDeModelo(codigo, c.dados, c.biblioteca, c.modelos);
  if (!modelo || !mensagem) throw new Error("Modelo de mensagem não encontrado.");
  const { error } = await supabase.from("crm_tarefa").insert({
    oportunidade_id: oportunidadeId,
    tipo: canal === "email" ? "Email" : "WhatsApp",
    assunto: modelo.nome,
    responsavel: usuarioAtual.nome,
    data,
    modelo: codigo,
    mensagem,
    canal,
    automatica: true,
  });
  if (error) throw error;
}

export function useNovaMensagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { oportunidadeId: string; codigo: string; data: string }) => {
      await criarMensagemDeModelo(v.oportunidadeId, v.codigo, v.data, v.codigo === "MINUTA_EMAIL" ? "email" : "whatsapp");
    },
    onSuccess: (_r, v) => invalidarOportunidade(qc, v.oportunidadeId),
  });
}

/**
 * Pausar = nutrição de longo prazo: o servidor cancela a sequência pendente e
 * entram as mensagens M7 em 30 e 60 dias.
 */
export function usePausarNutricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oportunidadeId: string) => {
      const { error } = await supabase.from("crm_oportunidade").update({ status: "pausada" }).eq("id", oportunidadeId);
      if (error) throw error;
      const hoje = hojeISO();
      await criarMensagemDeModelo(oportunidadeId, "M7", somarDiasISO(hoje, 30));
      await criarMensagemDeModelo(oportunidadeId, "M7", somarDiasISO(hoje, 60));
      await registrarEventoCrm(oportunidadeId, "pausa", "Pausado para nutrição de longo prazo (mensagens em 30 e 60 dias).");
    },
    onSuccess: (_r, id) => invalidarOportunidade(qc, id),
  });
}

/** Retomar um lead pausado: volta a "em andamento"; as mensagens de nutrição pendentes são canceladas. */
export function useRetomarPausado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (oportunidadeId: string) => {
      const { error } = await supabase.from("crm_oportunidade").update({ status: "em_andamento" }).eq("id", oportunidadeId);
      if (error) throw error;
      await supabase.from("crm_tarefa").update({ cancelada: true, motivo_cancelamento: "Lead retomado" })
        .eq("oportunidade_id", oportunidadeId).eq("modelo", "M7").eq("concluida", false).eq("cancelada", false);
      await registrarEventoCrm(oportunidadeId, "retomada", "Lead retomado da nutrição de longo prazo.");
    },
    onSuccess: (_r, id) => invalidarOportunidade(qc, id),
  });
}
