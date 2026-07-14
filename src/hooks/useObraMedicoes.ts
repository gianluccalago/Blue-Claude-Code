import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import { calcularMedicao, type AliquotaInput } from "@/lib/obraCalc";
import { hojeISO } from "@/lib/utils";
import type {
  Database,
  ObraAliquota,
  ObraDocMensalTipo,
  ObraDocumentoMensal,
  ObraFase,
  ObraMedicao,
  ObraMedicaoStatus,
  ObraPendencia,
  ObraRetencaoLedger,
} from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 2: medições (BM), documentos mensais (gate), ledger de
// retenções (TRP/TRD) e pendências. Movimentos de dinheiro (pagar/TRP/TRD) vão
// por RPC atômica; o resto é escrita direta (RLS master/direção no banco).
// ===========================================================================

// ── Parâmetros de contrato (para a memória de cálculo) ──────────────────────
export function useObraConfig() {
  return useQuery({
    queryKey: ["obra-config"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("obra_config").select("chave, valor");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.chave, r.valor]));
    },
  });
}

export function useObraAliquotas() {
  return useQuery({
    queryKey: ["obra-aliquotas"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ObraAliquota[]> => {
      const { data, error } = await supabase.from("obra_aliquotas").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Medições ────────────────────────────────────────────────────────────────
export function useMedicoes() {
  return useQuery({
    queryKey: ["obra-medicoes"],
    queryFn: async (): Promise<ObraMedicao[]> => {
      const { data, error } = await supabase
        .from("obra_medicoes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Etapas já comprometidas em medições não-reprovadas (não podem ser remedidas). */
export function useEtapasMedidas() {
  return useQuery({
    queryKey: ["obra-etapas-medidas"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("obra_medicao_etapas")
        .select("etapa_id, medicao:obra_medicoes!inner(status)");
      if (error) throw error;
      const bloqueadas = new Set<string>();
      for (const r of (data ?? []) as unknown as { etapa_id: string; medicao: { status: ObraMedicaoStatus } }[]) {
        if (r.medicao.status !== "Reprovado") bloqueadas.add(r.etapa_id);
      }
      return bloqueadas;
    },
  });
}

export function useDocumentosMensais() {
  return useQuery({
    queryKey: ["obra-docmes"],
    queryFn: async (): Promise<ObraDocumentoMensal[]> => {
      const { data, error } = await supabase
        .from("obra_documentos_mensais")
        .select("*")
        .order("mes", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRetencoesLedger() {
  return useQuery({
    queryKey: ["obra-retencoes"],
    queryFn: async (): Promise<ObraRetencaoLedger[]> => {
      const { data, error } = await supabase
        .from("obra_retencoes_ledger")
        .select("*")
        .order("evento_em", { ascending: true });
      // Prestador não tem policy de leitura aqui → trata erro como "sem acesso".
      if (error) return [];
      return data ?? [];
    },
  });
}

export function usePendencias() {
  return useQuery({
    queryKey: ["obra-pendencias"],
    queryFn: async (): Promise<ObraPendencia[]> => {
      const { data, error } = await supabase
        .from("obra_recebimento_pendencias")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidarMedicoes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["obra-medicoes"] });
  qc.invalidateQueries({ queryKey: ["obra-etapas-medidas"] });
  qc.invalidateQueries({ queryKey: ["obra-retencoes"] });
  qc.invalidateQueries({ queryKey: ["obra-fases"] });
}

/** Converte as alíquotas do banco para o input do cálculo. */
export function aliquotasParaCalc(aliquotas: ObraAliquota[]): AliquotaInput[] {
  return aliquotas.map((a) => ({ chave: a.chave, percentual: a.percentual, ativa: a.ativa }));
}

/**
 * Cria um BM com as etapas reivindicadas do mês. O % medido = soma dos pesos
 * das etapas; os valores (bruto, retenção, INSS, ISS, líquido) são o SNAPSHOT
 * calculado com os parâmetros vigentes.
 */
export function useCriarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      fase: ObraFase;
      mes: string;
      etapas: { id: string; peso_pct: number }[];
      precoBase: number;
      retencaoPct: number;
      aliquotas: AliquotaInput[];
    }) => {
      const percentualMedido = args.etapas.reduce((s, e) => s + e.peso_pct, 0);
      const r = calcularMedicao({
        percentualMedido,
        areaM2: args.fase.area_m2,
        precoBase: args.precoBase,
        reajustavel: args.fase.reajustavel,
        ipcaPct: args.fase.ipca_pct,
        retencaoPct: args.retencaoPct,
        aliquotas: args.aliquotas,
      });
      const inss = args.aliquotas.find((a) => a.chave === "inss");
      const iss = args.aliquotas.find((a) => a.chave === "iss");
      const { data: med, error } = await supabase
        .from("obra_medicoes")
        .insert({
          fase_id: args.fase.id,
          mes: args.mes,
          percentual_medido: percentualMedido,
          preco_m2_aplicado: r.precoM2Aplicado,
          valor_bruto: r.valorBruto,
          retencao_pct: args.retencaoPct,
          retencao_valor: r.retencaoValor,
          inss_pct: inss?.ativa ? inss.percentual : 0,
          inss_valor: r.inssValor,
          iss_pct: iss?.ativa ? iss.percentual : 0,
          iss_valor: r.issValor,
          outras_valor: r.outrasValor,
          valor_liquido: r.valorLiquido,
          registrado_por: usuarioAtual.nome,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (args.etapas.length > 0) {
        const { error: e2 } = await supabase
          .from("obra_medicao_etapas")
          .insert(args.etapas.map((e) => ({ medicao_id: med.id, etapa_id: e.id })));
        if (e2) throw e2;
      }
    },
    onSuccess: () => invalidarMedicoes(qc),
  });
}

/** Transições simples do BM (Em análise / Aprovado / Reprovado / anexar NF). */
export function useAtualizarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      status?: ObraMedicaoStatus;
      motivo?: string | null;
      nf?: File | null;
      nfNumero?: string | null;
    }) => {
      const patch: Database["public"]["Tables"]["obra_medicoes"]["Update"] = {};
      if (args.status) {
        patch.status = args.status;
        if (args.status === "Aprovado") {
          patch.data_aprovacao = hojeISO();
          patch.aprovado_por = usuarioAtual.nome;
        }
        if (args.status === "Reprovado") patch.motivo = args.motivo?.trim() || null;
      }
      if (args.nfNumero !== undefined) patch.nf_numero = args.nfNumero?.trim() || null;
      if (args.nf) {
        const path = await uploadArquivoObra(args.nf, `nf/${args.id}`);
        if (!path) throw new Error("Falha no upload da NF. Tente novamente.");
        patch.nf_url = path;
      }
      const { error } = await supabase.from("obra_medicoes").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarMedicoes(qc),
  });
}

/** Aprovar pagamento — RPC com GATE (4 documentos do mês + NF) e retenção. */
export function usePagarMedicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (medicaoId: string) => {
      const { error } = await supabase.rpc("obra_pagar_medicao", { p_medicao_id: medicaoId });
      if (error) throw error;
    },
    onSuccess: () => invalidarMedicoes(qc),
  });
}

export function useEmitirTRP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (faseId: string): Promise<number> => {
      const { data, error } = await supabase.rpc("obra_emitir_trp", { p_fase_id: faseId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => invalidarMedicoes(qc),
  });
}

export function useEmitirTRD() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (faseId: string): Promise<number> => {
      const { data, error } = await supabase.rpc("obra_emitir_trd", { p_fase_id: faseId });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      invalidarMedicoes(qc);
      qc.invalidateQueries({ queryKey: ["obra-pendencias"] });
    },
  });
}

// ── Documentos mensais ──────────────────────────────────────────────────────
export function useSubirDocumentoMensal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { mes: string; tipo: ObraDocMensalTipo; arquivo: File }) => {
      const path = await uploadArquivoObra(args.arquivo, `documentos/${args.mes}/${args.tipo}`);
      if (!path) throw new Error("Falha no upload do documento. Tente novamente.");
      const { error } = await supabase
        .from("obra_documentos_mensais")
        .upsert(
          {
            mes: args.mes,
            tipo: args.tipo,
            arquivo_url: path,
            registrado_por: usuarioAtual.nome,
          },
          { onConflict: "mes,tipo" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-docmes"] }),
  });
}

// ── Pendências (TRP → TRD) ──────────────────────────────────────────────────
export function useCriarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { faseId: string; descricao: string }) => {
      const { error } = await supabase.from("obra_recebimento_pendencias").insert({
        fase_id: args.faseId,
        descricao: args.descricao.trim(),
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-pendencias"] }),
  });
}

export function useSanarPendencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("obra_recebimento_pendencias")
        .update({ sanada: true, sanada_em: hojeISO() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-pendencias"] }),
  });
}
