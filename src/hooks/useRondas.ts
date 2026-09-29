import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { lerUrlNtag213 } from "@/lib/nfc";
import { enfileirar, itensDaFila, removerDaFila, type ItemFila } from "@/lib/filaRondas";
import { plantaoAtualEAnterior, type PlantaoRef } from "@/lib/rotina";
import type { Dispositivo, NfcTag, Ronda, RondaConfig, RondaLeitura, StatusLeituraRonda } from "@/types/database";

// ===========================================================================
// Rondas NFC (0148) — tablet, tags, configuração, leitura e painel.
// ===========================================================================

const KEY = ["rondas"] as const;
const TOKEN_KEY = "blue-device-token";
const MAPA_KEY = "blue-rondas-mapa";

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

// ─── Tablet ───────────────────────────────────────────────────────────────────

export function lerTokenDispositivo(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function useStatusDispositivo() {
  const token = lerTokenDispositivo();
  return useQuery({
    queryKey: [...KEY, "dispositivo", token],
    queryFn: async () => {
      if (!token) return { cadastrado: false, ativo: false, nome: null as string | null };
      const { data, error } = await supabase.rpc("dispositivo_status", { p_token: token });
      if (error) throw error;
      // Função escalar: o PostgREST devolve o objeto; o emulador local, uma lista.
      return (Array.isArray(data) ? data[0] : data) as { cadastrado: boolean; ativo: boolean; nome: string | null };
    },
  });
}

export function useDispositivos() {
  return useQuery({
    queryKey: [...KEY, "dispositivos"],
    queryFn: async (): Promise<Dispositivo[]> => {
      const { data, error } = await supabase.from("devices").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Dispositivo[];
    },
  });
}

/** Cadastra ESTE tablet: gera o token (uma vez) e o salva no próprio aparelho. */
export function useCadastrarEsteTablet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase.rpc("cadastrar_dispositivo", { p_nome: nome });
      if (error) throw error;
      localStorage.setItem(TOKEN_KEY, data as string);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useRevogarDispositivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revogar_dispositivo", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

// ─── Tags e quartos ───────────────────────────────────────────────────────────

export interface TagComQuarto extends NfcTag {
  quarto: string;
}

export function useTagsNfc() {
  return useQuery({
    queryKey: [...KEY, "tags"],
    queryFn: async (): Promise<TagComQuarto[]> => {
      const [t, q] = await Promise.all([
        supabase.from("nfc_tags").select("*"),
        supabase.from("quarto").select("id, codigo"),
      ]);
      if (t.error) throw t.error;
      if (q.error) throw q.error;
      const cod = new Map((q.data ?? []).map((x) => [x.id as string, x.codigo as string]));
      return ((t.data ?? []) as NfcTag[])
        .map((x) => ({ ...x, quarto: cod.get(x.quarto_id) ?? "?" }))
        .sort((a, b) => a.quarto.localeCompare(b.quarto));
    },
  });
}

export function useQuartos() {
  return useQuery({
    queryKey: [...KEY, "quartos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quarto").select("id, codigo").eq("ativo", true).order("codigo");
      if (error) throw error;
      return (data ?? []) as { id: string; codigo: string }[];
    },
  });
}

export function useCadastrarTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { uid: string; quarto: string; contador: number | null; observacao: string }) => {
      const { error } = await supabase.rpc("cadastrar_tag_nfc", {
        p_uid: v.uid, p_quarto: v.quarto, p_contador: v.contador, p_observacao: v.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useDefinirTagAtiva() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; ativa: boolean }) => {
      const { error } = await supabase.rpc("definir_tag_ativa", { p_id: v.id, p_ativa: v.ativa });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export interface QuartoMapa {
  quarto: string;
  residentes: { id: string; nome: string; leito: string }[];
}

/**
 * Mapa UID → quarto e hóspedes, guardado também no tablet: sem rede, a
 * cuidadora ainda vê quem está no quarto e preenche o checklist.
 */
export function useMapaQuartos() {
  return useQuery({
    queryKey: [...KEY, "mapa"],
    queryFn: async (): Promise<Record<string, QuartoMapa>> => {
      try {
        const [t, q, l, r] = await Promise.all([
          supabase.from("nfc_tags").select("uid, quarto_id").eq("ativa", true),
          supabase.from("quarto").select("id, codigo"),
          supabase.from("leito").select("id, quarto_id, codigo"),
          supabase.from("residentes").select("id, nome, leito_id").eq("status_hospede", "ativo"),
        ]);
        for (const x of [t, q, l, r]) if (x.error) throw x.error;
        const quartoCod = new Map((q.data ?? []).map((x) => [x.id as string, x.codigo as string]));
        const leitos = new Map((l.data ?? []).map((x) => [x.id as string, x as { id: string; quarto_id: string; codigo: string }]));
        const mapa: Record<string, QuartoMapa> = {};
        for (const tag of t.data ?? []) {
          const residentes = (r.data ?? [])
            .map((h) => ({ h, le: leitos.get((h as { leito_id: string | null }).leito_id ?? "") }))
            .filter((x) => x.le?.quarto_id === tag.quarto_id)
            .map((x) => ({ id: x.h.id as string, nome: x.h.nome as string, leito: x.le!.codigo }))
            .sort((a, b) => a.leito.localeCompare(b.leito));
          mapa[tag.uid as string] = { quarto: quartoCod.get(tag.quarto_id as string) ?? "?", residentes };
        }
        localStorage.setItem(MAPA_KEY, JSON.stringify(mapa));
        return mapa;
      } catch (e) {
        const salvo = localStorage.getItem(MAPA_KEY);
        if (salvo) return JSON.parse(salvo) as Record<string, QuartoMapa>;
        throw e;
      }
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Configuração ─────────────────────────────────────────────────────────────

export function useRondaConfig(residenteId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, "config", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<RondaConfig | null> => {
      const { data, error } = await supabase.from("ronda_config").select("*").eq("residente_id", residenteId!).maybeSingle();
      if (error) throw error;
      return (data as RondaConfig | null) ?? null;
    },
  });
}

export function useSalvarRondaConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Pick<RondaConfig, "residente_id" | "ativa" | "intervalo_min" | "tolerancia_min" | "turnos">) => {
      const { error } = await supabase.from("ronda_config").upsert({ ...v, atualizado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useParametrosRonda() {
  return useQuery({
    queryKey: [...KEY, "parametros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ronda_parametros").select("plausibilidade_segundos").maybeSingle();
      if (error) throw error;
      return { plausibilidade_segundos: (data?.plausibilidade_segundos as number | undefined) ?? 30 };
    },
  });
}

export function useSalvarParametrosRonda() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (segundos: number) => {
      const { error } = await supabase
        .from("ronda_parametros")
        .update({ plausibilidade_segundos: segundos, atualizado_por: usuarioAtual.nome })
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

// ─── Leitura (Edge Function) e fila offline ───────────────────────────────────

export interface RespostaLeitura {
  ok: boolean;
  status: StatusLeituraRonda | "nao_autenticado" | "erro_servidor";
  flags: string[];
  leitura_id: string | null;
  quarto: string | null;
  residentes: { id: string; nome: string; leito: string }[];
  servidor_em: string;
}

/** Sem rede (ou Edge Function inalcançável) → lança SemRede; recusa → volta a resposta. */
export class SemRede extends Error {}

export async function enviarLeitura(corpo: {
  url: string | null;
  serial_number: string | null;
  offline?: boolean;
  capturado_em?: string;
  checklist?: ItemFila["checklist"];
}): Promise<RespostaLeitura> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new SemRede("sem rede");
  const token = lerTokenDispositivo() ?? "";
  const { data, error } = await supabase.functions.invoke("verify-round", {
    body: corpo,
    headers: { "x-device-token": token },
  });
  if (error) {
    const nome = (error as { name?: string }).name ?? "";
    if (nome === "FunctionsFetchError" || nome === "FunctionsRelayError") throw new SemRede(error.message);
    throw error;
  }
  return data as RespostaLeitura;
}

export function useRegistrarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { leituraId: string; checklist: ItemFila["checklist"] }) => {
      const { error } = await supabase.rpc("registrar_checklist_ronda", { p_leitura: v.leituraId, p_checklist: v.checklist });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export async function guardarNaFila(item: Omit<ItemFila, "id" | "usuario_id">) {
  await enfileirar({ ...item, id: crypto.randomUUID(), usuario_id: usuarioAtual.id });
}

/** Pendências da fila e envio automático quando a rede volta. */
export function useFilaRondas() {
  const qc = useQueryClient();
  const [pendentes, setPendentes] = useState(0);
  const [enviando, setEnviando] = useState(false);

  const atualizar = useCallback(async () => {
    try {
      setPendentes((await itensDaFila()).length);
    } catch {
      setPendentes(0);
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (enviando || !navigator.onLine) return;
    setEnviando(true);
    try {
      for (const item of await itensDaFila()) {
        try {
          await enviarLeitura({
            url: item.url, serial_number: item.serial_number, offline: true,
            capturado_em: item.capturado_em, checklist: item.checklist,
          });
          // Qualquer resposta do servidor (válida ou recusada) fica registrada lá.
          await removerDaFila(item.id);
        } catch (e) {
          if (e instanceof SemRede) break;
        }
      }
    } finally {
      setEnviando(false);
      await atualizar();
      invalidar(qc);
    }
  }, [enviando, atualizar, qc]);

  useEffect(() => {
    void atualizar();
    const aoVoltar = () => void sincronizar();
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
  }, [atualizar, sincronizar]);

  return { pendentes, enviando, sincronizar, atualizar };
}

// ─── Situação dos hóspedes (tela da cuidadora) ────────────────────────────────

export interface SituacaoHospedeDados {
  configs: Map<string, RondaConfig>;
  /** Última ronda NO HORÁRIO (válida, não sincronizada tarde) por hóspede. */
  ultimas: Map<string, Date>;
}

export function useUltimasRondas(residenteIds: string[]) {
  const ids = [...residenteIds].sort();
  return useQuery({
    queryKey: [...KEY, "ultimas", ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SituacaoHospedeDados> => {
      const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [c, r] = await Promise.all([
        supabase.from("ronda_config").select("*").in("residente_id", ids),
        supabase.from("ronda").select("residente_id, servidor_em, flags").in("residente_id", ids).gte("servidor_em", desde),
      ]);
      if (c.error) throw c.error;
      if (r.error) throw r.error;
      const ultimas = new Map<string, Date>();
      for (const x of (r.data ?? []) as Pick<Ronda, "residente_id" | "servidor_em" | "flags">[]) {
        if (x.flags.includes("sincronizado_tarde")) continue;
        const d = new Date(x.servidor_em);
        const at = ultimas.get(x.residente_id);
        if (!at || d > at) ultimas.set(x.residente_id, d);
      }
      return { configs: new Map(((c.data ?? []) as RondaConfig[]).map((x) => [x.residente_id, x])), ultimas };
    },
  });
}

// ─── Painel de conformidade ───────────────────────────────────────────────────

export interface DadosPainelRondas {
  plantao: PlantaoRef;
  residentes: { id: string; nome: string; quarto: string | null; grau: string | null }[];
  configs: RondaConfig[];
  leituras: RondaLeitura[];
  rondas: Ronda[];
  quartos: Map<string, string>;
}

export function usePainelRondas(plantao: PlantaoRef | null) {
  const ref = plantao ?? plantaoAtualEAnterior().atual;
  return useQuery({
    queryKey: [...KEY, "painel", ref.tag, ref.dataPlantao],
    refetchInterval: 60_000,
    queryFn: async (): Promise<DadosPainelRondas> => {
      const ini = new Date(ref.janela.inicio.getTime() - 3600_000).toISOString();
      const fim = new Date(ref.janela.fim.getTime() + 6 * 3600_000).toISOString();
      const [res, cfg, lei, ron, qua] = await Promise.all([
        supabase.from("residentes").select("id, nome, quarto, grau_dependencia").eq("status_hospede", "ativo"),
        supabase.from("ronda_config").select("*"),
        supabase.from("ronda_leitura").select("*").gte("servidor_em", ini).lte("servidor_em", fim).order("servidor_em", { ascending: false }),
        supabase.from("ronda").select("*").gte("servidor_em", ini).lte("servidor_em", fim),
        supabase.from("quarto").select("id, codigo"),
      ]);
      for (const x of [res, cfg, lei, ron, qua]) if (x.error) throw x.error;
      return {
        plantao: ref,
        residentes: ((res.data ?? []) as { id: string; nome: string; quarto: string | null; grau_dependencia: string | null }[])
          .map((r) => ({ id: r.id, nome: r.nome, quarto: r.quarto, grau: r.grau_dependencia }))
          .sort((a, b) => (a.quarto ?? "").localeCompare(b.quarto ?? "")),
        configs: (cfg.data ?? []) as RondaConfig[],
        leituras: (lei.data ?? []) as RondaLeitura[],
        rondas: (ron.data ?? []) as Ronda[],
        quartos: new Map(((qua.data ?? []) as { id: string; codigo: string }[]).map((q) => [q.id, q.codigo])),
      };
    },
  });
}

export function useRevisarLeitura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; nota: string }) => {
      const { error } = await supabase.rpc("revisar_leitura_ronda", { p_id: v.id, p_nota: v.nota || null });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** UID lido da URL (para achar o quarto offline). */
export function uidDaUrl(url: string | null): string | null {
  return lerUrlNtag213(url)?.uid ?? null;
}
