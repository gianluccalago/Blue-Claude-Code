import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { hojeISO, inicioDoDiaISO } from "@/lib/utils";
import type {
  Administracao,
  PeriodoMedicacao,
  Prescricao,
  StatusAdministracao,
} from "@/types/database";

// ─── Helpers de baixa de estoque ─────────────────────────────────────────────

/** Extrai a quantidade inteira de uma string de dose (ex: "1,5 comprimido" → 2). */
function parsearQtdBaixa(q: string | null): number {
  if (!q) return 1;
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!m) return 1;
  return Math.ceil(parseFloat(m[1].replace(",", "."))) || 1;
}

function mesRefAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function usePrescricoes(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Administrações registradas hoje, da mais recente para a mais antiga.
 * Usada para mostrar o status persistente de cada período.
 */
export function useAdministracoesHoje(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["administracao", residenteId, hojeISO()],
    enabled: !!residenteId,
    queryFn: async (): Promise<Administracao[]> => {
      const { data, error } = await supabase
        .from("administracao")
        .select("*")
        .eq("residente_id", residenteId!)
        .gte("administrado_em", inicioDoDiaISO())
        .order("administrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutação de confirmação ───────────────────────────────────────────────────

export function useRegistrarAdministracao(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      periodo: PeriodoMedicacao;
      status: StatusAdministracao;
      itensFaltantes?: string | null;
      /**
       * Prescrições ORAIS ativas no período — passadas pelo componente para
       * evitar um round-trip extra. Usadas para calcular a baixa/estorno de estoque.
       * Sem esse campo, a baixa é omitida (compatibilidade retroativa).
       */
      prescricoesOrais?: Prescricao[];
    }) => {
      const mesRef = mesRefAtual();
      const orais = (args.prescricoesOrais ?? []).filter((p) => p.via === "oral");
      // Só há baixa quando "sim" e existem prescrições orais
      const haBaixa = args.status === "sim" && orais.length > 0;

      // ── Estorno de baixa anterior no mesmo período/dia ────────────────────
      // Quando o cuidador re-registra (ex: "Sim" → "Não"), o "Sim" anterior
      // que teve baixa_farmacia=true precisa ser revertido para manter o saldo.
      // Usamos as prescrições correntes como aproximação do que foi baixado
      // (assume que a prescrição não mudou no mesmo dia — limitação V1).
      if (orais.length > 0) {
        const { data: prevs } = await supabase
          .from("administracao")
          .select("id")
          .eq("residente_id", residenteId)
          .eq("periodo", args.periodo)
          .gte("administrado_em", inicioDoDiaISO())
          .eq("baixa_farmacia", true)
          .order("administrado_em", { ascending: false })
          .limit(1);

        const prev = prevs?.[0] ?? null;
        if (prev) {
          // Estorno: incrementa o saldo de cada medicamento de volta
          for (const p of orais) {
            const qtd = parsearQtdBaixa(p.quantidade);
            const { data: estoq } = await supabase
              .from("estoque_hospede")
              .select("id, quantidade_atual")
              .eq("residente_id", residenteId)
              .eq("medicamento", p.medicamento)
              .eq("mes_referencia", mesRef)
              .maybeSingle();
            if (estoq) {
              await supabase
                .from("estoque_hospede")
                .update({ quantidade_atual: estoq.quantidade_atual + qtd })
                .eq("id", estoq.id);
            }
          }
          // Desmarca o registro anterior para não re-estornar em rodadas futuras
          await supabase
            .from("administracao")
            .update({ baixa_farmacia: false })
            .eq("id", prev.id);
        }
      }

      // ── Inserir novo registro de administração ────────────────────────────
      const { error } = await supabase.from("administracao").insert({
        residente_id: residenteId,
        periodo: args.periodo,
        status: args.status,
        itens_faltantes: args.itensFaltantes ?? null,
        administrado_por: CUIDADOR_ATUAL.nome,
        baixa_farmacia: haBaixa,
      });
      if (error) throw error;

      // ── Baixa de estoque (best-effort — nunca bloqueia o cuidado) ─────────
      // Se não houver estoque provisionado para o medicamento no mês, a
      // administração é registrada normalmente e o saldo fica sem decremento.
      // A farmácia deve reconciliar na tela "Estoque por hóspede" (saldo negativo).
      if (haBaixa) {
        for (const p of orais) {
          const qtd = parsearQtdBaixa(p.quantidade);
          try {
            const { data: estoq } = await supabase
              .from("estoque_hospede")
              .select("id, quantidade_atual")
              .eq("residente_id", residenteId)
              .eq("medicamento", p.medicamento)
              .eq("mes_referencia", mesRef)
              .maybeSingle();

            if (estoq) {
              // Decrementa mesmo que fique negativo — farmácia reconcilia
              await supabase
                .from("estoque_hospede")
                .update({ quantidade_atual: estoq.quantidade_atual - qtd })
                .eq("id", estoq.id);
            }
            // Sem registro de estoque no mês: skip sem erro — farmácia verá divergência
          } catch (e) {
            // Baixa falhou mas a administração já foi gravada; não propagar
            console.warn(`Baixa de estoque falhou para ${p.medicamento}:`, e);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["administracao", residenteId] });
      // Atualiza o painel da farmácia caso esteja aberto em outra aba
      qc.invalidateQueries({ queryKey: ["estoque-hospede", residenteId] });
    },
  });
}
