import { useMemo } from "react";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { statusEfetivoCobranca } from "@/lib/cobranca";
import type { PagamentoMensalidade, Residente, StatusPagamentoMensalidade } from "@/types/database";

// ===========================================================================
// FECHAMENTO DE COBRANÇA do mês — o "valor a cobrar" consolidado por
// RESPONSÁVEL FINANCEIRO (o que seria a FATURA ÚNICA daquele responsável).
//
//   valor a cobrar = mensalidade vigente + upselling do mês (medicamentos/extras)
//
// É o que a Administração usa hoje para cobrar POR FORA (manual) e o que, no
// futuro, alimentaria a cobrança automática (via uma camada de backend, ex.:
// Supabase Edge Function — inexistente neste ambiente). Reaproveita o
// useDemonstrativoMes (mensalidade + upselling + pagamento já consolidados).
// ===========================================================================

export type ItemCobranca = {
  residente: Residente;
  mensalidade: number;
  upselling: number;
  /** mensalidade + upselling do mês. */
  valorACobrar: number;
  pagamento: PagamentoMensalidade | undefined;
  statusEfetivo: StatusPagamentoMensalidade;
  vencimento: string | null;
};

export type GrupoCobranca = {
  /** Chave de agrupamento (CPF normalizado, ou nome, ou o próprio hóspede). */
  key: string;
  respNome: string;
  respCpf: string | null;
  respEmail: string | null;
  respTelefone: string | null;
  respRelacao: string | null;
  hospedes: ItemCobranca[];
  valorACobrar: number;
  /** Vencimento da fatura (o mais cedo entre os hóspedes do responsável). */
  vencimento: string | null;
  /** true se algum hóspede do responsável está vencido (inadimplência). */
  temVencida: boolean;
};

export type TotaisCobranca = {
  totalACobrar: number;
  porStatus: Record<StatusPagamentoMensalidade, { soma: number; qtd: number }>;
};

const SEM_RESP = "(sem responsável financeiro)";

function vencimentoPadrao(mes: string): string {
  return `${mes}-10`;
}

export function useFechamentoCobranca(mes: string) {
  const demo = useDemonstrativoMes(mes);

  const grupos: GrupoCobranca[] = useMemo(() => {
    const mapa = new Map<string, GrupoCobranca>();

    for (const l of demo.linhas) {
      const r = l.residente;
      const cpf = r.resp_fin_cpf?.trim();
      const nome = r.resp_fin_nome?.trim();
      const key = (cpf || nome?.toLowerCase() || `residente:${r.id}`) as string;

      const statusEfetivo = statusEfetivoCobranca(l.pagamento);
      const vencimento = l.pagamento?.data_vencimento ?? vencimentoPadrao(mes);
      const item: ItemCobranca = {
        residente: r,
        mensalidade: l.mensalidade,
        upselling: l.upselling,
        valorACobrar: l.total,
        pagamento: l.pagamento,
        statusEfetivo,
        vencimento,
      };

      const g = mapa.get(key);
      if (g) {
        g.hospedes.push(item);
        g.valorACobrar += item.valorACobrar;
        if (vencimento && (!g.vencimento || vencimento < g.vencimento)) g.vencimento = vencimento;
        if (statusEfetivo === "vencida") g.temVencida = true;
      } else {
        mapa.set(key, {
          key,
          respNome: nome || SEM_RESP,
          respCpf: r.resp_fin_cpf ?? null,
          respEmail: r.resp_fin_email ?? null,
          respTelefone: r.resp_fin_telefone ?? null,
          respRelacao: r.resp_fin_relacao ?? null,
          hospedes: [item],
          valorACobrar: item.valorACobrar,
          vencimento,
          temVencida: statusEfetivo === "vencida",
        });
      }
    }

    return [...mapa.values()].sort((a, b) => {
      // Inadimplentes (vencidas) primeiro; depois por maior valor.
      if (a.temVencida !== b.temVencida) return a.temVencida ? -1 : 1;
      return b.valorACobrar - a.valorACobrar;
    });
  }, [demo.linhas, mes]);

  const totais: TotaisCobranca = useMemo(() => {
    const base: TotaisCobranca = {
      totalACobrar: 0,
      porStatus: {
        em_aberto: { soma: 0, qtd: 0 },
        enviada: { soma: 0, qtd: 0 },
        paga: { soma: 0, qtd: 0 },
        vencida: { soma: 0, qtd: 0 },
        cancelada: { soma: 0, qtd: 0 },
      },
    };
    for (const g of grupos) {
      for (const h of g.hospedes) {
        base.totalACobrar += h.valorACobrar;
        const slot = base.porStatus[h.statusEfetivo];
        slot.soma += h.valorACobrar;
        slot.qtd += 1;
      }
    }
    return base;
  }, [grupos]);

  return {
    isLoading: demo.isLoading,
    isError: demo.isError,
    error: demo.error,
    grupos,
    totais,
  };
}
