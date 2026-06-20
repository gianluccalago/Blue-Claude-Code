import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { dayCareNoTurno, presencaDoTurno, estaPresente, type PresencaTurno } from "@/lib/cobertura";
import type { Residente, TagTurno } from "@/types/database";

// ===========================================================================
// Cobertura Assistencial — o mapa vivo de quem cuida de cada hóspede no turno.
//
// "Conversa com a escala" na LEITURA: uma designação só conta se o cuidador
// AINDA estiver escalado no turno (turnos data+tag). Quem saiu da escala deixa
// de cobrir → hóspede DESCOBERTO. Presença vem do check-in/out do turno.
// ===========================================================================

export interface PessoaTurno {
  id: string;
  nome: string;
  presenca: PresencaTurno;
}

export interface HospedeCobertura {
  residente: Residente;
  /** Cuidadores designados E ainda escalados (designação válida). */
  cuidadores: PessoaTurno[];
  /** Ninguém designado/escalado cobrindo. */
  descoberto: boolean;
  /** Coberto no papel, mas nenhum cuidador presente (escalado sem check-in). */
  risco: boolean;
}

export interface CoberturaTurno {
  enfermeiras: PessoaTurno[];
  cuidadoresEscalados: PessoaTurno[];
  hospedes: HospedeCobertura[];
  descobertos: number;
  riscos: number;
}

const KEY = (data: string, tag: TagTurno) => ["cobertura", data, tag] as const;

export function useCoberturaTurno(data: string, tag: TagTurno) {
  return useQuery({
    queryKey: KEY(data, tag),
    queryFn: async (): Promise<CoberturaTurno> => {
      const [turnosResp, residentesResp, desigResp] = await Promise.all([
        supabase.from("turnos").select("*").eq("data", data).eq("tag", tag),
        supabase.from("residentes").select("*").eq("status_hospede", "ativo"),
        supabase.from("designacao_cuidado").select("*").eq("data", data).eq("turno", tag),
      ]);
      if (turnosResp.error) throw turnosResp.error;
      if (residentesResp.error) throw residentesResp.error;
      if (desigResp.error) throw desigResp.error;

      const turnos = turnosResp.data ?? [];
      const designacoes = desigResp.data ?? [];

      // Nomes dos profissionais (escala) e cuidadores designados.
      const idsUsuarios = [
        ...new Set(
          [...turnos.map((t) => t.profissional_id), ...designacoes.map((d) => d.cuidador_id)].filter(
            (x): x is string => !!x,
          ),
        ),
      ];
      const usuarios = idsUsuarios.length
        ? (await supabase.from("usuarios").select("id, nome").in("id", idsUsuarios)).data ?? []
        : [];
      const nomeDe = (id: string) => usuarios.find((u) => u.id === id)?.nome ?? "Não informado";

      // Enfermeiras escaladas (uma por turno, responsável por todos).
      const enfermeiras: PessoaTurno[] = dedup(
        turnos
          .filter((t) => t.categoria === "enfermeiras" && t.profissional_id)
          .map((t) => ({ id: t.profissional_id as string, nome: nomeDe(t.profissional_id as string), presenca: presencaDoTurno(t) })),
      );

      // Cuidadores escalados (disponíveis para designar) + presença.
      const cuidadoresEscalados: PessoaTurno[] = dedup(
        turnos
          .filter((t) => t.categoria === "cuidadoras" && t.profissional_id)
          .map((t) => ({ id: t.profissional_id as string, nome: nomeDe(t.profissional_id as string), presenca: presencaDoTurno(t) })),
      );
      const escaladoPorId = new Map(cuidadoresEscalados.map((c) => [c.id, c]));

      // Hóspedes do turno: longa/curta sempre; day care só no diurno.
      const hospedesAtivos = (residentesResp.data ?? []).filter(
        (r) => r.modalidade !== "day_care" || dayCareNoTurno(tag),
      );

      const hospedes: HospedeCobertura[] = hospedesAtivos
        .map((residente) => {
          // Designações válidas = cuidador ainda escalado neste turno.
          const cuidadores = designacoes
            .filter((d) => d.residente_id === residente.id)
            .map((d) => escaladoPorId.get(d.cuidador_id))
            .filter((c): c is PessoaTurno => !!c);
          const descoberto = cuidadores.length === 0;
          const risco = !descoberto && !cuidadores.some((c) => estaPresente(c.presenca));
          return { residente, cuidadores, descoberto, risco };
        })
        // Descobertos primeiro; depois em risco; depois por nome.
        .sort((a, b) => {
          const peso = (h: HospedeCobertura) => (h.descoberto ? 0 : h.risco ? 1 : 2);
          return peso(a) - peso(b) || a.residente.nome.localeCompare(b.residente.nome, "pt-BR");
        });

      return {
        enfermeiras,
        cuidadoresEscalados: [...cuidadoresEscalados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        hospedes,
        descobertos: hospedes.filter((h) => h.descoberto).length,
        riscos: hospedes.filter((h) => h.risco).length,
      };
    },
  });
}

function dedup(lista: PessoaTurno[]): PessoaTurno[] {
  const m = new Map<string, PessoaTurno>();
  for (const p of lista) if (!m.has(p.id)) m.set(p.id, p);
  return [...m.values()];
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["cobertura"] });
  qc.invalidateQueries({ queryKey: ["hospedes-turno"] }); // "meus hóspedes" do cuidador
  qc.invalidateQueries({ queryKey: ["hospedes"] });
  qc.invalidateQueries({ queryKey: ["notificacoes"] });
}

export function useDesignarCuidador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; cuidadorId: string; data: string; turno: TagTurno }) => {
      const { error } = await supabase
        .from("designacao_cuidado")
        .upsert(
          {
            residente_id: args.residenteId,
            cuidador_id: args.cuidadorId,
            data: args.data,
            turno: args.turno,
            criado_por: usuarioAtual.nome,
          },
          { onConflict: "residente_id,cuidador_id,data,turno", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useRemoverDesignacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; cuidadorId: string; data: string; turno: TagTurno }) => {
      const { error } = await supabase
        .from("designacao_cuidado")
        .delete()
        .eq("residente_id", args.residenteId)
        .eq("cuidador_id", args.cuidadorId)
        .eq("data", args.data)
        .eq("turno", args.turno);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
