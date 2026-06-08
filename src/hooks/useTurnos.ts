import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dataISO } from "@/lib/utils";
import type { CategoriaTurno, TagTurno, Turno } from "@/types/database";

export interface TurnoValor {
  profissional_id: string | null;
  categoria: CategoriaTurno;
  data: string; // YYYY-MM-DD
  inicio: string; // ISO
  fim: string; // ISO
  tag: TagTurno;
  observacao_interna: string | null;
}

/** Turnos cujo `data` está no intervalo [inicioISO, fimISO] (datas YYYY-MM-DD). */
export function useTurnos(inicioISO: string, fimISO: string) {
  return useQuery({
    queryKey: ["turnos", inicioISO, fimISO],
    queryFn: async (): Promise<Turno[]> => {
      const { data, error } = await supabase
        .from("turnos")
        .select("*")
        .gte("data", inicioISO)
        .lte("data", fimISO)
        .order("inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Turnos de um profissional (consulta da "Minha escala"), recentes e futuros. */
export function useMinhaEscala(profissionalId: string) {
  return useQuery({
    queryKey: ["minha-escala", profissionalId],
    queryFn: async (): Promise<Turno[]> => {
      const limite = new Date();
      limite.setDate(limite.getDate() - 14);
      const { data, error } = await supabase
        .from("turnos")
        .select("*")
        .eq("profissional_id", profissionalId)
        .gte("data", dataISO(limite))
        .order("inicio", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["turnos"] });
  qc.invalidateQueries({ queryKey: ["minha-escala"] });
}

export function useCriarTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TurnoValor) => {
      const { error } = await supabase.from("turnos").insert(v);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEditarTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: TurnoValor }) => {
      const { error } = await supabase.from("turnos").update(args.valor).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useExcluirTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("turnos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
