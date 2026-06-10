import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ADMIN_ATUAL } from "@/data/profiles";
import { intervaloDoMes } from "@/lib/mensalidade";
import { useTurnos } from "@/hooks/useTurnos";
import type {
  PagamentoPessoal,
  StatusPagamentoPessoal,
  TipoRemuneracao,
  Usuario,
} from "@/types/database";

/** Profissionais elegíveis para remuneração: função de escala ou equipe multidisciplinar, ativos. */
export function useEquipeRemuneracao() {
  return useQuery({
    queryKey: ["equipe-remuneracao"],
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("usuarios").select("*");
      if (error) throw error;
      const lista = (data ?? []).filter((u) => u.ativo && (u.funcao || u.perfil === "multidisciplinar"));
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });
}

export type RemuneracaoInput = {
  tipoRemuneracao: TipoRemuneracao | null;
  valorMensal: number | null;
  valorPlantaoDiurno: number | null;
  valorPlantaoNoturno: number | null;
};

/** Atualiza o tipo e os valores de remuneração de um profissional. */
export function useAtualizarRemuneracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: RemuneracaoInput }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({
          tipo_remuneracao: args.valor.tipoRemuneracao,
          valor_mensal: args.valor.valorMensal,
          valor_plantao_diurno: args.valor.valorPlantaoDiurno,
          valor_plantao_noturno: args.valor.valorPlantaoNoturno,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipe-remuneracao"] });
      qc.invalidateQueries({ queryKey: ["pagamento-pessoal"] });
    },
  });
}

/** Pagamentos registrados para um mês de referência ("YYYY-MM"). */
export function usePagamentosPessoalDoMes(mes: string) {
  return useQuery({
    queryKey: ["pagamento-pessoal", mes],
    queryFn: async (): Promise<PagamentoPessoal[]> => {
      const { data, error } = await supabase.from("pagamento_pessoal").select("*").eq("mes_referencia", mes);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface LinhaPagamentoPessoal {
  profissional: Usuario;
  tipoRemuneracao: TipoRemuneracao;
  previstoDiurno: number;
  realizadoDiurno: number;
  previstoNoturno: number;
  realizadoNoturno: number;
  valorCalculado: number;
  valorFinal: number;
  status: StatusPagamentoPessoal;
  observacao: string;
  pagamento: PagamentoPessoal | undefined;
}

/**
 * Para cada profissional com remuneração definida, calcula o pagamento do
 * mês: mensal fixo usa valor_mensal; por plantão usa os turnos do mês
 * (PREVISTO = escalados, REALIZADO = com check-in e check-out) multiplicados
 * pelos valores diurno/noturno. valor_final/status/observação vêm do registro
 * salvo, com fallback para o calculado/pendente.
 */
export function useCustosPessoalDoMes(mes: string) {
  const equipe = useEquipeRemuneracao();
  const { inicio, fim } = intervaloDoMes(mes);
  const turnos = useTurnos(inicio, fim);
  const pagamentos = usePagamentosPessoalDoMes(mes);

  const isLoading = equipe.isLoading || turnos.isLoading || pagamentos.isLoading;
  const isError = equipe.isError || turnos.isError || pagamentos.isError;
  const error = equipe.error ?? turnos.error ?? pagamentos.error;

  const linhas: LinhaPagamentoPessoal[] = useMemo(() => {
    if (!equipe.data) return [];
    const pagamentoMap = new Map((pagamentos.data ?? []).map((p) => [p.profissional_id, p]));

    return equipe.data
      .filter((u): u is Usuario & { tipo_remuneracao: TipoRemuneracao } => !!u.tipo_remuneracao)
      .map((u) => {
        const pagamento = pagamentoMap.get(u.id);

        let previstoDiurno = 0;
        let realizadoDiurno = 0;
        let previstoNoturno = 0;
        let realizadoNoturno = 0;
        let valorCalculado = 0;

        if (u.tipo_remuneracao === "mensal_fixo") {
          valorCalculado = u.valor_mensal ?? 0;
        } else {
          for (const t of turnos.data ?? []) {
            if (t.profissional_id !== u.id) continue;
            const realizado = !!t.check_in && !!t.check_out;
            if (t.tag === "diurno") {
              previstoDiurno++;
              if (realizado) realizadoDiurno++;
            } else {
              previstoNoturno++;
              if (realizado) realizadoNoturno++;
            }
          }
          valorCalculado =
            realizadoDiurno * (u.valor_plantao_diurno ?? 0) + realizadoNoturno * (u.valor_plantao_noturno ?? 0);
        }

        return {
          profissional: u,
          tipoRemuneracao: u.tipo_remuneracao,
          previstoDiurno,
          realizadoDiurno,
          previstoNoturno,
          realizadoNoturno,
          valorCalculado,
          valorFinal: pagamento?.valor_final ?? valorCalculado,
          status: pagamento?.status ?? "pendente",
          observacao: pagamento?.observacao ?? "",
          pagamento,
        };
      });
  }, [equipe.data, turnos.data, pagamentos.data]);

  return { isLoading, isError, error, linhas };
}

export type SalvarPagamentoPessoalInput = {
  profissionalId: string;
  mes: string;
  tipoRemuneracao: TipoRemuneracao;
  plantoesPrevistos: number | null;
  plantoesRealizados: number | null;
  valorCalculado: number;
  valorFinal: number;
  status: StatusPagamentoPessoal;
  observacao: string | null;
};

/** Salva (upsert) o registro de pagamento de um profissional no mês. */
export function useSalvarPagamentoPessoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SalvarPagamentoPessoalInput) => {
      const { error } = await supabase.from("pagamento_pessoal").upsert(
        {
          profissional_id: args.profissionalId,
          mes_referencia: args.mes,
          tipo_remuneracao: args.tipoRemuneracao,
          plantoes_previstos: args.plantoesPrevistos,
          plantoes_realizados: args.plantoesRealizados,
          valor_calculado: args.valorCalculado,
          valor_final: args.valorFinal,
          status: args.status,
          observacao: args.observacao,
          registrado_por: ADMIN_ATUAL.nome,
        },
        { onConflict: "profissional_id,mes_referencia" },
      );
      if (error) throw error;
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["pagamento-pessoal", args.mes] }),
  });
}
