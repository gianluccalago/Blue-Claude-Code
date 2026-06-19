import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { VisitaAgendamento, VisitaDisponibilidade } from "@/types/database";

// ===========================================================================
// Agenda de Visitas — leitura/escrita pela GESTÃO (app autenticado). A RLS
// libera só Master/Direção; o site (anon) tem caminho próprio (ver migração).
// A "ocupação" de um slot é DERIVADA: um slot está ocupado quando há
// agendamento ativo (pendente|confirmada|remarcada) naquele data+hora — não há
// flag de ocupado, então remarcar/cancelar liberam o slot automaticamente.
// ===========================================================================

const K = {
  disponibilidade: ["visita-disponibilidade"] as const,
  agendamentos: ["visita-agendamentos"] as const,
};

const STATUS_ATIVO = ["pendente", "confirmada", "remarcada"] as const;

function invalidarTudo(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: K.disponibilidade });
  qc.invalidateQueries({ queryKey: K.agendamentos });
}

/** Slots da grade num intervalo [de, ate] (datas ISO yyyy-mm-dd). */
export function useDisponibilidade(de: string, ate: string) {
  return useQuery({
    queryKey: [...K.disponibilidade, de, ate],
    queryFn: async (): Promise<VisitaDisponibilidade[]> => {
      const { data, error } = await supabase
        .from("visita_disponibilidade")
        .select("*")
        .gte("data", de)
        .lte("data", ate)
        .order("data")
        .order("hora");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Todos os agendamentos (a UI filtra por status/período). */
export function useAgendamentos() {
  return useQuery({
    queryKey: K.agendamentos,
    queryFn: async (): Promise<VisitaAgendamento[]> => {
      const { data, error } = await supabase
        .from("visita_agendamento")
        .select("*")
        .order("data")
        .order("hora");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Conjunto de "data|hora" ocupados por agendamento ATIVO (para o calendário). */
export function chaveSlot(data: string, hora: string): string {
  return `${data}|${hora.slice(0, 5)}`;
}
export function ocupacaoAtiva(agendamentos: VisitaAgendamento[]): Map<string, VisitaAgendamento> {
  const m = new Map<string, VisitaAgendamento>();
  for (const a of agendamentos) {
    if ((STATUS_ATIVO as readonly string[]).includes(a.status)) m.set(chaveSlot(a.data, a.hora), a);
  }
  return m;
}

// ─── Grade / bloqueios ────────────────────────────────────────────────────────

/** Cria/garante slots para uma grade (dias úteis × horários) num intervalo. */
export function useGerarGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      de: string;
      ate: string;
      dows: number[]; // isodow 1..7
      horarios: string[]; // "HH:MM"
      capacidade: number;
    }) => {
      const linhas: { data: string; hora: string; capacidade: number }[] = [];
      const ini = new Date(`${args.de}T00:00:00`);
      const fim = new Date(`${args.ate}T00:00:00`);
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay(); // JS dom=0 → isodow 7
        if (!args.dows.includes(dow)) continue;
        const dataISO = d.toISOString().slice(0, 10);
        for (const h of args.horarios) linhas.push({ data: dataISO, hora: `${h}:00`, capacidade: args.capacidade });
      }
      if (linhas.length === 0) return;
      // Não sobrescreve slots existentes (preserva bloqueios/capacidade já ajustados).
      const { error } = await supabase
        .from("visita_disponibilidade")
        .upsert(linhas, { onConflict: "data,hora", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

/** Cria um único slot avulso. */
export function useCriarSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: string; hora: string; capacidade: number }) => {
      const { error } = await supabase
        .from("visita_disponibilidade")
        .upsert(
          { data: args.data, hora: `${args.hora}:00`, capacidade: args.capacidade },
          { onConflict: "data,hora", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useExcluirSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visita_disponibilidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

/** Bloqueia/libera um slot específico. */
export function useDefinirBloqueioSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; bloqueada: boolean; motivo?: string | null }) => {
      const { error } = await supabase
        .from("visita_disponibilidade")
        .update({ bloqueada: args.bloqueada, motivo_bloqueio: args.bloqueada ? args.motivo ?? null : null })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

/** Bloqueia/libera um DIA inteiro (todos os slots da data). */
export function useDefinirBloqueioDia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: string; bloqueada: boolean; motivo?: string | null }) => {
      const { error } = await supabase
        .from("visita_disponibilidade")
        .update({ bloqueada: args.bloqueada, motivo_bloqueio: args.bloqueada ? args.motivo ?? null : null })
        .eq("data", args.data);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

// ─── Agendamentos: ações da gestão ────────────────────────────────────────────

export function useConfirmarVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("visita_agendamento")
        .update({ status: "confirmada", confirmado_em: new Date().toISOString(), atualizado_por: usuarioAtual.nome })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useRemarcarVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; data: string; hora: string }) => {
      const { error } = await supabase
        .from("visita_agendamento")
        .update({ status: "remarcada", data: args.data, hora: `${args.hora}:00`, atualizado_por: usuarioAtual.nome })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useCancelarVisita() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("visita_agendamento")
        .update({ status: "cancelada", atualizado_por: usuarioAtual.nome })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

/** A própria gestão agenda uma visita (origem "app"), já confirmada. */
export function useAgendarVisitaApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      nomeCompleto: string;
      whatsapp: string;
      email: string | null;
      data: string;
      hora: string;
      observacao: string | null;
      oportunidadeId: string | null;
    }) => {
      const { error } = await supabase.from("visita_agendamento").insert({
        nome_completo: args.nomeCompleto,
        whatsapp: args.whatsapp,
        email: args.email,
        data: args.data,
        hora: `${args.hora}:00`,
        origem: "app",
        status: "confirmada",
        observacao: args.observacao,
        oportunidade_id: args.oportunidadeId,
        confirmado_em: new Date().toISOString(),
        atualizado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}

/** Vincula (ou desvincula) a visita a uma oportunidade do CRM. */
export function useVincularOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; oportunidadeId: string | null }) => {
      const { error } = await supabase
        .from("visita_agendamento")
        .update({ oportunidade_id: args.oportunidadeId, atualizado_por: usuarioAtual.nome })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTudo(qc),
  });
}
