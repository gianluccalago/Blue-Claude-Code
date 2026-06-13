import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ADMIN_ATUAL } from "@/data/profiles";
import { registrarLogAlteracao } from "@/hooks/useLogAlteracao";
import type {
  FormaPagamento,
  Ocupacao,
  PagamentoMensalidade,
  StatusPagamentoMensalidade,
  TabelaPreco,
  TipoSuite,
} from "@/types/database";

// ─── Tabela de preços ───────────────────────────────────────────────────────────

/** As 12 combinações de tipo de suíte × grau de dependência e seus valores. */
export function useTabelaPreco() {
  return useQuery({
    queryKey: ["tabela-preco"],
    queryFn: async (): Promise<TabelaPreco[]> => {
      const { data, error } = await supabase.from("tabela_preco").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Atualiza o valor de uma combinação tipo de suíte × grau (com trilha). */
export function useAtualizarPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      // Trilha de auditoria: valor anterior antes de sobrescrever.
      const { data: atual } = await supabase
        .from("tabela_preco")
        .select("valor")
        .eq("id", id)
        .maybeSingle();
      const { error } = await supabase.from("tabela_preco").update({ valor }).eq("id", id);
      if (error) throw error;
      await registrarLogAlteracao([
        {
          tabelaOrigem: "tabela_preco",
          registroId: id,
          campo: "valor",
          valorAnterior: atual?.valor ?? null,
          valorNovo: valor,
        },
      ]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tabela-preco"] }),
  });
}

// ─── Dados de suíte/ocupação/mensalidade do residente ────────────────────────────

export type AjustarMensalidadeInput = {
  tipoSuite: TipoSuite | null;
  ocupacao: Ocupacao | null;
  valor: number | null;
  ajusteObs: string | null;
};

/**
 * Atualiza tipo de suíte, ocupação e a mensalidade vigente de um residente.
 * MOTIVO OBRIGATÓRIO quando a mensalidade muda (trilha de auditoria).
 */
export function useAjustarMensalidade(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AjustarMensalidadeInput) => {
      const { data: atual } = await supabase
        .from("residentes")
        .select("mensalidade_valor")
        .eq("id", residenteId)
        .maybeSingle();
      const mudouValor =
        String(atual?.mensalidade_valor ?? "") !== String(args.valor ?? "");
      if (mudouValor && !args.ajusteObs?.trim()) {
        throw new Error("Informe o motivo do ajuste da mensalidade (obrigatório).");
      }
      const { error } = await supabase
        .from("residentes")
        .update({
          tipo_suite: args.tipoSuite,
          ocupacao: args.ocupacao,
          mensalidade_valor: args.valor,
          mensalidade_ajuste_obs: args.ajusteObs,
        })
        .eq("id", residenteId);
      if (error) throw error;
      if (mudouValor) {
        await registrarLogAlteracao([
          {
            tabelaOrigem: "residentes",
            registroId: residenteId,
            campo: "mensalidade_valor",
            valorAnterior: atual?.mensalidade_valor ?? null,
            valorNovo: args.valor,
            motivo: args.ajusteObs,
          },
        ]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residentes"] }),
  });
}

// ─── Pagamentos ─────────────────────────────────────────────────────────────────

/** Pagamentos registrados para um mês de referência ("YYYY-MM"). */
export function usePagamentosDoMes(mes: string) {
  return useQuery({
    queryKey: ["pagamentos-mensalidade", mes],
    queryFn: async (): Promise<PagamentoMensalidade[]> => {
      const { data, error } = await supabase
        .from("pagamento_mensalidade")
        .select("*")
        .eq("mes_referencia", mes);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type MarcarPagamentoInput = {
  residenteId: string;
  mes: string;
  valor: number;
  pago: boolean;
};

/** Marca a mensalidade de um residente/mês como paga (registra) ou pendente (remove o registro). */
export function useMarcarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: MarcarPagamentoInput) => {
      if (args.pago) {
        const agora = new Date();
        const { error } = await supabase.from("pagamento_mensalidade").upsert(
          {
            residente_id: args.residenteId,
            mes_referencia: args.mes,
            valor: args.valor,
            status: "paga",
            pago_em: agora.toISOString(),
            valor_pago: args.valor,
            data_pagamento: agora.toISOString().slice(0, 10),
            registrado_por: ADMIN_ATUAL.nome,
          },
          { onConflict: "residente_id,mes_referencia" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagamento_mensalidade")
          .delete()
          .eq("residente_id", args.residenteId)
          .eq("mes_referencia", args.mes);
        if (error) throw error;
      }
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["pagamentos-mensalidade", args.mes] }),
  });
}

export type MarcarPagamentosLoteInput = {
  mes: string;
  itens: { residenteId: string; valor: number }[];
};

/** Marca várias mensalidades como pagas de uma vez (upsert em lote) para o mês. */
export function useMarcarPagamentosLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: MarcarPagamentosLoteInput) => {
      if (args.itens.length === 0) return;
      const agora = new Date().toISOString();
      const hoje = agora.slice(0, 10);
      const linhas = args.itens.map((i) => ({
        residente_id: i.residenteId,
        mes_referencia: args.mes,
        valor: i.valor,
        status: "paga" as const,
        pago_em: agora,
        valor_pago: i.valor,
        data_pagamento: hoje,
        registrado_por: ADMIN_ATUAL.nome,
      }));
      const { error } = await supabase
        .from("pagamento_mensalidade")
        .upsert(linhas, { onConflict: "residente_id,mes_referencia" });
      if (error) throw error;
    },
    onSuccess: (_r, args) =>
      qc.invalidateQueries({ queryKey: ["pagamentos-mensalidade", args.mes] }),
  });
}

// ─── Cobrança (controle MANUAL do status) ────────────────────────────────────
// Atualiza o status estruturado da cobrança e os campos manuais. SEM integração:
// é a Administração que move o status (ex.: "enviada" ao mandar o boleto por
// fora, "paga" ao confirmar). A cobrança automática futura exigirá um backend
// (ex.: Supabase Edge Function) — inexistente neste ambiente.

export type AtualizarCobrancaInput = {
  residenteId: string;
  mes: string;
  valor: number;
  status: StatusPagamentoMensalidade;
  dataVencimento?: string | null;
  formaPagamento?: FormaPagamento | null;
  valorPago?: number | null;
  dataPagamento?: string | null;
};

/** Upsert do registro de cobrança do mês com status + campos manuais. */
export function useAtualizarCobranca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AtualizarCobrancaInput) => {
      const pago = args.status === "paga";
      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("pagamento_mensalidade").upsert(
        {
          residente_id: args.residenteId,
          mes_referencia: args.mes,
          valor: args.valor,
          status: args.status,
          data_vencimento: args.dataVencimento ?? null,
          forma_pagamento: args.formaPagamento ?? null,
          // Ao marcar paga, registra valor/data do pagamento (se não vierem).
          valor_pago: pago ? args.valorPago ?? args.valor : args.valorPago ?? null,
          data_pagamento: pago ? args.dataPagamento ?? hoje : args.dataPagamento ?? null,
          pago_em: pago ? new Date().toISOString() : null,
          registrado_por: ADMIN_ATUAL.nome,
        },
        { onConflict: "residente_id,mes_referencia" },
      );
      if (error) throw error;
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["pagamentos-mensalidade", args.mes] }),
  });
}

// ─── Responsável financeiro (quem paga) ──────────────────────────────────────

export type ResponsavelFinanceiroInput = {
  nome: string | null;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  relacao: string | null;
};

/** Salva os dados do responsável financeiro de um hóspede (controle manual). */
export function useSalvarResponsavelFinanceiro(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ResponsavelFinanceiroInput) => {
      const { error } = await supabase
        .from("residentes")
        .update({
          resp_fin_nome: v.nome,
          resp_fin_cpf: v.cpf,
          resp_fin_email: v.email,
          resp_fin_telefone: v.telefone,
          resp_fin_relacao: v.relacao,
        })
        .eq("id", residenteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residentes"] }),
  });
}
