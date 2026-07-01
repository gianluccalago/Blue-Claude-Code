import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { normalizarPatologia } from "@/lib/planoSaude";
import { hojeISO } from "@/lib/utils";
import { montarTextoAdmissao, imcDeTexto, type DadosAdmissao } from "@/lib/evolucaoAdmissao";
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

export function useSalvarEvolucaoAdmissao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; dados: DadosAdmissao; existente: EvolucaoAdmissao | null }) => {
      const { residenteId, dados, existente } = args;

      // CRM do médico autor (snapshot para o PDF).
      const { data: medico } = await supabase
        .from("usuarios")
        .select("nome, registro_profissional")
        .eq("id", usuarioAtual.id)
        .maybeSingle();
      const medicoNome = medico?.nome ?? usuarioAtual.nome;
      const medicoCrm = medico?.registro_profissional ?? null;

      // ── Comorbidades → patologia_residente (dedup; roda sempre) ───────────
      if (dados.comorbidades.length > 0) {
        const { data: jaTem } = await supabase
          .from("patologia_residente")
          .select("descricao")
          .eq("residente_id", residenteId)
          .eq("ativa", true);
        const existentes = new Set((jaTem ?? []).map((p) => normalizarPatologia(p.descricao)));
        const novas = dados.comorbidades
          .map((c) => c.trim())
          .filter((c) => c && !existentes.has(normalizarPatologia(c)));
        if (novas.length > 0) {
          await supabase.from("patologia_residente").insert(
            novas.map((descricao) => ({ residente_id: residenteId, descricao, registrado_por: medicoNome })),
          );
        }
      }

      // ── Alergias → residentes.alergias (idempotente) ──────────────────────
      if (dados.alergias.trim()) {
        await supabase.from("residentes").update({ alergias: dados.alergias.trim() }).eq("id", residenteId);
      }

      if (existente) {
        // EDIÇÃO: atualiza só o documento (não regera peso/prescrição/evolução).
        const { error } = await supabase
          .from("evolucao_admissao")
          .update({ dados: dados as unknown as Record<string, unknown>, atualizado_em: new Date().toISOString() })
          .eq("id", existente.id);
        if (error) throw error;
        return;
      }

      // ── CRIAÇÃO: integrações que só rodam uma vez ─────────────────────────
      // Peso/IMC → registro_peso. NÃO re-registra se o peso for IDÊNTICO ao
      // último já registrado (evita duplicar quando o médico usa "Usar este peso").
      const pesoKg = Number(String(dados.peso).replace(",", "."));
      const alturaM = Number(String(dados.altura).replace(",", "."));
      if (Number.isFinite(pesoKg) && pesoKg > 0) {
        const { data: ultimo } = await supabase
          .from("registro_peso")
          .select("peso_kg")
          .eq("residente_id", residenteId)
          .order("data", { ascending: false })
          .limit(1)
          .maybeSingle();
        const duplicado = !!ultimo && Math.abs(Number(ultimo.peso_kg) - pesoKg) < 0.001;
        if (!duplicado) {
          await supabase.from("registro_peso").insert({
            residente_id: residenteId,
            peso_kg: pesoKg,
            altura_m: Number.isFinite(alturaM) && alturaM > 0 ? alturaM : null,
            imc: imcDeTexto(dados.peso, dados.altura),
            data: dados.dataAdmissao || hojeISO(),
            observacao: "Peso de admissão",
            registrado_por: medicoNome,
          });
        }
        // Altura no cadastro é idempotente — atualiza mesmo se o peso for duplicado.
        if (Number.isFinite(alturaM) && alturaM > 0) {
          await supabase.from("residentes").update({ altura_m: alturaM }).eq("id", residenteId);
        }
      }

      // Medicações contínuas → prescrição REAL (segue o fluxo normal).
      let prescricoesGeradas = false;
      const linhas = dados.medicacoes
        .filter((m) => m.medicamento.trim() && m.periodos.length > 0)
        .flatMap((m) => {
          const grupo = crypto.randomUUID();
          return m.periodos.map((periodo) => ({
            residente_id: residenteId,
            medicamento: m.medicamento.trim().toUpperCase(),
            dose: m.dose.trim() || null,
            via: m.via,
            posologia: m.posologia.trim() || "1x/dia",
            periodo,
            quantidade: m.quantidade.trim() || "1",
            grupo_prescricao: grupo,
            ativa: true,
            alerta_alergia: null,
            prescrito_por: usuarioAtual.id,
          }));
        });
      if (linhas.length > 0) {
        const { error } = await supabase.from("prescricao").insert(linhas);
        if (error) throw error;
        prescricoesGeradas = true;
      }

      // Insere o documento de admissão.
      const { error: errAdm } = await supabase.from("evolucao_admissao").insert({
        residente_id: residenteId,
        dados: dados as unknown as Record<string, unknown>,
        medico_id: usuarioAtual.id,
        medico_nome: medicoNome,
        medico_crm: medicoCrm,
        data_admissao_avaliacao: dados.dataAdmissao || null,
        prescricoes_geradas: prescricoesGeradas,
      });
      if (errAdm) throw errAdm;

      // Vincula ao histórico de evoluções (resumo legível).
      await supabase.from("evolucao").insert({
        residente_id: residenteId,
        texto: `EVOLUÇÃO DE ADMISSÃO\n${montarTextoAdmissao(dados)}`,
        registrado_por: medicoNome,
      });
    },
    onSuccess: (_d, args) => {
      const r = args.residenteId;
      for (const key of [
        ["evolucao-admissao", r], ["patologias", r], ["patologias-prevalentes"], ["prescricoes-medico", r],
        ["prescricoes", r], ["evolucoes", r], ["residentes"], ["pesos", r], ["recursos-saude"],
      ]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}
