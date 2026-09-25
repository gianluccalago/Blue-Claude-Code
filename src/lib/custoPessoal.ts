import { horasEfetivasTurno } from "@/lib/turnos";
import type {
  PagamentoPessoal,
  StatusPagamentoPessoal,
  TipoRemuneracao,
  Turno,
  Usuario,
} from "@/types/database";

// ===========================================================================
// CUSTO DE PESSOAL — FONTE ÚNICA do card (Painel/Custos de pessoal) e do
// gráfico de evolução (FIN-04).
//
// Regra: o valor de cada profissional no mês é o SALVO em `pagamento_pessoal`
// (valor_final), com fallback para o CALCULADO (mensal fixo = valor_mensal;
// por plantão = plantões realizados × valor diurno/noturno). Antes, o card
// calculava só para profissionais ATIVOS hoje (inativar apagava o custo de
// meses passados) e o gráfico somava só o que estava salvo (meses sem
// lançamento apareciam com custo zero). Agora:
//   • ativo com remuneração definida → salvo, senão calculado;
//   • inativo (ou sem remuneração definida) → só o que foi SALVO no mês, que
//     permanece no histórico — inativar não apaga custo retroativo.
// ===========================================================================

export interface LinhaCustoPessoal {
  profissional: Usuario;
  tipoRemuneracao: TipoRemuneracao;
  previstoDiurno: number;
  realizadoDiurno: number;
  previstoNoturno: number;
  realizadoNoturno: number;
  /** Carga horária EFETIVA dos plantões realizados (12h PJ contam 11h). */
  horasEfetivas: number;
  valorCalculado: number;
  valorFinal: number;
  status: StatusPagamentoPessoal;
  observacao: string;
  pagamento: PagamentoPessoal | undefined;
  /** De onde saiu `valorFinal`: registro salvo ou cálculo automático. */
  origem: "salvo" | "calculado";
}

/** Linhas de custo de pessoal do mês (`turnos` pode cobrir um período maior — filtra por `mes`). */
export function linhasCustoPessoal(
  usuarios: Usuario[],
  turnos: Turno[],
  pagamentos: PagamentoPessoal[],
  mes: string,
): LinhaCustoPessoal[] {
  const pagamentoMap = new Map<string, PagamentoPessoal>();
  for (const p of pagamentos) if (p.mes_referencia === mes) pagamentoMap.set(p.profissional_id, p);
  const turnosMes = turnos.filter((t) => t.data.slice(0, 7) === mes);

  const linhas: LinhaCustoPessoal[] = [];
  for (const u of usuarios) {
    const pagamento = pagamentoMap.get(u.id);
    const calculavel = u.ativo && !!u.tipo_remuneracao;
    // Inativo/sem remuneração só entra se há registro salvo no mês.
    if (!calculavel && !pagamento) continue;
    const tipo: TipoRemuneracao = u.tipo_remuneracao ?? pagamento!.tipo_remuneracao;

    let previstoDiurno = 0;
    let realizadoDiurno = 0;
    let previstoNoturno = 0;
    let realizadoNoturno = 0;
    let horasEfetivas = 0;
    let valorCalculado = 0;

    if (calculavel) {
      if (tipo === "mensal_fixo") {
        valorCalculado = u.valor_mensal ?? 0;
      } else {
        for (const t of turnosMes) {
          if (t.profissional_id !== u.id) continue;
          const realizado = !!t.check_in && !!t.check_out;
          if (t.tag === "diurno") {
            previstoDiurno++;
            if (realizado) realizadoDiurno++;
          } else {
            previstoNoturno++;
            if (realizado) realizadoNoturno++;
          }
          // Carga horária efetiva: só os plantões realizados; 12h PJ contam 11h.
          if (realizado) horasEfetivas += horasEfetivasTurno(t, tipo);
        }
        valorCalculado =
          realizadoDiurno * (u.valor_plantao_diurno ?? 0) + realizadoNoturno * (u.valor_plantao_noturno ?? 0);
      }
    } else if (pagamento) {
      valorCalculado = pagamento.valor_calculado;
      previstoDiurno = pagamento.plantoes_previstos ?? 0;
      realizadoDiurno = pagamento.plantoes_realizados ?? 0;
    }

    linhas.push({
      profissional: u,
      tipoRemuneracao: tipo,
      previstoDiurno,
      realizadoDiurno,
      previstoNoturno,
      realizadoNoturno,
      horasEfetivas,
      valorCalculado,
      valorFinal: pagamento?.valor_final ?? valorCalculado,
      status: pagamento?.status ?? "pendente",
      observacao: pagamento?.observacao ?? "",
      pagamento,
      origem: pagamento ? "salvo" : "calculado",
    });
  }
  linhas.sort((a, b) => a.profissional.nome.localeCompare(b.profissional.nome, "pt-BR"));
  return linhas;
}

/** Custo total de pessoal do mês (soma dos valores finais) — mesma regra para card e gráfico. */
export function custoPessoalDoMes(
  usuarios: Usuario[],
  turnos: Turno[],
  pagamentos: PagamentoPessoal[],
  mes: string,
): number {
  return linhasCustoPessoal(usuarios, turnos, pagamentos, mes).reduce((s, l) => s + l.valorFinal, 0);
}
