import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarRange, Pencil, X, HardHat, DraftingCompass, AlarmClock, ZoomIn, ZoomOut,
  Activity, AlertTriangle, Flag, CheckCircle2, Link2, Table2, GanttChartSquare, Users, Anchor,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra, useEtapasObra, useChecklistObra, useAtualizarFaseCronograma } from "@/hooks/useObra";
import { useDisciplinas, useRedefinirBaseline } from "@/hooks/useObraProjetos";
import { useOrdensCompra } from "@/hooks/useObraMateriais";
import { useInsumos, useEnsaios, useDocumentosObra } from "@/hooks/useObraTransversais";
import { ultimaVerificacaoPorEtapa, avancoFisico } from "@/lib/obra";
import {
  janelaGantt,
  posPct,
  larguraPct,
  mesesDaJanela,
  somarDias,
  statusBarraFase,
  statusBarraDisciplina,
  planejamentoEfetivo,
  desvioDias,
  type StatusGantt,
  type JanelaGantt,
} from "@/lib/obraGantt";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { formatarMoeda } from "@/lib/mensalidade";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraFase, ObraDisciplina } from "@/types/database";

// ===========================================================================
// MÓDULO OBRA · CRONOGRAMA — Gantt executivo (master/direção).
// Linha do tempo com coluna de rótulos FIXA na rolagem, zoom, KPIs, tooltip
// rico, barras com progresso + atraso hachurado, plano (baseline) sob o real,
// disciplinas de projeto e marcos de prazo. Datas previstas editáveis aqui.
// ===========================================================================

const STATUS_LABEL: Record<StatusGantt, string> = {
  concluida: "Concluída", andamento: "Em andamento", atrasada: "Atrasada", prevista: "Prevista",
};
// Cor por STATUS (estado, não série) — legenda sempre com rótulo junto.
const COR_SOLIDA: Record<StatusGantt, string> = {
  concluida: "bg-success", andamento: "bg-primary", atrasada: "bg-destructive", prevista: "bg-muted-foreground/50",
};
const COR_TRILHA: Record<StatusGantt, string> = {
  concluida: "bg-success/15", andamento: "bg-primary/15", atrasada: "bg-destructive/15", prevista: "bg-muted-foreground/10",
};
const BADGE_STATUS: Record<StatusGantt, "success" | "default" | "destructive" | "muted"> = {
  concluida: "success", andamento: "default", atrasada: "destructive", prevista: "muted",
};

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const ZOOMS = [56, 84, 128] as const; // px por mês
const COL_ROTULO = 248; // largura da coluna fixa de rótulos

interface Tooltip {
  x: number;
  y: number;
  titulo: string;
  status?: StatusGantt;
  linhas: string[];
}

export function ObraCronograma() {
  const { usuarioEfetivo } = useAuth();
  const podeEditar = usuarioEfetivo?.perfil === "master" || usuarioEfetivo?.perfil === "direcao";

  const fases = useFasesObra();
  const etapas = useEtapasObra();
  const checklist = useChecklistObra();
  const disciplinas = useDisciplinas();
  const insumos = useInsumos();
  const ensaios = useEnsaios();
  const docs = useDocumentosObra();
  const ordens = useOrdensCompra();

  const redefinirBaseline = useRedefinirBaseline();
  const [editando, setEditando] = useState<ObraFase | null>(null);
  const [zoom, setZoom] = useState(1); // índice em ZOOMS
  const [visao, setVisao] = useState<"gantt" | "tabela">("gantt");
  const [confirmandoBaseline, setConfirmandoBaseline] = useState(false);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const hojeRef = useRef<HTMLSpanElement>(null);
  const hoje = hojeISO();

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist.data ?? []), [checklist.data]);

  // Centraliza a visão em HOJE ao abrir e ao mudar o zoom (a janela pode
  // atravessar anos — abrir no começo dela esconde o presente).
  const pronto = !fases.isLoading && !disciplinas.isLoading;
  useEffect(() => {
    if (pronto) hojeRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pronto, zoom]);

  if (fases.isLoading || disciplinas.isLoading) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaFases = [...(fases.data ?? [])].sort((a, b) => a.numero - b.numero);
  // Agendamento automático: predecessoras podem EMPURRAR o início das
  // sucessoras — as barras e a tabela usam o plano EFETIVO.
  const efetivo = planejamentoEfetivo(disciplinas.data ?? []);
  const nomeDisc = new Map((disciplinas.data ?? []).map((d) => [d.id, d.nome]));
  const listaDisc = (disciplinas.data ?? [])
    .filter((d) => d.data_base)
    .sort((a, b) => (efetivo.get(a.id)?.inicio ?? a.data_base!).localeCompare(efetivo.get(b.id)?.inicio ?? b.data_base!));
  const discSemData = (disciplinas.data ?? []).length - listaDisc.length;

  // ── Marcos de prazo (losangos) ──
  const marcosPrazo = [
    ...(insumos.data ?? [])
      .filter((i) => i.status !== "ok" && i.prazo_limite)
      .map((i) => ({ chave: `ins-${i.id}`, rotulo: i.nome, tipo: "Insumo crítico", data: i.prazo_limite! })),
    ...(docs.data ?? [])
      .filter((d) => d.data_validade)
      .map((d) => ({ chave: `doc-${d.id}`, rotulo: d.nome, tipo: "Vencimento de documento", data: d.data_validade! })),
    ...(ensaios.data ?? [])
      .filter((e) => e.resultado === "pendente" && e.data_agendada)
      .map((e) => ({ chave: `ens-${e.id}`, rotulo: `${e.tipo}${e.referencia ? ` · ${e.referencia}` : ""}`, tipo: "Ensaio agendado", data: e.data_agendada! })),
    ...(ordens.data ?? [])
      .filter((o) => (o.status === "Emitida" || o.status === "Entregue parcial") && o.previsao_entrega)
      .map((o) => ({ chave: `oc-${o.id}`, rotulo: `${o.item} · ${o.fornecedor}`, tipo: "Entrega de material (OC)", data: o.previsao_entrega! })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  // ── Janela e escala ──
  const janela = janelaGantt(
    [
      ...listaFases.flatMap((f) => [f.data_inicio, f.data_inicio_prevista, f.data_fim_prevista, f.data_trp, f.data_trd]),
      ...listaDisc.flatMap((d) => [
        efetivo.get(d.id)?.inicio ?? d.data_base,
        efetivo.get(d.id)?.fim ?? (d.prazo_dias != null ? somarDias(d.data_base!, d.prazo_dias) : null),
        d.baseline_inicio, d.baseline_fim, d.data_conclusao,
      ]),
      ...marcosPrazo.map((m) => m.data),
    ],
    hoje,
  );
  const meses = mesesDaJanela(janela);
  const larguraLinha = meses.length * ZOOMS[zoom];

  // ── KPIs do cronograma ──
  const avPorFase = new Map(
    listaFases.map((f) => [f.id, avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa)]),
  );
  const totalArea = listaFases.reduce((s, f) => s + f.area_m2, 0);
  const avGeral = totalArea > 0
    ? listaFases.reduce((s, f) => s + (avPorFase.get(f.id) ?? 0) * f.area_m2, 0) / totalArea
    : 0;
  const fasesAtrasadas = listaFases.filter((f) => statusBarraFase(f, hoje) === "atrasada").length;
  // Status pelo plano EFETIVO (empurrado pelas predecessoras, quando houver).
  const statusDisc = (d: ObraDisciplina): StatusGantt =>
    statusBarraDisciplina({ ...d, data_base: efetivo.get(d.id)?.inicio ?? d.data_base }, hoje);
  const discAtrasadas = listaDisc.filter((d) => statusDisc(d) === "atrasada").length;
  const marcosVencidos = marcosPrazo.filter((m) => m.data < hoje).length;

  const nenhumaDataFase = listaFases.every((f) => !f.data_inicio && !f.data_inicio_prevista && !f.data_fim_prevista);

  // Tooltip posicionado em relação à ÁREA VISÍVEL (não rola junto).
  function mostrarTooltip(e: React.MouseEvent, t: Omit<Tooltip, "x" | "y">) {
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.min(e.clientX - box.left + 14, box.width - 260);
    const y = Math.max(e.clientY - box.top - 8, 8);
    setTooltip({ x, y, ...t });
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho + KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><CalendarRange className="size-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Cronograma</h1>
            <p className="text-xs text-muted-foreground">Plano × realizado — fases, projetos e prazos.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiMini icone={<Activity className="size-4" />} rotulo="Avanço geral" valor={`${avGeral.toFixed(1)}%`} />
          <KpiMini icone={<HardHat className="size-4" />} rotulo="Fases atrasadas" valor={String(fasesAtrasadas)} alerta={fasesAtrasadas > 0} />
          <KpiMini icone={<DraftingCompass className="size-4" />} rotulo="Projetos atrasados" valor={String(discAtrasadas)} alerta={discAtrasadas > 0} />
          <KpiMini icone={<AlarmClock className="size-4" />} rotulo="Marcos vencidos" valor={String(marcosVencidos)} alerta={marcosVencidos > 0} />
        </div>
      </div>

      {nenhumaDataFase && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-secondary">
          Nenhuma fase tem datas ainda. Passe o mouse sobre a fase e use o lápis para definir <span className="font-semibold">início e fim previstos</span> — o plano aparece na hora.
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Toolbar: legenda + zoom */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(STATUS_LABEL) as StatusGantt[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-5 rounded-sm", COR_SOLIDA[s])} /> {STATUS_LABEL[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rotate-45 border border-card bg-secondary" /> Marco
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-1 w-5 rounded-full bg-secondary/25" /> Linha de base
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="size-3" /> Amarrada à predecessora
            </span>
          </div>
          <div className="flex items-center gap-1">
            {podeEditar && visao === "tabela" && (
              <Button size="sm" variant="outline" onClick={() => setConfirmandoBaseline(true)} title="Congela o plano vigente como nova referência de desvios">
                <Anchor className="size-3.5" /> Redefinir linha de base
              </Button>
            )}
            <div className="mr-1 flex overflow-hidden rounded-md border border-input">
              <button onClick={() => setVisao("gantt")} title="Gráfico de Gantt"
                className={cn("px-2 py-1.5", visao === "gantt" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-secondary")}>
                <GanttChartSquare className="size-4" />
              </button>
              <button onClick={() => setVisao("tabela")} title="Tabela de controle"
                className={cn("px-2 py-1.5", visao === "tabela" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-secondary")}>
                <Table2 className="size-4" />
              </button>
            </div>
            {visao === "gantt" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} title="Diminuir zoom"><ZoomOut className="size-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} title="Aumentar zoom"><ZoomIn className="size-4" /></Button>
              </>
            )}
          </div>
        </div>

        <CardContent className="p-0">
          {visao === "tabela" ? (
            <TabelaControle
              disciplinas={listaDisc}
              efetivo={efetivo}
              nomeDisc={nomeDisc}
              statusDisc={statusDisc}
            />
          ) : (
          <div ref={areaRef} className="relative" onMouseLeave={() => setTooltip(null)}>
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${larguraLinha + COL_ROTULO}px` }} className="pb-3">
                {/* ── Régua de meses ── */}
                <div className="flex border-b bg-card">
                  <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: COL_ROTULO }} />
                  <div className="relative h-9 flex-1">
                    {meses.map((m, i) => {
                      const [ano, mes] = m.split("-").map(Number);
                      return (
                        <div key={m} className="absolute inset-y-0 flex items-center border-l border-border/60 pl-1.5" style={{ left: `${posPct(m, janela)}%` }}>
                          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {MESES_CURTO[mes - 1]}
                            {(mes === 1 || i === 0) && <span className="ml-0.5 text-[10px] font-bold text-secondary">{String(ano).slice(2)}</span>}
                          </span>
                        </div>
                      );
                    })}
                    <span
                      ref={hojeRef}
                      className="absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground shadow-card"
                      style={{ left: `${posPct(hoje, janela)}%` }}
                    >
                      Hoje
                    </span>
                  </div>
                </div>

                {/* ── Fases ── */}
                <TituloSecao icone={<HardHat className="size-4" />} titulo="Obra física" subtitulo={`${listaFases.length} fases`} />
                {listaFases.map((f) => {
                  const status = statusBarraFase(f, hoje);
                  const av = avPorFase.get(f.id) ?? 0;
                  const inicio = f.data_inicio ?? f.data_inicio_prevista;
                  const fim = f.data_fim_prevista ?? f.data_trd ?? f.data_trp ?? (f.data_inicio ? hoje : null);
                  const temPlano = !!(f.data_inicio_prevista && f.data_fim_prevista);
                  const atrasoDias = status === "atrasada" && f.data_fim_prevista
                    ? Math.round((Date.parse(hoje) - Date.parse(f.data_fim_prevista)) / 86_400_000) : 0;
                  return (
                    <Linha
                      key={f.id}
                      altura="h-12"
                      janela={janela}
                      meses={meses}
                      hoje={hoje}
                      rotulo={
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={cn("size-2 shrink-0 rounded-full", COR_SOLIDA[status])} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-secondary">{f.nome} <span className="font-normal text-muted-foreground">· {f.modulos}</span></p>
                            <p className="truncate text-[11px] tabular-nums text-muted-foreground">
                              {av.toFixed(1)}% físico{fim ? ` · até ${formatarDataBR(fim)}` : " · sem datas"}
                            </p>
                          </div>
                          {podeEditar && (
                            <button onClick={() => setEditando(f)} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100" title="Editar datas previstas">
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                        </div>
                      }
                    >
                      {/* Plano (baseline) sob a barra real */}
                      {temPlano && (
                        <div
                          className="absolute top-[7px] h-1.5 rounded-full bg-secondary/25"
                          style={{ left: `${posPct(f.data_inicio_prevista!, janela)}%`, width: `${Math.max(0.5, larguraPct(f.data_inicio_prevista!, f.data_fim_prevista!, janela))}%` }}
                        />
                      )}
                      {inicio && fim && fim > inicio ? (
                        <div
                          className={cn("absolute top-[14px] h-6 cursor-default overflow-hidden rounded-md shadow-sm", COR_TRILHA[status], status === "prevista" && "border border-dashed border-muted-foreground/40")}
                          style={{ left: `${posPct(inicio, janela)}%`, width: `${Math.max(1, larguraPct(inicio, fim, janela))}%` }}
                          onMouseMove={(e) => mostrarTooltip(e, {
                            titulo: `${f.nome} — ${f.modulos}`,
                            status,
                            linhas: [
                              `Avanço físico: ${av.toFixed(1)}%`,
                              f.data_inicio_prevista || f.data_fim_prevista
                                ? `Previsto: ${f.data_inicio_prevista ? formatarDataBR(f.data_inicio_prevista) : "?"} → ${f.data_fim_prevista ? formatarDataBR(f.data_fim_prevista) : "?"}`
                                : "Sem plano definido",
                              f.data_inicio ? `Início real: ${formatarDataBR(f.data_inicio)}` : "Não iniciada",
                              ...(f.data_trp ? [`TRP: ${formatarDataBR(f.data_trp)}`] : []),
                              ...(f.data_trd ? [`TRD: ${formatarDataBR(f.data_trd)}`] : []),
                              ...(atrasoDias > 0 ? [`${atrasoDias} dia(s) além do fim previsto`] : []),
                            ],
                          })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <div
                            className={cn("flex h-full items-center rounded-l-md pl-2", status === "andamento" ? "bg-brand-gradient" : COR_SOLIDA[status])}
                            style={{ width: `${Math.min(100, av)}%` }}
                          >
                            {av >= 12 && <span className="text-[10px] font-extrabold tabular-nums text-white drop-shadow-sm">{av.toFixed(0)}%</span>}
                          </div>
                        </div>
                      ) : inicio ? (
                        <Marco dataISO={inicio} janela={janela} />
                      ) : null}
                      {/* Extensão hachurada do atraso (fim previsto → hoje) */}
                      {status === "atrasada" && f.data_fim_prevista && (
                        <div
                          className="absolute top-[14px] h-6 rounded-r-md opacity-70"
                          style={{
                            left: `${posPct(f.data_fim_prevista, janela)}%`,
                            width: `${Math.max(0.4, larguraPct(f.data_fim_prevista, hoje, janela))}%`,
                            backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--destructive)) 0 4px, transparent 4px 8px)",
                          }}
                        />
                      )}
                      {/* Bandeiras TRP/TRD */}
                      {f.data_trp && <Bandeira dataISO={f.data_trp} janela={janela} rotulo="TRP" />}
                      {f.data_trd && <Bandeira dataISO={f.data_trd} janela={janela} rotulo="TRD" />}
                    </Linha>
                  );
                })}

                {/* ── Disciplinas ── */}
                {listaDisc.length > 0 && (
                  <>
                    <TituloSecao
                      icone={<DraftingCompass className="size-4" />}
                      titulo="Projetos complementares"
                      subtitulo={`${listaDisc.length} com data-base${discSemData > 0 ? ` · ${discSemData} sem data-base (defina em Projetos)` : ""}`}
                    />
                    {listaDisc.map((d) => {
                      const status = statusDisc(d);
                      const plano = efetivo.get(d.id);
                      const inicio = plano?.inicio ?? d.data_base!;
                      const fim = plano?.fim ?? (d.prazo_dias != null ? somarDias(inicio, d.prazo_dias) : null);
                      const desvio = desvioDias(d, fim);
                      const empurrada = !!plano?.empurradaPor;
                      const temBaseline = !!(d.baseline_inicio && d.baseline_fim);
                      return (
                        <Linha
                          key={d.id}
                          altura="h-10"
                          janela={janela}
                          meses={meses}
                          hoje={hoje}
                          rotulo={
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className={cn("size-1.5 shrink-0 rounded-full", COR_SOLIDA[status])} />
                              <p className="truncate text-xs font-medium text-secondary">{d.nome}</p>
                              {d.predecessora_id && <Link2 className="size-3 shrink-0 text-primary" />}
                              {status === "concluida" && <CheckCircle2 className="size-3 shrink-0 text-success" />}
                            </div>
                          }
                        >
                          {/* Linha de base (plano congelado) — barra fina cinza */}
                          {temBaseline && (
                            <div
                              className="absolute top-[4px] h-1 rounded-full bg-secondary/25"
                              style={{ left: `${posPct(d.baseline_inicio!, janela)}%`, width: `${Math.max(0.5, larguraPct(d.baseline_inicio!, d.baseline_fim!, janela))}%` }}
                            />
                          )}
                          {fim ? (
                            <div
                              className={cn("absolute top-[11px] h-[18px] cursor-default overflow-hidden rounded", COR_TRILHA[status], status === "prevista" && "border border-dashed border-muted-foreground/40")}
                              style={{ left: `${posPct(inicio, janela)}%`, width: `${Math.max(0.8, larguraPct(inicio, fim, janela))}%` }}
                              onMouseMove={(e) => mostrarTooltip(e, {
                                titulo: d.nome,
                                status,
                                linhas: [
                                  `Progresso: ${d.progresso_pct}%`,
                                  `Status contratual: ${d.status}`,
                                  `Atual: ${formatarDataBR(inicio)} → ${formatarDataBR(fim)} (${d.prazo_dias}d)`,
                                  empurrada ? `Início empurrado pela predecessora: ${nomeDisc.get(plano!.empurradaPor!) ?? "?"}` : "",
                                  d.predecessora_id && !empurrada ? `Predecessora: ${nomeDisc.get(d.predecessora_id) ?? "?"}` : "",
                                  temBaseline ? `Linha de base: ${formatarDataBR(d.baseline_inicio!)} → ${formatarDataBR(d.baseline_fim!)}` : "",
                                  desvio != null && desvio !== 0 ? `Desvio da linha de base: ${desvio > 0 ? "+" : ""}${desvio} dia(s)` : desvio === 0 ? "Sem desvio da linha de base" : "",
                                  d.recursos ? `Recursos: ${d.recursos}` : "",
                                  d.data_conclusao ? `Concluída em ${formatarDataBR(d.data_conclusao)}` : "",
                                ].filter(Boolean),
                              })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {/* Preenchimento = progresso da atividade */}
                              <div className={cn("h-full rounded-l", COR_SOLIDA[status])} style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
                            </div>
                          ) : (
                            <Marco dataISO={inicio} janela={janela} />
                          )}
                          {d.data_conclusao && (
                            <span
                              className="absolute top-[10px] z-10 size-5 -translate-x-1/2 rounded-full border-2 border-card bg-success shadow-sm"
                              style={{ left: `${posPct(d.data_conclusao, janela)}%` }}
                            />
                          )}
                        </Linha>
                      );
                    })}
                  </>
                )}

                {/* ── Marcos de prazo ── */}
                {marcosPrazo.length > 0 && (
                  <>
                    <TituloSecao icone={<AlarmClock className="size-4" />} titulo="Prazos e marcos" subtitulo="insumos · documentos · ensaios · entregas" />
                    {marcosPrazo.map((m) => (
                      <Linha
                        key={m.chave}
                        altura="h-8"
                        janela={janela}
                        meses={meses}
                        hoje={hoje}
                        rotulo={
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {m.data < hoje ? <AlertTriangle className="size-3 shrink-0 text-destructive" /> : <span className="size-1.5 shrink-0 rounded-full bg-secondary/40" />}
                            <p className="truncate text-xs text-secondary">{m.rotulo}</p>
                          </div>
                        }
                      >
                        <div
                          className="absolute inset-y-0 cursor-default"
                          style={{ left: `${posPct(m.data, janela)}%` }}
                          onMouseMove={(e) => mostrarTooltip(e, { titulo: m.rotulo, linhas: [m.tipo, `${formatarDataBR(m.data)}${m.data < hoje ? " — VENCIDO" : ""}`] })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-card shadow-sm", m.data < hoje ? "bg-destructive" : "bg-secondary")} />
                        </div>
                      </Linha>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Tooltip flutuante */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-30 w-64 animate-fade-in rounded-lg border bg-card p-3 shadow-lifted"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-xs font-bold leading-tight text-secondary">{tooltip.titulo}</p>
                  {tooltip.status && <Badge variant={BADGE_STATUS[tooltip.status]} className="shrink-0 text-[10px]">{STATUS_LABEL[tooltip.status]}</Badge>}
                </div>
                {tooltip.linhas.map((l, i) => (
                  <p key={i} className="text-[11px] leading-snug text-muted-foreground">{l}</p>
                ))}
              </div>
            )}
          </div>
          )}
        </CardContent>
      </Card>

      {editando && <ModalCronogramaFase fase={editando} onFechar={() => setEditando(null)} />}

      <ConfirmDialog
        aberto={confirmandoBaseline}
        titulo="Redefinir a linha de base?"
        descricao="O plano vigente (datas atuais, já com os empurrões de predecessoras aplicados às datas-base) vira a nova referência — os desvios passam a ser medidos contra ele. A linha de base anterior é substituída."
        textoConfirmar="Redefinir"
        onConfirmar={() => {
          setConfirmandoBaseline(false);
          redefinirBaseline.mutate(undefined, {
            onSuccess: (n) => toast.success(`Linha de base redefinida para ${n} atividade(s).`),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao redefinir."),
          });
        }}
        onCancelar={() => setConfirmandoBaseline(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABELA DE CONTROLE — desvios, custos e recursos (sugestão da TRÍADE)
// ---------------------------------------------------------------------------

function TabelaControle({ disciplinas, efetivo, nomeDisc, statusDisc }: {
  disciplinas: ObraDisciplina[];
  efetivo: ReturnType<typeof planejamentoEfetivo>;
  nomeDisc: Map<string, string>;
  statusDisc: (d: ObraDisciplina) => StatusGantt;
}) {
  const comValor = disciplinas.filter((d) => d.valor > 0);
  const totalValor = comValor.reduce((s, d) => s + d.valor, 0);

  // Resumo de recursos/equipes (vinculado ao cronograma).
  const porRecurso = new Map<string, { atividades: number; valor: number; inicio: string | null; fim: string | null }>();
  for (const d of disciplinas) {
    if (!d.recursos) continue;
    const plano = efetivo.get(d.id);
    const r = porRecurso.get(d.recursos) ?? { atividades: 0, valor: 0, inicio: null, fim: null };
    r.atividades += 1;
    r.valor += d.valor;
    if (plano?.inicio && (!r.inicio || plano.inicio < r.inicio)) r.inicio = plano.inicio;
    if (plano?.fim && (!r.fim || plano.fim > r.fim)) r.fim = plano.fim;
    porRecurso.set(d.recursos, r);
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-2">Atividade</th>
              <th className="pb-2 pr-2">Predecessora</th>
              <th className="pb-2 pr-2">Linha de base</th>
              <th className="pb-2 pr-2">Atual (efetivo)</th>
              <th className="pb-2 pr-2 text-right">Desvio</th>
              <th className="pb-2 pr-2 text-right">Dur.</th>
              <th className="pb-2 pr-2 text-right">Progr.</th>
              <th className="pb-2 pr-2">Recursos</th>
              <th className="pb-2 text-right">Custo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {disciplinas.map((d) => {
              const plano = efetivo.get(d.id);
              const inicio = plano?.inicio ?? d.data_base;
              const fim = plano?.fim ?? null;
              const desvio = desvioDias(d, fim);
              const status = statusDisc(d);
              return (
                <tr key={d.id} className="align-top">
                  <td className="max-w-56 py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("size-1.5 shrink-0 rounded-full", COR_SOLIDA[status])} />
                      <span className="font-medium text-secondary">{d.nome}</span>
                    </span>
                  </td>
                  <td className="max-w-40 py-2 pr-2 text-xs text-muted-foreground">
                    {d.predecessora_id ? (
                      <span className="inline-flex items-center gap-1"><Link2 className="size-3 text-primary" /> {nomeDisc.get(d.predecessora_id) ?? "?"}</span>
                    ) : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs tabular-nums text-muted-foreground">
                    {d.baseline_inicio && d.baseline_fim ? `${formatarDataBR(d.baseline_inicio)} → ${formatarDataBR(d.baseline_fim)}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-2 text-xs tabular-nums text-secondary">
                    {inicio && fim ? (
                      <>
                        {formatarDataBR(inicio)} → {formatarDataBR(fim)}
                        {plano?.empurradaPor && <Link2 className="ml-1 inline size-3 text-primary" />}
                      </>
                    ) : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {desvio == null ? <span className="text-xs text-muted-foreground">—</span> : (
                      <Badge variant={desvio > 0 ? "destructive" : desvio < 0 ? "success" : "muted"} className="tabular-nums">
                        {desvio > 0 ? `+${desvio}d` : desvio < 0 ? `${desvio}d` : "0d"}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right text-xs tabular-nums text-muted-foreground">{d.prazo_dias != null ? `${d.prazo_dias}d` : "—"}</td>
                  <td className="py-2 pr-2 text-right text-xs font-semibold tabular-nums text-secondary">{d.progresso_pct}%</td>
                  <td className="max-w-36 py-2 pr-2 text-xs text-muted-foreground">{d.recursos ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 text-right text-xs font-semibold tabular-nums text-secondary">
                    {d.valor > 0 ? formatarMoeda(d.valor) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t text-sm font-bold text-secondary">
              <td className="pt-2" colSpan={8}>Total contratado ({comValor.length} atividades com desembolso)</td>
              <td className="pt-2 text-right tabular-nums">{formatarMoeda(totalValor)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Recursos/equipes vinculados ao cronograma */}
      <div>
        <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold text-secondary"><Users className="size-4 text-primary" /> Recursos / equipes</h3>
        {porRecurso.size === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma equipe atribuída ainda — defina "Recursos/equipe" no workspace de cada atividade (aba Projetos) e o resumo aparece aqui.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...porRecurso.entries()].sort((a, b) => b[1].valor - a[1].valor).map(([nome, r]) => (
              <div key={nome} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm font-bold text-secondary">{nome}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {r.atividades} atividade(s) · {r.inicio ? formatarDataBR(r.inicio) : "?"} → {r.fim ? formatarDataBR(r.fim) : "?"}
                </p>
                <p className="text-xs font-semibold tabular-nums text-secondary">{formatarMoeda(r.valor)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function KpiMini({ icone, rotulo, valor, alerta = false }: { icone: React.ReactNode; rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border px-3 py-2", alerta ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg bg-card", alerta ? "text-destructive" : "text-primary")}>{icone}</span>
      <div>
        <p className={cn("text-base font-extrabold leading-none tabular-nums", alerta ? "text-destructive" : "text-secondary")}>{valor}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

function TituloSecao({ icone, titulo, subtitulo }: { icone: React.ReactNode; titulo: string; subtitulo?: string }) {
  return (
    <div className="flex border-b bg-muted/30">
      <div className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-muted/30 px-4 py-2 backdrop-blur-sm" style={{ width: COL_ROTULO }}>
        <span className="text-primary">{icone}</span>
        <span className="text-xs font-bold uppercase tracking-wide text-secondary">{titulo}</span>
      </div>
      {subtitulo && (
        // Sticky logo após a coluna de rótulos: não desliza para baixo dela.
        <div className="sticky z-10 flex w-max items-center px-3" style={{ left: COL_ROTULO }}>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{subtitulo}</span>
        </div>
      )}
    </div>
  );
}

/** Linha do Gantt: rótulo FIXO (sticky) + área temporal com grade e barras. */
function Linha({
  altura, janela, meses, hoje, rotulo, children,
}: {
  altura: string;
  janela: JanelaGantt;
  meses: string[];
  hoje: string;
  rotulo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group flex border-b border-border/50 transition-colors hover:bg-accent/30", altura)}>
      <div className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 group-hover:bg-accent/40" style={{ width: COL_ROTULO }}>
        {rotulo}
      </div>
      <div className="relative flex-1">
        {/* Faixas alternadas por mês + grade hairline */}
        {meses.map((m, i) => (
          <span
            key={m}
            className={cn("absolute inset-y-0 border-l border-border/50", i % 2 === 1 && "bg-muted/20")}
            style={{ left: `${posPct(m, janela)}%`, width: `${100 / meses.length}%` }}
          />
        ))}
        {/* Linha de hoje */}
        <span className="absolute inset-y-0 z-10 w-0.5 bg-secondary/60" style={{ left: `${posPct(hoje, janela)}%` }} />
        {children}
      </div>
    </div>
  );
}

/** Marco pontual (losango). */
function Marco({ dataISO, janela }: { dataISO: string; janela: JanelaGantt }) {
  return (
    <span
      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-card bg-secondary shadow-sm"
      style={{ left: `${posPct(dataISO, janela)}%` }}
    />
  );
}

/** Bandeira de termo (TRP/TRD) na barra da fase. */
function Bandeira({ dataISO, janela, rotulo }: { dataISO: string; janela: JanelaGantt; rotulo: string }) {
  return (
    <span className="absolute top-0.5 z-10 -translate-x-1/2" style={{ left: `${posPct(dataISO, janela)}%` }} title={`${rotulo} · ${formatarDataBR(dataISO)}`}>
      <span className="flex items-center gap-0.5 rounded bg-success px-1 py-px text-[8px] font-extrabold text-white shadow-sm">
        <Flag className="size-2" /> {rotulo}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal: datas previstas da fase
// ---------------------------------------------------------------------------

function ModalCronogramaFase({ fase, onFechar }: { fase: ObraFase; onFechar: () => void }) {
  const atualizar = useAtualizarFaseCronograma();
  const [inicio, setInicio] = useState(fase.data_inicio_prevista ?? "");
  const [fim, setFim] = useState(fase.data_fim_prevista ?? "");

  async function salvar() {
    if (inicio && fim && fim <= inicio) { toast.error("O fim previsto deve ser depois do início."); return; }
    try {
      await atualizar.mutateAsync({ faseId: fase.id, dataInicioPrevista: inicio || null, dataFimPrevista: fim || null });
      toast.success("Datas previstas atualizadas.");
      onFechar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
  }

  const inputBase = "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-hidden tabIndex={-1} onClick={onFechar} className="absolute inset-0 animate-fade-in cursor-default bg-secondary/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm animate-modal-in rounded-lg border bg-card p-6 shadow-lifted">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-secondary">Datas previstas — {fase.nome}</h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-secondary" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <div className="space-y-3">
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Início previsto</span>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputBase} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold text-secondary">Fim previsto</span>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={inputBase} /></label>
          <p className="text-xs text-muted-foreground">O fim previsto também é a base do cálculo de multa/bônus da fase.</p>
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={onFechar} disabled={atualizar.isPending}>Cancelar</Button>
          <Button size="lg" className="flex-1" onClick={salvar} loading={atualizar.isPending}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
