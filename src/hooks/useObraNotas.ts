import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import { hojeISO } from "@/lib/utils";
import type { ObraNotaFiscal, ObraNotaFiscalItem } from "@/types/database";

// ===========================================================================
// NOTAS FISCAIS DA CONSTRUTORA — janelas de faturamento (dias 1 e 11).
// A TRÍADE emite a NF sobre os itens APROVADOS (marcos/medições) e anexa o
// PDF; nós pagamos a NF (as RPCs com gate marcam os itens como Pagos) e
// anexamos o comprovante. Tudo reversível (controle interno).
// ===========================================================================

const KEY = ["obra-notas-fiscais"];

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["obra-marcos"] });
  qc.invalidateQueries({ queryKey: ["obra-disciplinas"] });
  qc.invalidateQueries({ queryKey: ["obra-medicoes"] });
  qc.invalidateQueries({ queryKey: ["obra-retencoes"] });
}

export function useNotasFiscais() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ObraNotaFiscal[]> => {
      const { data, error } = await supabase
        .from("obra_notas_fiscais")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

/** Prestador (ou nós) emite/anexa uma NF cobrindo itens aprovados. */
export function useEmitirNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      numero: string;
      dataEmissao: string;
      valor: number;
      retencoes: number;
      observacao: string;
      arquivo: File | null;
      itens: ObraNotaFiscalItem[];
    }) => {
      if (!v.numero.trim()) throw new Error("Informe o número da nota fiscal.");
      if (!(v.valor > 0)) throw new Error("Informe o valor da nota.");
      if (v.retencoes < 0 || v.retencoes >= v.valor) throw new Error("Retenções inválidas (devem ser menores que o valor da nota).");
      if (!v.arquivo) throw new Error("Anexe o PDF da nota fiscal.");
      const path = await uploadArquivoObra(v.arquivo, `nf/${v.dataEmissao}`);
      if (!path) throw new Error("Falha no upload da NF. Tente novamente.");
      const { error } = await supabase.from("obra_notas_fiscais").insert({
        numero: v.numero.trim(),
        valor: v.valor,
        retencoes: v.retencoes,
        data_emissao: v.dataEmissao,
        arquivo_url: path,
        observacao: v.observacao.trim() || null,
        itens: v.itens,
        registrado_por: usuarioAtual.nome,
        perfil_registrador: usuarioAtual.perfil,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Exclui uma NF (prestador: só enquanto 'emitida'; nós: sempre — RLS). */
export function useExcluirNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/**
 * PAGA uma NF: cada item coberto é pago pela RPC com gate que já existe
 * (marco: entrega aprovada+ART; medição: docs do mês + NF na medição) e a
 * nota vira 'paga' com data + comprovante. Se um gate barrar, o erro aparece
 * e a nota NÃO é marcada como paga (itens já pagos ficam — é reversível).
 */
export function usePagarNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { nota: ObraNotaFiscal; dataPagamento: string; comprovante: File | null }) => {
      for (const item of v.nota.itens) {
        if (item.tipo === "marco") {
          // Pode já estar pago (pagamento direto no workspace) — tolera.
          const { data: m } = await supabase
            .from("obra_disciplina_marcos").select("status").eq("id", item.id).maybeSingle();
          if (m && m.status !== "Pago") {
            const { error } = await supabase.rpc("obra_pagar_marco", { p_marco_id: item.id });
            if (error) throw new Error(`${item.rotulo}: ${error.message}`);
          }
        } else {
          const { data: med } = await supabase
            .from("obra_medicoes").select("status").eq("id", item.id).maybeSingle();
          if (med && med.status !== "Pago") {
            // O gate da RPC exige a NF na própria medição — espelha a nota lá.
            const { error: e1 } = await supabase
              .from("obra_medicoes")
              .update({ nf_numero: v.nota.numero, nf_url: v.nota.arquivo_url })
              .eq("id", item.id);
            if (e1) throw e1;
            const { error } = await supabase.rpc("obra_pagar_medicao", { p_medicao_id: item.id });
            if (error) throw new Error(`${item.rotulo}: ${error.message}`);
          }
        }
      }
      let comprovanteUrl: string | null = null;
      if (v.comprovante) {
        try {
          comprovanteUrl = await uploadArquivoObra(v.comprovante, `nf/comprovantes/${v.dataPagamento}`);
        } catch (e) {
          // Os itens JÁ foram pagos neste ponto — o aviso precisa dizer isso.
          const detalhe = e instanceof Error ? e.message : "";
          throw new Error(`Itens pagos, mas o comprovante não subiu. ${detalhe} Anexe o comprovante na lista de notas.`);
        }
      }
      const { error: e2 } = await supabase
        .from("obra_notas_fiscais")
        .update({
          status: "paga",
          data_pagamento: v.dataPagamento,
          pago_por: usuarioAtual.nome,
          ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {}),
        })
        .eq("id", v.nota.id);
      if (e2) throw e2;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Anexa (ou troca) o comprovante de uma NF já paga. */
export function useAnexarComprovanteNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; arquivo: File }) => {
      const path = await uploadArquivoObra(v.arquivo, `nf/comprovantes/${hojeISO()}`);
      if (!path) throw new Error("Falha no upload do comprovante.");
      const { error } = await supabase
        .from("obra_notas_fiscais").update({ comprovante_url: path }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Desfaz o pagamento da NF: itens voltam a Aprovado e a nota a 'emitida'. */
export function useDesfazerPagamentoNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nota: ObraNotaFiscal) => {
      for (const item of nota.itens) {
        if (item.tipo === "marco") {
          const { data: m } = await supabase
            .from("obra_disciplina_marcos")
            .select("status, disciplina_id").eq("id", item.id).maybeSingle();
          if (m?.status === "Pago") {
            const { error } = await supabase
              .from("obra_disciplina_marcos")
              .update({ status: "Aprovado", data_pagamento: null })
              .eq("id", item.id);
            if (error) throw error;
            // Se a disciplina havia sido concluída pelo pagamento total, reabre.
            const { data: disc } = await supabase
              .from("obra_disciplinas").select("status").eq("id", m.disciplina_id).maybeSingle();
            if (disc?.status === "Concluído") {
              await supabase.from("obra_disciplinas")
                .update({ status: "Aprovado", data_conclusao: null }).eq("id", m.disciplina_id);
            }
          }
        } else {
          const { data: med } = await supabase
            .from("obra_medicoes").select("status").eq("id", item.id).maybeSingle();
          if (med?.status === "Pago") {
            const { error } = await supabase
              .rpc("obra_desfazer_pagamento_medicao", { p_medicao_id: item.id });
            if (error) throw new Error(`${item.rotulo}: ${error.message}`);
          }
        }
      }
      const { error } = await supabase
        .from("obra_notas_fiscais")
        .update({ status: "emitida", data_pagamento: null, pago_por: null, comprovante_url: null })
        .eq("id", nota.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
