import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ClipboardList, FileDown, AlertTriangle, Activity, Hospital, Plus, ExternalLink, CalendarClock, Info, Loader2,
} from "lucide-react";
import { usePatologiasPrevalentes, useRecursosSaude } from "@/hooks/usePatologias";
import { usePlanosSaude, useSalvarPlano } from "@/hooks/usePlanoSaude";
import { planoVigente, statusPlano } from "@/lib/planoSaude";
import { urlAssinadaPlano } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO, ouNaoInformado } from "@/lib/utils";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ===========================================================================
// VIGILÂNCIA SANITÁRIA · Apoio ao Plano de Atenção Integral à Saúde (RT/Master).
// RDC 502/2021 Art. 36-38. O app fornece os INSUMOS (patologias prevalentes +
// recursos por residente) e guarda o DOCUMENTO do plano (responsabilidade do RT,
// articulado com o gestor de saúde) com lembretes de revisão/avaliação.
// ===========================================================================

export function VigilanciaPlano() {
  const prevalentes = usePatologiasPrevalentes();
  const recursos = useRecursosSaude();
  const planos = usePlanosSaude();
  const [novaVersao, setNovaVersao] = useState(false);

  if (prevalentes.isLoading || recursos.isLoading || planos.isLoading) return <LoadingState />;
  if (prevalentes.isError) return <ErrorState error={prevalentes.error} />;
  if (recursos.isError) return <ErrorState error={recursos.error} />;
  if (planos.isError) return <ErrorState error={planos.error} />;

  const vigente = planoVigente(planos.data ?? []);
  const st = statusPlano(vigente);
  const resis = recursos.data ?? [];
  const semHospital = resis.filter((r) => !r.hospital_referencia).length;
  const semPlano = resis.filter((r) => !r.plano_saude_operadora).length;

  function exportarPrevalentes() {
    baixarCsv("patologias_prevalentes.csv", (prevalentes.data?.itens ?? []).map((p) => ({
      Condição: p.descricao, "Nº de hóspedes": String(p.residentes),
    })));
    toast.success("Patologias prevalentes exportadas (.csv).");
  }
  function exportarRecursos() {
    baixarCsv("recursos_saude_por_residente.csv", resis.map((r) => ({
      Hóspede: r.nome, Quarto: r.quarto ?? "Não informado",
      "Hospital de referência": r.hospital_referencia ?? "Não informado",
      "Plano de saúde": r.plano_saude_operadora ?? "Não informado",
      "Nº do plano": r.plano_saude_numero ?? "",
    })));
    toast.success("Recursos de saúde exportados (.csv).");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <ClipboardList className="size-6 text-primary" /> Plano de Atenção à Saúde — apoio
        </h2>
        <p className="text-sm text-muted-foreground">
          RDC 502/2021 Art. 36-38 · insumos do plano + documento e lembretes. O plano é elaborado pelo RT.
        </p>
      </div>

      {/* Aviso */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-secondary">
            O app <span className="font-semibold">não gera</span> o Plano de Atenção à Saúde — ele é responsabilidade
            do RT, articulado com o gestor local de saúde. Aqui ficam os <span className="font-semibold">insumos</span>
            {" "}(patologias prevalentes e recursos por residente) e o <span className="font-semibold">documento</span> do plano com os lembretes legais.
          </p>
        </CardContent>
      </Card>

      {/* Alertas de revisão/avaliação */}
      {(st.revisaoVencida || st.revisaoProxima || st.avaliacaoVencida || st.avaliacaoProxima) && (
        <Card className={cn(st.revisaoVencida || st.avaliacaoVencida ? "border-destructive/40 bg-destructive/5" : "border-warning/50 bg-warning/5")}>
          <CardContent className="space-y-1 py-3">
            {(st.revisaoVencida || st.revisaoProxima) && (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CalendarClock className={cn("size-4", st.revisaoVencida ? "text-destructive" : "text-warning")} />
                Revisão bienal (Art. 36) {st.revisaoVencida ? "VENCIDA" : "próxima"} — prevista para {formatarDataBR(vigente?.proxima_revisao ?? null)}.
              </p>
            )}
            {(st.avaliacaoVencida || st.avaliacaoProxima) && (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CalendarClock className={cn("size-4", st.avaliacaoVencida ? "text-destructive" : "text-warning")} />
                Avaliação anual (Art. 38) {st.avaliacaoVencida ? "VENCIDA" : "próxima"} — prevista para {formatarDataBR(st.proximaAvaliacao)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Patologias prevalentes */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-primary" /> Patologias prevalentes
            <span className="text-xs font-normal text-muted-foreground">(Art. 37, IV · {prevalentes.data?.totalAtivos ?? 0} hóspedes ativos)</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportarPrevalentes} disabled={(prevalentes.data?.itens ?? []).length === 0}>
            <FileDown className="size-4" /> Exportar
          </Button>
        </CardHeader>
        <CardContent>
          {(prevalentes.data?.itens ?? []).length === 0 ? (
            <EmptyState label="Nenhuma patologia registrada — registre as condições na ficha dos hóspedes." />
          ) : (
            <div className="space-y-1.5">
              {prevalentes.data!.itens.map((p, i) => {
                const pct = prevalentes.data!.totalAtivos > 0 ? Math.round((p.residentes / prevalentes.data!.totalAtivos) * 100) : 0;
                return (
                  <div key={p.descricao} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground">{i + 1}.</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-secondary">{p.descricao}</span>
                    <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-muted sm:block">
                      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{p.residentes} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recursos de saúde por residente */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hospital className="size-4 text-primary" /> Recursos de saúde por residente
            <span className="text-xs font-normal text-muted-foreground">(Art. 37, II)</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportarRecursos} disabled={resis.length === 0}>
            <FileDown className="size-4" /> Exportar
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(semHospital > 0 || semPlano > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {semHospital > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> {semHospital} sem hospital de referência</Badge>}
              {semPlano > 0 && <Badge variant="warning" className="gap-1"><AlertTriangle className="size-3" /> {semPlano} sem plano de saúde</Badge>}
            </div>
          )}
          {resis.length === 0 ? (
            <EmptyState label="Nenhum hóspede ativo." />
          ) : (
            <div className="divide-y">
              {resis.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="font-semibold text-secondary">{r.nome} <span className="text-xs font-normal text-muted-foreground">· Quarto {r.quarto ?? "—"}</span></span>
                  <span className="flex flex-wrap items-center gap-x-3 text-xs">
                    <span className={cn(!r.hospital_referencia && "text-destructive")}>
                      Hospital: {ouNaoInformado(r.hospital_referencia)}
                    </span>
                    <span className={cn(!r.plano_saude_operadora && "text-warning-foreground")}>
                      Plano: {ouNaoInformado(r.plano_saude_operadora)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documento do plano */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" /> Documento do Plano de Atenção à Saúde
          </CardTitle>
          <Button size="sm" onClick={() => setNovaVersao(true)}>
            <Plus className="size-4" /> Nova versão
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(planos.data ?? []).length === 0 ? (
            <EmptyState label="Nenhum plano registrado — anexe a versão vigente e defina a próxima revisão." />
          ) : (
            (planos.data ?? []).map((p) => <PlanoLinha key={p.id} plano={p} vigente={p.id === vigente?.id} />)
          )}
        </CardContent>
      </Card>

      {novaVersao && <ModalNovaVersao onFechar={() => setNovaVersao(false)} />}
    </div>
  );
}

function PlanoLinha({ plano: p, vigente }: { plano: import("@/types/database").PlanoAtencaoSaude; vigente: boolean }) {
  async function abrir() {
    if (!p.documento_url) return;
    const url = await urlAssinadaPlano(p.documento_url);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Não foi possível abrir o documento.");
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-secondary">
          Versão {p.versao}
          {vigente && <Badge variant="success">vigente</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          Elaborado em {formatarDataBR(p.elaborado_em)}
          {p.proxima_revisao ? ` · revisão ${formatarDataBR(p.proxima_revisao)}` : ""}
          {p.avaliacao_anual_em ? ` · última avaliação ${formatarDataBR(p.avaliacao_anual_em)}` : ""}
        </p>
        {p.observacao && <p className="mt-0.5 text-xs text-secondary/80">{p.observacao}</p>}
      </div>
      {p.documento_url && (
        <Button size="sm" variant="outline" onClick={abrir}><ExternalLink className="size-4" /> Ver documento</Button>
      )}
    </div>
  );
}

function ModalNovaVersao({ onFechar }: { onFechar: () => void }) {
  const salvar = useSalvarPlano();
  const [versao, setVersao] = useState("");
  const [elaboradoEm, setElaboradoEm] = useState(hojeISO());
  const [proximaRevisao, setProximaRevisao] = useState("");
  const [avaliacao, setAvaliacao] = useState("");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);

  async function enviar() {
    if (!versao.trim()) return toast.error("Informe a versão.");
    try {
      await salvar.mutateAsync({
        versao, elaboradoEm,
        proximaRevisao: proximaRevisao || null,
        avaliacaoAnualEm: avaliacao || null,
        observacao: obs || null,
        arquivo,
      });
      toast.success("Versão do plano registrada.");
      onFechar();
    } catch (e) {
      toast.error(erroMsg(e));
    }
  }

  return createPortal(
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg animate-modal-in overflow-y-auto rounded-lg border bg-card p-6 shadow-lifted">
        <h2 className="mb-4 text-lg font-bold text-secondary">Nova versão do plano</h2>
        <div className="space-y-3">
          <Campo label="Versão (ex.: 2026-2028)"><input value={versao} onChange={(e) => setVersao(e.target.value)} className={inputBase} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Elaborado em"><input type="date" value={elaboradoEm} onChange={(e) => setElaboradoEm(e.target.value)} className={inputBase} /></Campo>
            <Campo label="Próxima revisão (2 anos)"><input type="date" value={proximaRevisao} onChange={(e) => setProximaRevisao(e.target.value)} className={inputBase} /></Campo>
          </div>
          <Campo label="Avaliação anual em (opcional)"><input type="date" value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)} className={inputBase} /></Campo>
          <Campo label="Documento (PDF/foto, opcional)">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm" />
          </Campo>
          <Campo label="Observação (opcional)"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={`${inputBase} h-auto py-2 resize-none`} /></Campo>
          <Button className="w-full" onClick={enviar} disabled={salvar.isPending}>
            {salvar.isPending ? <><Loader2 className="size-4 animate-spin" /> Salvando…</> : "Salvar versão"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-secondary">{label}</label>
      {children}
    </div>
  );
}

function baixarCsv(nome: string, linhas: Record<string, string>[]) {
  if (linhas.length === 0) return;
  const cols = Object.keys(linhas[0]);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(";"), ...linhas.map((l) => cols.map((c) => esc(l[c] ?? "")).join(";"))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}
