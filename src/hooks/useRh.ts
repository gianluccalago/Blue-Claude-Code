import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { intervaloDoMes } from "@/lib/mensalidade";
import type {
  MotivoDesligamento,
  RhAfastamento,
  RhAusencia,
  RhDesligamento,
  TipoAusencia,
  Usuario,
} from "@/types/database";

// ===========================================================================
// RH — CAPTURA de eventos de pessoal (ausências, afastamentos, desligamentos).
// Estes registros ALIMENTARÃO os painéis de RH (turnover, absenteísmo,
// cobertura) no próximo bloco. Acesso restrito à gestão (RLS).
// ===========================================================================

/** Profissionais (todos os usuarios da equipe — inclui registros sem acesso). */
export function useProfissionaisRH() {
  return useQuery({
    queryKey: ["profissionais-rh"],
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("usuarios").select("*");
      if (error) throw error;
      const lista = (data ?? []).filter((u) => u.perfil !== "familia");
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });
}

// ─── Ausências ────────────────────────────────────────────────────────────────

export function useAusenciasDoMes(mes: string) {
  const { inicio, fim } = intervaloDoMes(mes);
  return useQuery({
    queryKey: ["rh-ausencias", mes],
    queryFn: async (): Promise<RhAusencia[]> => {
      const { data, error } = await supabase
        .from("rh_ausencia")
        .select("*")
        .gte("data_inicio", inicio)
        .lte("data_inicio", fim)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarAusenciaInput {
  id?: string;
  profissionalId: string;
  tipo: TipoAusencia;
  dataInicio: string;
  dataFim: string;
  dias: number;
  gerouCobertura: boolean;
  observacao: string | null;
}

export function useSalvarAusencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SalvarAusenciaInput) => {
      const payload = {
        profissional_id: i.profissionalId,
        tipo: i.tipo,
        data_inicio: i.dataInicio,
        data_fim: i.dataFim,
        dias: i.dias,
        gerou_cobertura: i.gerouCobertura,
        observacao: i.observacao,
      };
      if (i.id) {
        const { error } = await supabase.from("rh_ausencia").update(payload).eq("id", i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_ausencia").insert({ ...payload, registrado_por: usuarioAtual.nome });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-ausencias"] }),
  });
}

export function useRemoverAusencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_ausencia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-ausencias"] }),
  });
}

// ─── Afastamentos ─────────────────────────────────────────────────────────────

export function useAfastamentosDoMes(mes: string) {
  const { inicio, fim } = intervaloDoMes(mes);
  return useQuery({
    queryKey: ["rh-afastamentos", mes],
    queryFn: async (): Promise<RhAfastamento[]> => {
      const { data, error } = await supabase
        .from("rh_afastamento")
        .select("*")
        .gte("data_inicio", inicio)
        .lte("data_inicio", fim)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarAfastamentoInput {
  id?: string;
  profissionalId: string;
  dataInicio: string;
  dataFim: string | null;
  diasPerdidos: number;
  cidGrupo: string | null;
  observacao: string | null;
}

export function useSalvarAfastamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SalvarAfastamentoInput) => {
      const payload = {
        profissional_id: i.profissionalId,
        data_inicio: i.dataInicio,
        data_fim: i.dataFim,
        dias_perdidos: i.diasPerdidos,
        cid_grupo: i.cidGrupo,
        observacao: i.observacao,
      };
      if (i.id) {
        const { error } = await supabase.from("rh_afastamento").update(payload).eq("id", i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_afastamento").insert({ ...payload, registrado_por: usuarioAtual.nome });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-afastamentos"] }),
  });
}

export function useRemoverAfastamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_afastamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-afastamentos"] }),
  });
}

// ─── Desligamentos ────────────────────────────────────────────────────────────

export function useDesligamentosDoMes(mes: string) {
  const { inicio, fim } = intervaloDoMes(mes);
  return useQuery({
    queryKey: ["rh-desligamentos", mes],
    queryFn: async (): Promise<RhDesligamento[]> => {
      const { data, error } = await supabase
        .from("rh_desligamento")
        .select("*")
        .gte("data_desligamento", inicio)
        .lte("data_desligamento", fim)
        .order("data_desligamento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarDesligamentoInput {
  id?: string;
  profissionalId: string;
  dataDesligamento: string;
  motivo: MotivoDesligamento;
  cargo: string | null;
  tempoCasaMeses: number | null;
  observacao: string | null;
}

export function useSalvarDesligamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SalvarDesligamentoInput) => {
      const payload = {
        profissional_id: i.profissionalId,
        data_desligamento: i.dataDesligamento,
        motivo: i.motivo,
        cargo: i.cargo,
        tempo_casa_meses: i.tempoCasaMeses,
        observacao: i.observacao,
      };
      if (i.id) {
        const { error } = await supabase.from("rh_desligamento").update(payload).eq("id", i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_desligamento").insert({ ...payload, registrado_por: usuarioAtual.nome });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-desligamentos"] }),
  });
}

export function useRemoverDesligamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_desligamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rh-desligamentos"] }),
  });
}

// ─── Leituras por RANGE (para os PAINÉIS DE RH) ─────────────────────────────

export function useAusenciasRange(de: string, ate: string) {
  return useQuery({
    queryKey: ["rh-ausencias-range", de, ate],
    queryFn: async (): Promise<RhAusencia[]> => {
      const { data, error } = await supabase
        .from("rh_ausencia").select("*").gte("data_inicio", de).lte("data_inicio", ate);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAfastamentosRange(de: string, ate: string) {
  return useQuery({
    queryKey: ["rh-afastamentos-range", de, ate],
    queryFn: async (): Promise<RhAfastamento[]> => {
      const { data, error } = await supabase
        .from("rh_afastamento").select("*").gte("data_inicio", de).lte("data_inicio", ate);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** TODOS os desligamentos (necessário para o headcount histórico mês a mês). */
export function useDesligamentosTodos() {
  return useQuery({
    queryKey: ["rh-desligamentos-todos"],
    queryFn: async (): Promise<RhDesligamento[]> => {
      const { data, error } = await supabase
        .from("rh_desligamento").select("*").order("data_desligamento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
