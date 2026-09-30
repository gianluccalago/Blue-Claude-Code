import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { enviarLeitura } from "@/hooks/useRondas";
import { lerUmaTag } from "@/lib/nfc";
import type { ChamadoAberto, ChamadoHistorico } from "@/lib/chamados";

// ===========================================================================
// Chamados de hóspede (0149). Abertos em tempo real (Supabase Realtime) com
// consulta a cada 15 s como reserva — um alerta nunca fica esperando.
// ===========================================================================

const KEY = ["chamados"] as const;

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

async function codigosDosQuartos(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("quarto").select("id, codigo");
  if (error) throw error;
  return new Map(((data ?? []) as { id: string; codigo: string }[]).map((q) => [q.id, q.codigo]));
}

/** Escuta mudanças na tabela de chamados e atualiza as telas na hora. */
export function useChamadosAoVivo() {
  const qc = useQueryClient();
  useEffect(() => {
    // Nome único por tela: a faixa do topo e o painel assinam ao mesmo tempo,
    // e o Supabase não aceita registrar de novo num canal já assinado.
    const canal = supabase
      .channel(`chamados-ao-vivo-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chamado" }, () => invalidar(qc))
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [qc]);
}

export function useChamadosAbertos() {
  return useQuery({
    queryKey: [...KEY, "abertos"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<ChamadoAberto[]> => {
      const [c, q] = await Promise.all([
        supabase.from("chamado").select("*").eq("status", "aberto"),
        codigosDosQuartos(),
      ]);
      if (c.error) throw c.error;
      return ((c.data ?? []) as (Omit<ChamadoAberto, "quarto"> & { quarto_id: string })[]).map((x) => ({
        ...x,
        quarto: q.get(x.quarto_id) ?? "?",
      }));
    },
  });
}

export interface ChamadoHistoricoComQuarto extends ChamadoHistorico {
  id: string;
  quarto: string;
  origem: string;
  atendido_por: string | null;
  reconhecido_por: string | null;
  justificativa: string | null;
}

export function useChamadosRecentes(horas = 24) {
  return useQuery({
    queryKey: [...KEY, "recentes", horas],
    refetchInterval: 60_000,
    queryFn: async (): Promise<ChamadoHistoricoComQuarto[]> => {
      const desde = new Date(Date.now() - horas * 3600_000).toISOString();
      const [c, q] = await Promise.all([
        supabase.from("chamado").select("*").gte("aberto_em", desde).order("aberto_em", { ascending: false }),
        codigosDosQuartos(),
      ]);
      if (c.error) throw c.error;
      return ((c.data ?? []) as (Omit<ChamadoHistoricoComQuarto, "quarto"> & { quarto_id: string })[]).map((x) => ({
        ...x,
        quarto: q.get(x.quarto_id) ?? "?",
      }));
    },
  });
}

/** Quem está em cada suíte (primeiros nomes), para o mapa e o painel. */
export function useOcupacaoSuites() {
  return useQuery({
    queryKey: [...KEY, "ocupacao"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, { nome: string; leito: string }[]>> => {
      const [r, l, q] = await Promise.all([
        supabase.from("residentes").select("nome, leito_id").eq("status_hospede", "ativo"),
        supabase.from("leito").select("id, quarto_id, codigo"),
        codigosDosQuartos(),
      ]);
      if (r.error) throw r.error;
      if (l.error) throw l.error;
      const leitos = new Map(((l.data ?? []) as { id: string; quarto_id: string; codigo: string }[]).map((x) => [x.id, x]));
      const m = new Map<string, { nome: string; leito: string }[]>();
      for (const h of (r.data ?? []) as { nome: string; leito_id: string | null }[]) {
        const le = h.leito_id ? leitos.get(h.leito_id) : undefined;
        if (!le) continue;
        const cod = q.get(le.quarto_id);
        if (!cod) continue;
        m.set(cod, [...(m.get(cod) ?? []), { nome: h.nome, leito: le.codigo }]);
      }
      return m;
    },
  });
}

export function useCentraisChamado() {
  return useQuery({
    queryKey: [...KEY, "centrais"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("chamado_central").select("id, nome, ativo, ultimo_sinal_em, criado_em, cadastrado_por, revogado_em").order("criado_em");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; ativo: boolean; ultimo_sinal_em: string | null; criado_em: string; cadastrado_por: string | null; revogado_em: string | null }[];
    },
  });
}

// ─── Ações ────────────────────────────────────────────────────────────────────

function mutacaoRpc<A>(fn: (a: A) => PromiseLike<{ error: unknown }>) {
  return function useMutacao() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (a: A) => {
        const { error } = await fn(a);
        if (error) throw error;
      },
      onSuccess: () => invalidar(qc),
    });
  };
}

/** "Estou indo": avisa a equipe. O alerta continua até a presença no quarto. */
export const useReconhecerChamado = mutacaoRpc((id: string) => supabase.rpc("reconhecer_chamado", { p_id: id }));
export const useEncerrarExcepcional = mutacaoRpc((a: { id: string; justificativa: string }) =>
  supabase.rpc("encerrar_chamado_excepcional", { p_id: a.id, p_justificativa: a.justificativa }));
export const useSimularChamado = mutacaoRpc((a: { quarto: string; tipo: "chamado" | "emergencia" }) =>
  supabase.rpc("simular_chamado", { p_quarto: a.quarto, p_tipo: a.tipo }));
export const useRevogarCentral = mutacaoRpc((id: string) => supabase.rpc("revogar_central_chamado", { p_id: id }));
export const useCadastrarDispositivoChamado = mutacaoRpc((a: { codigo: string; quarto: string; tipo: "botao" | "corda" | "presenca"; local: string }) =>
  supabase.rpc("cadastrar_dispositivo_chamado", { p_codigo: a.codigo, p_quarto: a.quarto, p_tipo: a.tipo, p_local: a.local || null }));
export const useAtivarDispositivoChamado = mutacaoRpc((a: { id: string; ativo: boolean }) =>
  supabase.rpc("definir_dispositivo_chamado_ativo", { p_id: a.id, p_ativo: a.ativo }));

/** Gera o token da central (mostrado UMA vez para configurar o aparelho). */
export function useCadastrarCentral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string): Promise<string> => {
      const { data, error } = await supabase.rpc("cadastrar_central_chamado", { p_nome: nome });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as string;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useDispositivosChamado() {
  return useQuery({
    queryKey: [...KEY, "dispositivos"],
    queryFn: async () => {
      const [d, q] = await Promise.all([supabase.from("chamado_dispositivo").select("*").order("criado_em"), codigosDosQuartos()]);
      if (d.error) throw d.error;
      return ((d.data ?? []) as { id: string; codigo_externo: string; quarto_id: string; tipo: string; local: string | null; ativo: boolean }[])
        .map((x) => ({ ...x, quarto: q.get(x.quarto_id) ?? "?" }))
        .sort((a, b) => a.quarto.localeCompare(b.quarto) || a.tipo.localeCompare(b.tipo));
    },
  });
}

/**
 * Atender: encosta o tablet na etiqueta NFC da suíte. A leitura válida
 * (Edge Function verify-round) fecha o chamado no banco. Devolve a suíte lida.
 */
export function useAtenderComEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (signal: AbortSignal) => {
      const l = await lerUmaTag(signal);
      const r = await enviarLeitura({ url: l.url, serial_number: l.serialNumber });
      return r;
    },
    onSuccess: () => {
      invalidar(qc);
      qc.invalidateQueries({ queryKey: ["rondas"] });
    },
  });
}
