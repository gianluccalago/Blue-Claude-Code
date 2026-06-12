import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { LogAlteracao } from "@/types/database";

// ===========================================================================
// Trilha de auditoria (Bloco 4): toda alteração financeira sensível grava
// QUEM/O QUÊ/DE→PARA/POR QUÊ em log_alteracao (imutável por RLS).
// ===========================================================================

export type EntradaLog = {
  tabelaOrigem: string;
  registroId: string;
  campo: string;
  valorAnterior: string | number | null | undefined;
  valorNovo: string | number | null | undefined;
  motivo?: string | null;
};

function texto(v: string | number | null | undefined): string | null {
  return v === null || v === undefined ? null : String(v);
}

/**
 * Grava entradas na trilha. Só registra entradas cujo valor realmente mudou.
 * Best-effort: falha do log NÃO derruba a operação principal (o dado já foi
 * salvo); o erro fica no console para diagnóstico.
 */
export async function registrarLogAlteracao(entradas: EntradaLog[]): Promise<void> {
  const mudancas = entradas.filter((e) => texto(e.valorAnterior) !== texto(e.valorNovo));
  if (mudancas.length === 0) return;
  const rows = mudancas.map((e) => ({
    tabela_origem: e.tabelaOrigem,
    registro_id: e.registroId,
    campo: e.campo,
    valor_anterior: texto(e.valorAnterior),
    valor_novo: texto(e.valorNovo),
    motivo: e.motivo?.trim() || null,
    alterado_por: usuarioAtual.nome,
  }));
  const { error } = await supabase.from("log_alteracao").insert(rows);
  if (error) console.error("Falha ao gravar trilha de auditoria:", error.message);
}

/** Histórico de alterações de um registro (mais recente primeiro). */
export function useLogAlteracoes(tabelaOrigem: string, registroId: string | null | undefined) {
  return useQuery({
    queryKey: ["log-alteracao", tabelaOrigem, registroId],
    enabled: !!registroId,
    queryFn: async (): Promise<LogAlteracao[]> => {
      const { data, error } = await supabase
        .from("log_alteracao")
        .select("*")
        .eq("tabela_origem", tabelaOrigem)
        .eq("registro_id", registroId as string)
        .order("alterado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}
