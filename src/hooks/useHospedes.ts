import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { dataISO } from "@/lib/utils";
import { turnoCorrente, dayCareNoTurno } from "@/lib/cobertura";
import type { Residente, Turno } from "@/types/database";

// ===========================================================================
// "Meus hóspedes" dos perfis de ponta — AGORA POR TURNO (0081).
//
// Antes vinha do vínculo FIXO `cuidador_residente`. Agora:
//  • CUIDADOR  → hóspedes DESIGNADOS a ele no TURNO CORRENTE (designacao_cuidado),
//    derivado do turno ATIVO dele na escala (turnos). Fora de turno → vazio.
//  • ENFERMAGEM → é a enfermeira do turno: responsável por TODOS os hóspedes
//    presentes (longa/curta sempre; day care só no diurno). Não se designa.
//
// A assinatura é a mesma de antes (cuidadorId, enabled) para não quebrar os 6
// consumidores (checklist, medicação, compromissos, intercorrência, ficha…).
// ===========================================================================

/** Escolhe o turno do profissional "para agora": ativo > próximo > mais recente. */
function escolherTurno(turnos: Turno[], agora: number): Turno | null {
  if (turnos.length === 0) return null;
  const ativo = turnos.find((t) => +new Date(t.inicio) <= agora && agora <= +new Date(t.fim));
  if (ativo) return ativo;
  const futuros = turnos
    .filter((t) => +new Date(t.inicio) > agora)
    .sort((a, b) => +new Date(a.inicio) - +new Date(b.inicio));
  if (futuros[0]) return futuros[0];
  return (
    turnos
      .filter((t) => +new Date(t.fim) < agora)
      .sort((a, b) => +new Date(b.fim) - +new Date(a.fim))[0] ?? null
  );
}

function ordenar(residentes: Residente[]): Residente[] {
  return [...residentes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function useHospedesDesignados(cuidadorId: string, enabled = true) {
  const perfil = usuarioAtual.perfil;
  return useQuery({
    queryKey: ["hospedes-turno", cuidadorId, perfil],
    enabled: enabled && !!cuidadorId,
    queryFn: async (): Promise<Residente[]> => {
      const agora = Date.now();
      const now = new Date();
      // Janela ±1 dia cobre o noturno que cruza a meia-noite.
      const ini = new Date(now); ini.setDate(ini.getDate() - 1);
      const fim = new Date(now); fim.setDate(fim.getDate() + 1);

      const { data: turnos, error: turnosErr } = await supabase
        .from("turnos")
        .select("*")
        .eq("profissional_id", cuidadorId)
        .gte("data", dataISO(ini))
        .lte("data", dataISO(fim));
      if (turnosErr) throw turnosErr;

      const turnoSel = escolherTurno(turnos ?? [], agora);
      const tag = turnoSel?.tag ?? turnoCorrente(now).tag;

      // ENFERMAGEM: responsável por TODOS os hóspedes do turno.
      if (perfil === "enfermagem") {
        let q = supabase.from("residentes").select("*").eq("status_hospede", "ativo");
        if (!dayCareNoTurno(tag)) q = q.neq("modalidade", "day_care");
        const { data, error } = await q;
        if (error) throw error;
        return ordenar(data ?? []);
      }

      // CUIDADOR: hóspedes designados a ele no turno corrente. Sem turno → vazio.
      if (!turnoSel) return [];
      const { data: desig, error: desigErr } = await supabase
        .from("designacao_cuidado")
        .select("residente_id")
        .eq("cuidador_id", cuidadorId)
        .eq("data", turnoSel.data)
        .eq("turno", turnoSel.tag);
      if (desigErr) throw desigErr;

      const ids = [...new Set((desig ?? []).map((d) => d.residente_id))];
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .in("id", ids)
        .eq("status_hospede", "ativo");
      if (error) throw error;
      return ordenar(data ?? []);
    },
  });
}
