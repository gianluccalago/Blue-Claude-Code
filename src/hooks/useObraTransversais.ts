import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import { hojeISO } from "@/lib/utils";
import type {
  Database,
  ObraAditivo,
  ObraDiario,
  ObraDocumentoObra,
  ObraEnsaio,
  ObraInsumoCritico,
  ObraNaoConformidade,
} from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 7: controles transversais (insumos críticos, ensaios,
// diário, NCs, documentos da obra, aditivos). master/direção (RLS).
// ===========================================================================

function q<T>(key: string, table: string, order: string, asc = false) {
  return useQuery({
    queryKey: [key],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase.from(table).select("*").order(order, { ascending: asc });
      if (error) return [];
      return (data ?? []) as T[];
    },
  });
}

export function useInsumos() { return q<ObraInsumoCritico>("obra-insumos", "obra_insumos_criticos", "criado_em", true); }
export function useEnsaios() { return q<ObraEnsaio>("obra-ensaios", "obra_ensaios", "data_agendada"); }
export function useDiario() { return q<ObraDiario>("obra-diario", "obra_diario", "data"); }
export function useNaoConformidades() { return q<ObraNaoConformidade>("obra-nc", "obra_nao_conformidades", "criado_em"); }
export function useDocumentosObra() { return q<ObraDocumentoObra>("obra-docs", "obra_documentos", "data_validade", true); }
export function useAditivos() { return q<ObraAditivo>("obra-aditivos", "obra_aditivos", "criado_em"); }

function inval(qc: ReturnType<typeof useQueryClient>, key: string) {
  qc.invalidateQueries({ queryKey: [key] });
}

// ── Insumos críticos ────────────────────────────────────────────────────────
export function useAtualizarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; responsavel?: string | null; prazoLimite?: string | null; status?: "pendente" | "em_andamento" | "ok" }) => {
      const patch: Database["public"]["Tables"]["obra_insumos_criticos"]["Update"] = {};
      if (args.responsavel !== undefined) patch.responsavel = args.responsavel;
      if (args.prazoLimite !== undefined) patch.prazo_limite = args.prazoLimite;
      if (args.status) patch.status = args.status;
      const { error } = await supabase.from("obra_insumos_criticos").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-insumos"),
  });
}

// ── Ensaios ───────────────────────────────────────────────────────────────
export function useCriarEnsaio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Database["public"]["Tables"]["obra_ensaios"]["Insert"]) => {
      const { error } = await supabase.from("obra_ensaios").insert({ ...args, registrado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-ensaios"),
  });
}
export function useRegistrarResultadoEnsaio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; resultado: "conforme" | "nao_conforme"; arquivo?: File | null }) => {
      const patch: Database["public"]["Tables"]["obra_ensaios"]["Update"] = { resultado: args.resultado, data_resultado: hojeISO() };
      if (args.arquivo) {
        const path = await uploadArquivoObra(args.arquivo, `ensaios/${args.id}`);
        if (!path) throw new Error("Falha no upload do resultado.");
        patch.arquivo_url = path;
      }
      const { error } = await supabase.from("obra_ensaios").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-ensaios"),
  });
}

// ── Diário ────────────────────────────────────────────────────────────────
export function useCriarDiario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { data: string; ocorrencias: string; foto?: File | null }) => {
      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadArquivoObra(args.foto, `diario/${args.data}`);
        if (!fotoUrl) throw new Error("Falha no upload da foto.");
      }
      const { error } = await supabase.from("obra_diario").insert({ data: args.data, ocorrencias: args.ocorrencias.trim(), foto_url: fotoUrl, registrado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-diario"),
  });
}

// ── Não-conformidades ────────────────────────────────────────────────────
export function useCriarNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { descricao: string; origem?: "recebimento" | "etapa" | "geral"; etapaId?: string | null; responsavel?: string; prazo?: string | null; foto?: File | null }) => {
      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadArquivoObra(args.foto, `nc/apontamento`);
        if (!fotoUrl) throw new Error("Falha no upload da foto.");
      }
      const { error } = await supabase.from("obra_nao_conformidades").insert({
        descricao: args.descricao.trim(), origem: args.origem ?? "geral", etapa_id: args.etapaId ?? null,
        responsavel: args.responsavel?.trim() || null, prazo: args.prazo ?? null,
        foto_apontamento_url: fotoUrl, registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-nc"),
  });
}
export function useAtualizarNC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status?: "aberta" | "em_correcao" | "reinspecao" | "encerrada"; fotoReinspecao?: File | null }) => {
      const patch: Database["public"]["Tables"]["obra_nao_conformidades"]["Update"] = {};
      if (args.status) { patch.status = args.status; if (args.status === "encerrada") patch.encerrada_em = hojeISO(); }
      if (args.fotoReinspecao) {
        const path = await uploadArquivoObra(args.fotoReinspecao, `nc/reinspecao`);
        if (!path) throw new Error("Falha no upload da foto.");
        patch.foto_reinspecao_url = path;
      }
      const { error } = await supabase.from("obra_nao_conformidades").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-nc"),
  });
}

// ── Documentos da obra ────────────────────────────────────────────────────
export function useCriarDocumentoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { tipo: string; nome: string; identificador?: string; dataValidade?: string | null; arquivo?: File | null }) => {
      let arquivoUrl: string | null = null;
      if (args.arquivo) {
        arquivoUrl = await uploadArquivoObra(args.arquivo, `documentos-obra/${args.tipo}`);
        if (!arquivoUrl) throw new Error("Falha no upload do documento.");
      }
      const { error } = await supabase.from("obra_documentos").insert({
        tipo: args.tipo, nome: args.nome.trim(), identificador: args.identificador?.trim() || null,
        data_validade: args.dataValidade ?? null, arquivo_url: arquivoUrl, registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-docs"),
  });
}

// ── Aditivos ──────────────────────────────────────────────────────────────
export function useCriarAditivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { numero?: string; tipo: "escopo" | "valor" | "prazo" | "misto"; descricao: string; valorDelta?: number; prazoDeltaDias?: number; faseId?: string | null; pdf?: File | null; dataAssinatura?: string | null }) => {
      let pdfUrl: string | null = null;
      if (args.pdf) {
        pdfUrl = await uploadArquivoObra(args.pdf, `aditivos`);
        if (!pdfUrl) throw new Error("Falha no upload do PDF.");
      }
      const { error } = await supabase.from("obra_aditivos").insert({
        numero: args.numero?.trim() || null, tipo: args.tipo, descricao: args.descricao.trim(),
        valor_delta: args.valorDelta ?? 0, prazo_delta_dias: args.prazoDeltaDias ?? 0,
        fase_id: args.faseId ?? null, pdf_url: pdfUrl, data_assinatura: args.dataAssinatura ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-aditivos"),
  });
}
