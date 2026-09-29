import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  devidaNaData,
  ehPeriodica,
  pendenciasNoPlantao,
  plantaoAtualEAnterior,
  somarDias,
  ultimaExecucaoPorItem,
  type PendenciaRotina,
  type PlantaoRef,
} from "@/lib/rotina";
import type { PlanoCuidadoItem, TarefaRegistro } from "@/types/database";

// ===========================================================================
// Rotina de cuidados — dados compartilhados por checklist, contador do menu,
// aderência do Master e painel da Coordenação.
// ===========================================================================

export type RegistroHistorico = Pick<TarefaRegistro, "tarefa" | "data">;

/**
 * Registros das tarefas PERIÓDICAS (0146) no último ano até `ate` — base do
 * vencimento ("última vez que foi feita"). Sem periódicas, não consulta.
 */
export async function buscarHistoricoPeriodicas(
  itens: ReadonlyArray<Pick<PlanoCuidadoItem, "id" | "intervalo_dias">>,
  ate: string,
): Promise<RegistroHistorico[]> {
  const ids = itens.filter(ehPeriodica).map((i) => i.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("tarefa_registro")
    .select("tarefa, data")
    .in("tarefa", ids)
    .gte("data", somarDias(ate, -366))
    .lte("data", ate);
  if (error) throw error;
  return data ?? [];
}

/**
 * Só as tarefas devidas em `data`: diárias sempre; periódicas quando já
 * venceram (ou foram feitas nessa data — continuam visíveis como feitas).
 */
export function filtrarDevidas<T extends PlanoCuidadoItem>(
  itens: ReadonlyArray<T>,
  historico: ReadonlyArray<RegistroHistorico>,
  data: string,
): T[] {
  const ultimas = ultimaExecucaoPorItem(historico, data);
  return itens.filter(
    (i) => (!i.inicio_em || i.inicio_em <= data) && devidaNaData(i, ultimas.get(i.id) ?? null, data),
  );
}

/** Histórico das periódicas de um hóspede (checklist da cuidadora). */
export function useHistoricoPeriodicas(itens: PlanoCuidadoItem[] | undefined, ate: string) {
  const ids = (itens ?? []).filter(ehPeriodica).map((i) => i.id).sort();
  return useQuery({
    queryKey: ["rotina-historico", ids.join(","), ate],
    enabled: !!itens,
    queryFn: () => buscarHistoricoPeriodicas(itens ?? [], ate),
  });
}

// ─── Painel da Coordenação ────────────────────────────────────────────────────

export interface PendenciaRotinaPainel extends PendenciaRotina {
  hospede: string;
  quarto: string | null;
  /** Quem devia fazer: cuidadora(s) designada(s) no plantão, ou "Enfermagem". */
  responsaveis: string[];
}

export interface RotinaPainel {
  atual: PlantaoRef;
  anterior: PlantaoRef;
  pendenciasAtual: PendenciaRotinaPainel[];
  pendenciasAnterior: PendenciaRotinaPainel[];
}

/** O que ficou sem fazer no plantão em curso e no anterior (todos os hóspedes ativos). */
export function useRotinaPainel() {
  return useQuery({
    queryKey: ["rotina-painel"],
    refetchInterval: 5 * 60 * 1000,
    queryFn: async (): Promise<RotinaPainel> => {
      const agora = new Date();
      const { atual, anterior } = plantaoAtualEAnterior(agora);
      const [resResp, planoResp, regResp, desigResp] = await Promise.all([
        supabase.from("residentes").select("id, nome, quarto, modalidade").eq("status_hospede", "ativo"),
        supabase.from("plano_cuidado_item").select("*").eq("ativa", true),
        supabase
          .from("tarefa_registro")
          .select("tarefa, data, feito_em")
          .gte("data", anterior.dataPlantao)
          .lte("data", atual.dataPlantao),
        supabase
          .from("designacao_cuidado")
          .select("residente_id, cuidador_id, data, turno")
          .gte("data", anterior.dataPlantao)
          .lte("data", atual.dataPlantao),
      ]);
      for (const r of [resResp, planoResp, regResp, desigResp]) if (r.error) throw r.error;

      const residentes = new Map((resResp.data ?? []).map((r) => [r.id as string, r]));
      // Day Care só no diurno; hóspede inativo fica fora.
      const itensDoPlantao = (p: PlantaoRef) =>
        (planoResp.data ?? []).filter((i) => {
          const r = residentes.get(i.residente_id);
          return !!r && (r.modalidade !== "day_care" || p.tag === "diurno");
        });
      const historico = await buscarHistoricoPeriodicas(planoResp.data ?? [], atual.dataPlantao);

      const desig = desigResp.data ?? [];
      const idsCuid = [...new Set(desig.map((d) => d.cuidador_id))];
      const usuarios = idsCuid.length
        ? (await supabase.from("usuarios").select("id, nome").in("id", idsCuid)).data ?? []
        : [];
      const nomeUsuario = new Map(usuarios.map((u) => [u.id as string, u.nome as string]));

      const enriquecer = (lista: PendenciaRotina[], p: PlantaoRef): PendenciaRotinaPainel[] =>
        lista.map((x) => {
          const r = residentes.get(x.item.residente_id);
          const cuidadoras = desig
            .filter((d) => d.residente_id === x.item.residente_id && d.data === p.dataPlantao && d.turno === p.tag)
            .map((d) => nomeUsuario.get(d.cuidador_id) ?? "Cuidadora");
          return {
            ...x,
            hospede: r?.nome ?? "Hóspede",
            quarto: (r?.quarto as string | null) ?? null,
            responsaveis: x.item.responsavel === "enfermagem" ? ["Enfermagem"] : cuidadoras,
          };
        });

      const registros = regResp.data ?? [];
      return {
        atual,
        anterior,
        pendenciasAtual: enriquecer(
          pendenciasNoPlantao({ itens: itensDoPlantao(atual), registros, historico, plantao: atual, encerrado: false, agora }),
          atual,
        ),
        pendenciasAnterior: enriquecer(
          pendenciasNoPlantao({ itens: itensDoPlantao(anterior), registros, historico, plantao: anterior, encerrado: true, agora }),
          anterior,
        ),
      };
    },
  });
}
