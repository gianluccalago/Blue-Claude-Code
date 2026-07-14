import { useMemo } from "react";
import { Activity, CalendarClock, PiggyBank, ShieldAlert, Zap, FileWarning } from "lucide-react";
import { useFasesObra, useEtapasObra, useChecklistObra } from "@/hooks/useObra";
import { useMedicoes, useRetencoesLedger } from "@/hooks/useObraMedicoes";
import { useMarcos, useDisciplinas } from "@/hooks/useObraProjetos";
import { useOrdensCompra } from "@/hooks/useObraMateriais";
import { useInsumos, useNaoConformidades, useDocumentosObra } from "@/hooks/useObraTransversais";
import { ultimaVerificacaoPorEtapa, avancoFisico } from "@/lib/obra";
import { saldoRetencao } from "@/lib/obraCalc";
import { nivelPrazo, type NivelPrazo } from "@/lib/obraFinanceiro";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";

const SEMAFORO: Record<NivelPrazo, string> = { ok: "bg-success", atencao: "bg-warning", critico: "bg-destructive", neutro: "bg-muted-foreground/40" };

function somarDiasISO(baseISO: string, dias: number): string {
  const d = new Date(`${baseISO}T00:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10);
}

export function ObraPainel() {
  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const medicoes = useMedicoes();
  const marcos = useMarcos();
  const disciplinas = useDisciplinas();
  const ordens = useOrdensCompra();
  const retencoes = useRetencoesLedger();
  const insumos = useInsumos();
  const ncs = useNaoConformidades();
  const docs = useDocumentosObra();

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist.data ?? []), [checklist.data]);

  if (fases.isLoading || etapas.isLoading || medicoes.isLoading) return <LoadingState />;

  const listaFases = fases.data ?? [];
  const totalArea = listaFases.reduce((s, f) => s + f.area_m2, 0);
  const fisicoGeral = totalArea > 0
    ? listaFases.reduce((s, f) => s + avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa) * f.area_m2, 0) / totalArea
    : 0;

  const hoje = hojeISO();
  const em30 = somarDiasISO(hoje, 30);
  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
  const marcoDisc = new Map((marcos.data ?? []).map((m) => [m.id, m.disciplina_id]));

  // Próximos pagamentos (30 dias).
  const pagamentos = [
    ...(medicoes.data ?? []).filter((m) => m.status === "Aprovado").map((m) => ({ ref: `BM ${m.mes}`, valor: m.valor_liquido, venc: m.data_aprovacao ?? hoje })),
    ...(marcos.data ?? []).filter((m) => m.status === "Aprovado").map((m) => ({ ref: `${nomeDisc.get(marcoDisc.get(m.id) ?? "") ?? "?"} · ${m.rotulo}`, valor: m.valor, venc: m.data_aprovacao ?? hoje })),
    ...(ordens.data ?? []).filter((o) => (o.status === "Emitida" || o.status === "Entregue parcial") && o.previsao_entrega).map((o) => ({ ref: `${o.item} · ${o.fornecedor}`, valor: o.valor_total, venc: o.previsao_entrega! })),
  ].filter((p) => p.venc <= em30).sort((a, b) => a.venc.localeCompare(b.venc));
  const totalPagar30 = pagamentos.reduce((s, p) => s + p.valor, 0);

  const saldoRet = saldoRetencao((retencoes.data ?? []).map((r) => ({ tipo: r.tipo, valor: r.valor })));
  const ncsAbertas = (ncs.data ?? []).filter((n) => n.status !== "encerrada");
  const docsVencendo = (docs.data ?? []).filter((d) => { const n = nivelPrazo(d.data_validade, hoje, 30); return n === "critico" || n === "atencao"; });
  const insumosAlerta = (insumos.data ?? []).filter((i) => i.status !== "ok" && (nivelPrazo(i.prazo_limite, hoje, 30) === "critico" || nivelPrazo(i.prazo_limite, hoje, 30) === "atencao"));

  return (
    <div className="space-y-6 pb-8">
      {/* KPIs executivos */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icone={<Activity className="size-5" />} rotulo="Avanço físico geral" valor={`${fisicoGeral.toFixed(1)}%`} />
        <Kpi icone={<CalendarClock className="size-5" />} rotulo="A pagar em 30 dias" valor={formatarMoeda(totalPagar30)} tom="warning" />
        <Kpi icone={<PiggyBank className="size-5" />} rotulo="Retenções em mãos" valor={formatarMoeda(saldoRet)} tom="success" />
        <Kpi icone={<ShieldAlert className="size-5" />} rotulo="NCs abertas" valor={String(ncsAbertas.length)} tom={ncsAbertas.length > 0 ? "destructive" : "secondary"} />
      </div>

      {/* Avanço físico por fase */}
      <Card><CardContent className="space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Activity className="size-5 text-primary" /> Avanço físico × cronograma</h2>
        <div className="space-y-2">
          {listaFases.map((f) => {
            const av = avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa);
            const fim = f.data_fim_prevista;
            const atrasada = fim && fim < hoje && f.status === "em_andamento" && av < 100;
            return (
              <div key={f.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-secondary">{f.nome} · {f.modulos}</span>
                  <span className={cn("tabular-nums", atrasada ? "font-bold text-destructive" : "text-muted-foreground")}>
                    {av.toFixed(1)}%{fim ? ` · prev. ${formatarDataBR(fim)}` : ""}{atrasada ? " · ATRASADA" : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, av)}%` }} /></div>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      {/* Próximos pagamentos */}
      <Card><CardContent className="space-y-2 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><CalendarClock className="size-5 text-primary" /> Próximos pagamentos (30 dias)</h2>
        {pagamentos.length === 0 ? <p className="text-sm text-muted-foreground">Nada nos próximos 30 dias.</p> : (
          <div className="divide-y">
            {pagamentos.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span><span className="tabular-nums text-muted-foreground">{formatarDataBR(p.venc)}</span> · {p.ref}</span>
                <span className="font-semibold tabular-nums text-secondary">{formatarMoeda(p.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      {/* Semáforos: insumos críticos + documentos a vencer */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="space-y-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><Zap className="size-5 text-primary" /> Insumos críticos</h2>
          {(insumos.data ?? []).map((i) => {
            const n: NivelPrazo = i.status === "ok" ? "ok" : nivelPrazo(i.prazo_limite, hoje, 30);
            return (
              <div key={i.id} className="flex items-center gap-2 py-1 text-sm">
                <span className={cn("size-2.5 rounded-full", SEMAFORO[n])} />
                <span className="flex-1 text-secondary">{i.nome}</span>
                <span className="text-xs text-muted-foreground">{i.prazo_limite ? formatarDataBR(i.prazo_limite) : i.status}</span>
              </div>
            );
          })}
          {insumosAlerta.length > 0 && <p className="text-xs font-semibold text-destructive">{insumosAlerta.length} insumo(s) em alerta.</p>}
        </CardContent></Card>

        <Card><CardContent className="space-y-2 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-secondary"><FileWarning className="size-5 text-primary" /> Documentos a vencer</h2>
          {docsVencendo.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum documento vencendo.</p> : docsVencendo.map((d) => {
            const n = nivelPrazo(d.data_validade, hoje, 30);
            return (
              <div key={d.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", SEMAFORO[n])} />{d.nome}</span>
                <Badge variant={n === "critico" ? "destructive" : "warning"}>{d.data_validade ? formatarDataBR(d.data_validade) : "—"}</Badge>
              </div>
            );
          })}
        </CardContent></Card>
      </div>
    </div>
  );
}

function Kpi({ icone, rotulo, valor, tom = "secondary" }: { icone: React.ReactNode; rotulo: string; valor: string; tom?: "secondary" | "warning" | "success" | "destructive" }) {
  const cor = tom === "warning" ? "text-warning" : tom === "success" ? "text-success" : tom === "destructive" ? "text-destructive" : "text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-card", cor)}>{icone}</span>
      <div><p className={cn("text-xl font-extrabold tabular-nums", cor)}>{valor}</p><p className="text-xs text-muted-foreground">{rotulo}</p></div>
    </div>
  );
}
