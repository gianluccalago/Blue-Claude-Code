import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { novaChaveIdempotencia } from "@/hooks/useMedico";
import { validarPeriodosPosologia, validarQuantidade } from "@/lib/prescricao";
import { montarTextoAdmissao, type DadosAdmissao, type MedAdmissao } from "@/lib/evolucaoAdmissao";
import type { EvolucaoAdmissao } from "@/types/database";

// ===========================================================================
// Evolução de admissão — a admissão é a FONTE: ao salvar, ALIMENTA o sistema
// (patologias, prescrição contínua, alergias, peso). Integra às tabelas
// existentes, sem duplicar. Médico cria/edita.
// ===========================================================================

export function useEvolucaoAdmissao(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["evolucao-admissao", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<EvolucaoAdmissao | null> => {
      const { data, error } = await supabase
        .from("evolucao_admissao")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/**
 * Valida as medicações contínuas ANTES de chamar a RPC (a RPC recusa de novo
 * no servidor): quantidade numérica positiva e nº de períodos coerente com a
 * posologia (CLI-05/CLI-13). Sem posologia informada mantém o padrão
 * histórico "1x/dia" (comportamento anterior) — e então a contagem também
 * precisa bater. Lança Error com a mensagem para o toast.
 */
function validarMedicacoesAdmissao(medicacoes: MedAdmissao[]) {
  for (const m of medicacoes) {
    const nome = m.medicamento.trim();
    if (!nome) continue;
    if (m.periodos.length === 0) throw new Error(`Selecione ao menos um período para ${nome}.`);
    const erroQtd = validarQuantidade(m.quantidade);
    if (erroQtd) throw new Error(`${nome}: ${erroQtd}`);
    const erroPos = validarPeriodosPosologia(m.posologia.trim() || "1x/dia", m.periodos.length);
    if (erroPos) throw new Error(`${nome}: ${erroPos}`);
  }
}

export function useSalvarEvolucaoAdmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      dados: DadosAdmissao;
      existente: EvolucaoAdmissao | null;
      /** Chave de idempotência (reaproveitada ao tentar de novo); gerada se ausente. */
      idempotencia?: string;
    }) => {
      const { residenteId, dados, existente } = args;
      validarMedicacoesAdmissao(dados.medicacoes);

      // Tudo numa ÚNICA transação no servidor (RPC registrar_admissao, 0135):
      // comorbidades, alergias, peso/altura, prescrições, documento e a
      // evolução resumida — ou grava tudo, ou nada. Médico/CRM vêm do usuário
      // autenticado no servidor. Repetir (mesma chave, ou mesmo hóspede no
      // mesmo dia) não duplica prescrições: vira edição do documento.
      const { data, error } = await supabase.rpc("registrar_admissao", {
        p: {
          residente_id: residenteId,
          existente_id: existente?.id ?? null,
          texto_evolucao: existente ? null : `EVOLUÇÃO DE ADMISSÃO\n${montarTextoAdmissao(dados)}`,
          dados: dados as unknown as Record<string, unknown>,
        },
        p_idempotencia: args.idempotencia ?? novaChaveIdempotencia(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, args) => {
      const r = args.residenteId;
      for (const key of [
        ["evolucao-admissao", r], ["patologias", r], ["patologias-prevalentes"], ["prescricoes-medico", r],
        ["prescricoes", r], ["evolucoes", r], ["residentes"], ["registros-peso", r], ["ultimo-peso", r], ["recursos-saude"],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
