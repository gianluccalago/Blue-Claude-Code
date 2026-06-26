import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dataISO } from "@/lib/utils";
import {
  contarPorGrau,
  minimoCuidadores,
  statusProporcao,
  residentesPresentesNoTurno,
  type ContagemGrau,
  type StatusProporcao,
} from "@/lib/proporcaoRh";
import type { Residente, TagTurno } from "@/types/database";

// ===========================================================================
// Verificação da proporção mínima de cuidadores (RDC 502 Art. 16) — derivada
// dos hóspedes (grau real) e da Escala (turnos categoria=cuidadoras). Conecta
// com a Cobertura Assistencial (mesma fonte de turnos). Verificação de APOIO.
// ===========================================================================

export interface ProporcaoTurno {
  contagem: ContagemGrau;
  presentes: number;
  minimo: number;
  escalado: number;
  status: StatusProporcao;
}

/** Distintos cuidadores escalados num data+tag (categoria cuidadoras). */
function escaladoDistinto(
  turnos: { profissional_id: string | null; data: string; tag: string }[],
  data: string,
  tag: TagTurno,
): number {
  const ids = new Set<string>();
  for (const t of turnos) {
    if (t.data === data && t.tag === tag && t.profissional_id) ids.add(t.profissional_id);
  }
  return ids.size;
}

export function useProporcaoTurno(data: string, tag: TagTurno) {
  return useQuery({
    queryKey: ["proporcao-turno", data, tag],
    queryFn: async (): Promise<ProporcaoTurno> => {
      const [resisResp, turnosResp] = await Promise.all([
        supabase.from("residentes").select("*").eq("status_hospede", "ativo"),
        supabase.from("turnos").select("profissional_id, data, tag").eq("data", data).eq("categoria", "cuidadoras"),
      ]);
      if (resisResp.error) throw resisResp.error;
      if (turnosResp.error) throw turnosResp.error;

      const presentes = residentesPresentesNoTurno(resisResp.data ?? [], data, tag);
      const contagem = contarPorGrau(presentes);
      const minimo = minimoCuidadores(contagem);
      const escalado = escaladoDistinto(turnosResp.data ?? [], data, tag);
      return { contagem, presentes: presentes.length, minimo, escalado, status: statusProporcao(escalado, minimo) };
    },
  });
}

export interface LinhaHistorico {
  data: string;
  tag: TagTurno;
  minimo: number;
  escalado: number;
  status: StatusProporcao;
}

export interface HistoricoProporcao {
  linhas: LinhaHistorico[];
  abaixo: number;
  total: number;
}

/**
 * Histórico: entre os turnos COM escala registrada (categoria cuidadoras) no
 * período, quantos ficaram abaixo do mínimo. Usa as datas de admissão/saída
 * para a população de cada data e o grau REAL atual (aproximação documentada).
 */
export function useHistoricoProporcao(dias = 30) {
  return useQuery({
    queryKey: ["proporcao-historico", dias],
    queryFn: async (): Promise<HistoricoProporcao> => {
      const ate = new Date();
      const de = new Date();
      de.setDate(de.getDate() - dias);
      const [resisResp, turnosResp] = await Promise.all([
        supabase.from("residentes").select("*"),
        supabase
          .from("turnos")
          .select("profissional_id, data, tag")
          .eq("categoria", "cuidadoras")
          .gte("data", dataISO(de))
          .lte("data", dataISO(ate)),
      ]);
      if (resisResp.error) throw resisResp.error;
      if (turnosResp.error) throw turnosResp.error;

      const residentes = (resisResp.data ?? []) as Residente[];
      const turnos = turnosResp.data ?? [];

      // (data, tag) distintos com escala registrada.
      const chaves = new Set<string>();
      for (const t of turnos) chaves.add(`${t.data}|${t.tag}`);

      const linhas: LinhaHistorico[] = [...chaves]
        .map((k) => {
          const [data, tag] = k.split("|") as [string, TagTurno];
          const presentes = residentesPresentesNoTurno(residentes, data, tag);
          const minimo = minimoCuidadores(contarPorGrau(presentes));
          const escalado = escaladoDistinto(turnos, data, tag);
          return { data, tag, minimo, escalado, status: statusProporcao(escalado, minimo) };
        })
        .sort((a, b) => b.data.localeCompare(a.data) || a.tag.localeCompare(b.tag));

      return { linhas, abaixo: linhas.filter((l) => l.status === "abaixo").length, total: linhas.length };
    },
  });
}
