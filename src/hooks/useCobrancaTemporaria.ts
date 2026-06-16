import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { hojeISO } from "@/lib/utils";
import type {
  CobrancaTemporaria,
  GrauDependencia,
  ModalidadeTemporaria,
  TabelaDiaria,
} from "@/types/database";

// ===========================================================================
// Precificação e cobrança de TEMPORÁRIOS (curta permanência / day care).
//  - tabela_diaria: valores de REFERÊNCIA (baliza) — edita Master/Direção.
//  - cobranca_temporaria: cobrança FLEXÍVEL/aberta — lança a Administração.
// As cobranças entram no faturamento via useResumoMes (fonte única).
// ===========================================================================

// ─── Tabela de referência ────────────────────────────────────────────────────

export function useTabelaDiaria() {
  return useQuery({
    queryKey: ["tabela-diaria"],
    queryFn: async (): Promise<TabelaDiaria[]> => {
      const { data, error } = await supabase
        .from("tabela_diaria")
        .select("*")
        .order("modalidade")
        .order("grau");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Valor de referência (baliza) para modalidade × grau — só sugestão. */
export function valorReferencia(
  tabela: TabelaDiaria[],
  modalidade: ModalidadeTemporaria,
  grau: GrauDependencia | null,
): number | null {
  if (!grau) return null;
  const linha = tabela.find((t) => t.modalidade === modalidade && t.grau === grau);
  return linha?.valor_referencia ?? null;
}

export function useSalvarReferenciaDiaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valorReferencia: number; observacao: string | null }) => {
      const { error } = await supabase
        .from("tabela_diaria")
        .update({
          valor_referencia: args.valorReferencia,
          observacao: args.observacao,
          atualizado_em: new Date().toISOString(),
          atualizado_por: usuarioAtual.nome,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tabela-diaria"] }),
  });
}

// ─── Cobranças temporárias ───────────────────────────────────────────────────

/** Todas as cobranças temporárias de um mês (para demonstrativo/faturamento). */
export function useCobrancasTemporariasDoMes(mes: string) {
  return useQuery({
    queryKey: ["cobranca-temporaria-mes", mes],
    queryFn: async (): Promise<CobrancaTemporaria[]> => {
      const { data, error } = await supabase
        .from("cobranca_temporaria")
        .select("*")
        .eq("periodo_referencia", mes)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface LancarCobrancaInput {
  id?: string;
  residenteId: string;
  modalidade: ModalidadeTemporaria;
  descricao: string;
  valor: number;
  periodoReferencia: string;
  data: string;
}

function invalidar(qc: ReturnType<typeof useQueryClient>, mes: string) {
  qc.invalidateQueries({ queryKey: ["cobranca-temporaria-mes", mes] });
  // Entra no demonstrativo e no faturamento (fonte única).
  qc.invalidateQueries({ queryKey: ["demonstrativo"] });
}

/** Lança (novo) ou edita uma cobrança temporária. */
export function useSalvarCobrancaTemporaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LancarCobrancaInput) => {
      if (input.id) {
        const { error } = await supabase
          .from("cobranca_temporaria")
          .update({
            modalidade: input.modalidade,
            descricao: input.descricao,
            valor: input.valor,
            periodo_referencia: input.periodoReferencia,
            data: input.data,
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cobranca_temporaria").insert({
          residente_id: input.residenteId,
          modalidade: input.modalidade,
          descricao: input.descricao,
          valor: input.valor,
          periodo_referencia: input.periodoReferencia,
          data: input.data,
          registrado_por: usuarioAtual.nome,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_r, input) => invalidar(qc, input.periodoReferencia),
  });
}

export function useDefinirStatusCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; mes: string; pago: boolean }) => {
      const { error } = await supabase
        .from("cobranca_temporaria")
        .update({ status: args.pago ? "pago" : "pendente", pago_em: args.pago ? new Date().toISOString() : null })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => invalidar(qc, args.mes),
  });
}

export function useRemoverCobrancaTemporaria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; mes: string }) => {
      const { error } = await supabase.from("cobranca_temporaria").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => invalidar(qc, args.mes),
  });
}

// Atalho usado pelo hojeISO default em telas.
export const hojeCobranca = hojeISO;
