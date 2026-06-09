import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Prescricao, PeriodoMedicacao, ViaMedicacao } from "@/types/database";

export type GrupoPrescricao = {
  grupoPrescricao: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string | null;
  linhas: Prescricao[];
};

/** Todas as prescrições ativas do residente, agrupadas por grupo_prescricao. */
export function usePrescricoesAtivas(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes-medico", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<GrupoPrescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .order("medicamento");
      if (error) throw error;

      const linhas: Prescricao[] = data ?? [];
      const mapaGrupo = new Map<string, GrupoPrescricao>();

      for (const l of linhas) {
        const chave = l.grupo_prescricao ?? l.id;
        if (!mapaGrupo.has(chave)) {
          mapaGrupo.set(chave, {
            grupoPrescricao: chave,
            medicamento: l.medicamento,
            dose: l.dose,
            via: l.via,
            posologia: l.posologia,
            linhas: [],
          });
        }
        mapaGrupo.get(chave)!.linhas.push(l);
      }

      return Array.from(mapaGrupo.values());
    },
  });
}

type PeriodoQuantidade = { periodo: PeriodoMedicacao; quantidade: string };

type NovaPrescricaoArgs = {
  residenteId: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string;
  periodos: PeriodoQuantidade[];
};

export function useCriarPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: NovaPrescricaoArgs) => {
      const grupoPrescricao = crypto.randomUUID();
      const linhas = args.periodos.map((p) => ({
        residente_id: args.residenteId,
        medicamento: args.medicamento,
        dose: args.dose,
        via: args.via,
        posologia: args.posologia,
        periodo: p.periodo,
        quantidade: p.quantidade,
        grupo_prescricao: grupoPrescricao,
        ativa: true,
      }));
      const { error } = await supabase.from("prescricao").insert(linhas);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}

type EditarPrescricaoArgs = {
  residenteId: string;
  grupoPrescricao: string;
  medicamento: string;
  dose: string | null;
  via: ViaMedicacao;
  posologia: string;
  periodos: PeriodoQuantidade[];
};

/** Edita um grupo: suspende as linhas antigas e cria novas com o mesmo grupo_prescricao. */
export function useEditarPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: EditarPrescricaoArgs) => {
      const { error: suspErr } = await supabase
        .from("prescricao")
        .update({ ativa: false })
        .eq("grupo_prescricao", args.grupoPrescricao);
      if (suspErr) throw suspErr;

      const linhas = args.periodos.map((p) => ({
        residente_id: args.residenteId,
        medicamento: args.medicamento,
        dose: args.dose,
        via: args.via,
        posologia: args.posologia,
        periodo: p.periodo,
        quantidade: p.quantidade,
        grupo_prescricao: args.grupoPrescricao,
        ativa: true,
      }));
      const { error } = await supabase.from("prescricao").insert(linhas);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}

/** Suspende todas as linhas do grupo (ativa=false). */
export function useSuspenderPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; grupoPrescricao: string }) => {
      const { error } = await supabase
        .from("prescricao")
        .update({ ativa: false })
        .eq("grupo_prescricao", args.grupoPrescricao);
      if (error) throw error;
    },
    onSuccess: (_, args) => {
      qc.invalidateQueries({ queryKey: ["prescricoes-medico", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes", args.residenteId] });
      qc.invalidateQueries({ queryKey: ["prescricoes-enfermagem", args.residenteId] });
    },
  });
}
