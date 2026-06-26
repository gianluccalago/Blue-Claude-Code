import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { hojeISO } from "@/lib/utils";
import type { EventoSentinela, Intercorrencia, TipoEventoSentinela } from "@/types/database";

// ===========================================================================
// Vigilância Sanitária — eventos sentinela e notificação compulsória (0085).
// Coordenação/Médico registram; o RT/Master fiscaliza e registra a notificação.
// ===========================================================================

export interface EventoSentinelaComNome extends EventoSentinela {
  residenteNome: string | null;
}

export function useEventosSentinela() {
  return useQuery({
    queryKey: ["eventos-sentinela"],
    queryFn: async (): Promise<EventoSentinelaComNome[]> => {
      const { data, error } = await supabase
        .from("evento_sentinela")
        .select("*")
        .order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      const eventos = data ?? [];
      const ids = [...new Set(eventos.map((e) => e.residente_id))];
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: resis, error: errR } = await supabase
          .from("residentes")
          .select("id, nome")
          .in("id", ids);
        if (errR) throw errR;
        for (const r of resis ?? []) nomes.set(r.id, r.nome);
      }
      return eventos.map((e) => ({ ...e, residenteNome: nomes.get(e.residente_id) ?? null }));
    },
  });
}

export interface QuedaParaAvaliar {
  intercorrencia: Intercorrencia;
  residenteNome: string | null;
}

/**
 * Quedas (intercorrências tipo "Queda") recentes que AINDA NÃO foram
 * classificadas como evento sentinela — para a Coordenação/Médico/RT avaliar a
 * lesão e notificar. Janela padrão de 30 dias.
 */
export function useQuedasParaAvaliar(dias = 30) {
  return useQuery({
    queryKey: ["quedas-para-avaliar", dias],
    queryFn: async (): Promise<QuedaParaAvaliar[]> => {
      const limite = new Date();
      limite.setDate(limite.getDate() - dias);
      const limiteISO = limite.toISOString();

      const [intercResp, sentResp] = await Promise.all([
        supabase
          .from("intercorrencia")
          .select("*")
          .eq("tipo", "Queda")
          .gte("registrado_em", limiteISO)
          .order("registrado_em", { ascending: false }),
        supabase.from("evento_sentinela").select("intercorrencia_id").not("intercorrencia_id", "is", null),
      ]);
      if (intercResp.error) throw intercResp.error;
      if (sentResp.error) throw sentResp.error;

      const jaClassificadas = new Set((sentResp.data ?? []).map((s) => s.intercorrencia_id));
      const quedas = (intercResp.data ?? []).filter((i) => !jaClassificadas.has(i.id));
      if (quedas.length === 0) return [];

      const ids = [...new Set(quedas.map((q) => q.residente_id))];
      const nomes = new Map<string, string>();
      const { data: resis } = await supabase.from("residentes").select("id, nome").in("id", ids);
      for (const r of resis ?? []) nomes.set(r.id, r.nome);

      return quedas.map((intercorrencia) => ({
        intercorrencia,
        residenteNome: nomes.get(intercorrencia.residente_id) ?? null,
      }));
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["eventos-sentinela"] });
  qc.invalidateQueries({ queryKey: ["quedas-para-avaliar"] });
}

export interface NovoEventoSentinela {
  residenteId: string;
  tipo: TipoEventoSentinela;
  descricao: string;
  dataOcorrencia: string; // ISO
  descricaoDoenca?: string | null;
  gravidade?: string | null;
  intercorrenciaId?: string | null;
}

export function useRegistrarEventoSentinela() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: NovoEventoSentinela) => {
      const { error } = await supabase.from("evento_sentinela").insert({
        residente_id: args.residenteId,
        intercorrencia_id: args.intercorrenciaId ?? null,
        tipo: args.tipo,
        descricao: args.descricao.trim() || null,
        descricao_doenca: args.descricaoDoenca?.trim() || null,
        data_ocorrencia: args.dataOcorrencia || hojeISO(),
        gravidade: args.gravidade?.trim() || null,
        registrado_por: usuarioAtual.nome,
        perfil_registrador: usuarioAtual.perfil,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export interface DadosNotificacao {
  id: string;
  orgaoNotificado: string;
  dataNotificacao: string; // ISO
  protocolo?: string | null;
  observacao?: string | null;
}

/** RT registra a notificação à vigilância (documenta o cumprimento legal). */
export function useRegistrarNotificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: DadosNotificacao) => {
      const { error } = await supabase
        .from("evento_sentinela")
        .update({
          notificado: true,
          notificado_em: args.dataNotificacao || new Date().toISOString(),
          notificado_por: usuarioAtual.nome,
          orgao_notificado: args.orgaoNotificado.trim() || null,
          protocolo_notificacao: args.protocolo?.trim() || null,
          observacao_notificacao: args.observacao?.trim() || null,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
