import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dataISO, combinarDataHoraISO } from "@/lib/utils";
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

/** Desloca uma data YYYY-MM-DD em `dias` (cobre noturno que cruza meia-noite). */
function deslocarDia(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

function horaBR(isoTs: string): string {
  return new Date(isoTs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Poka-yoke da escala: verifica COLISÃO DE HORÁRIO do profissional. Busca os
 * turnos dele em data±1 (cobre noturno cruzando meia-noite) e acusa qualquer
 * sobreposição de intervalo [inicio, fim). Lança erro claro se houver.
 */
async function verificarColisaoTurno(
  profissionalId: string,
  data: string,
  inicioISO: string,
  fimISO: string,
  ignorarTurnoId?: string,
): Promise<void> {
  const { data: existentes, error } = await supabase
    .from("turnos")
    .select("id, data, inicio, fim")
    .eq("profissional_id", profissionalId)
    .gte("data", deslocarDia(data, -1))
    .lte("data", deslocarDia(data, 1));
  if (error) throw error;

  const conflito = (existentes ?? []).find(
    (t) => t.id !== ignorarTurnoId && t.inicio < fimISO && t.fim > inicioISO,
  );
  if (conflito) {
    throw new Error(
      `Conflito de horário: esta profissional já tem turno das ${horaBR(conflito.inicio)} às ${horaBR(conflito.fim)} em ${new Date(conflito.data + "T00:00:00").toLocaleDateString("pt-BR")}.`,
    );
  }
}

export function useCriarTurno() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TurnoValor) => {
      // Bloqueia sobreposição de horário do mesmo profissional (qualquer categoria).
      if (v.profissional_id) {
        await verificarColisaoTurno(v.profissional_id, v.data, v.inicio, v.fim);
      }
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
      if (args.valor.profissional_id) {
        await verificarColisaoTurno(
          args.valor.profissional_id,
          args.valor.data,
          args.valor.inicio,
          args.valor.fim,
          args.id,
        );
      }
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

export interface RecorrenciaArgs {
  categoria: CategoriaTurno;
  tag: TagTurno;
  diasSemana: number[]; // 0 (Dom) .. 6 (Sáb)
  dataInicial: string; // YYYY-MM-DD
  dataFinal: string; // YYYY-MM-DD
  inicioTime: string; // HH:MM
  fimTime: string; // HH:MM
  fimDiaSeguinte: boolean;
  profissional_id: string | null;
}

export interface RecorrenciaResultado {
  criados: number;
  pulados: number;
}

/**
 * Cria turnos em lote (atalho de criação). Gera um turno individual para cada
 * dia do período que caia num dos dias da semana escolhidos. NÃO há "série
 * vinculada": os turnos gerados são comuns e independentes.
 *
 * Conflito: se houver profissional definida, pula os dias em que ela já tem
 * QUALQUER turno (evita duplicata). Se for vago, cria todos os slots.
 */
export function useCriarTurnosRecorrentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RecorrenciaArgs): Promise<RecorrenciaResultado> => {
      // 1. Datas candidatas no período que batem com os dias da semana.
      const candidatas: string[] = [];
      const ini = new Date(args.dataInicial + "T00:00:00");
      const fimD = new Date(args.dataFinal + "T00:00:00");
      for (const d = new Date(ini); d <= fimD; d.setDate(d.getDate() + 1)) {
        if (args.diasSemana.includes(d.getDay())) candidatas.push(dataISO(d));
      }

      // 2. Conflito (só quando há profissional): turnos existentes no período
      //    (estendido em ±1 dia para cobrir noturnos que cruzam meia-noite).
      //    A deduplicação é por SOBREPOSIÇÃO DE HORÁRIO, não apenas por dia.
      let existentes: { inicio: string; fim: string }[] = [];
      if (args.profissional_id) {
        const { data, error } = await supabase
          .from("turnos")
          .select("inicio, fim")
          .eq("profissional_id", args.profissional_id)
          .gte("data", deslocarDia(args.dataInicial, -1))
          .lte("data", deslocarDia(args.dataFinal, 1));
        if (error) throw error;
        existentes = data ?? [];
      }

      // 3. Monta os turnos a inserir, pulando os que colidem com algum existente.
      const novos = candidatas
        .map((dia) => ({
          profissional_id: args.profissional_id,
          categoria: args.categoria,
          data: dia,
          inicio: combinarDataHoraISO(dia, args.inicioTime, 0),
          fim: combinarDataHoraISO(dia, args.fimTime, args.fimDiaSeguinte ? 1 : 0),
          tag: args.tag,
          observacao_interna: null,
        }))
        .filter(
          (novo) =>
            !args.profissional_id ||
            !existentes.some((t) => t.inicio < novo.fim && t.fim > novo.inicio),
        );

      const pulados = candidatas.length - novos.length;
      if (novos.length > 0) {
        const { error } = await supabase.from("turnos").insert(novos);
        if (error) throw error;
      }
      return { criados: novos.length, pulados };
    },
    onSuccess: () => invalidar(qc),
  });
}
