import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarRange, Pencil, X, HardHat, DraftingCompass, AlarmClock, ZoomIn, ZoomOut,
  Activity, AlertTriangle, Flag, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useFasesObra, useEtapasObra, useChecklistObra, useAtualizarFaseCronograma } from "@/hooks/useObra";
import { useDisciplinas } from "@/hooks/useObraProjetos";
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
  type StatusGantt,
  type JanelaGantt,
} from "@/lib/obraGantt";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraFase } from "@/types/database";

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

  const [editando, setEditando] = useState<ObraFase | null>(null);
  const [zoom, setZoom] = useState(1); // índice em ZOOMS
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
  const listaDisc = (disciplinas.data ?? [])
    .filter((d) => d.data_base)
    .sort((a, b) => a.data_base!.localeCompare(b.data_base!));
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
      ...listaDisc.flatMap((d) => [d.data_base, d.prazo_dias != null ? somarDias(d.data_base!, d.prazo_dias) : null, d.data_conclusao]),
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
  const discAtrasadas = listaDisc.filter((d) => statusBarraDisciplina(d, hoje) === "atrasada").length;
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
              <span className="inline-block h-1 w-5 rounded-full bg-secondary/25" /> Plano
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} title="Diminuir zoom"><ZoomOut className="size-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} title="Aumentar zoom"><ZoomIn className="size-4" /></Button>
          </div>
        </div>

        <CardContent className="p-0">
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
                      const status = statusBarraDisciplina(d, hoje);
                      const fim = d.prazo_dias != null ? somarDias(d.data_base!, d.prazo_dias) : null;
                      return (
                        <Linha
                          key={d.id}
                          altura="h-9"
                          janela={janela}
                          meses={meses}
                          hoje={hoje}
                          rotulo={
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span className={cn("size-1.5 shrink-0 rounded-full", COR_SOLIDA[status])} />
                              <p className="truncate text-xs font-medium text-secondary">{d.nome}</p>
                              {status === "concluida" && <CheckCircle2 className="size-3 shrink-0 text-success" />}
                            </div>
                          }
                        >
                          {fim ? (
                            <div
                              className={cn("absolute top-[9px] h-[18px] cursor-default overflow-hidden rounded", COR_TRILHA[status], status === "prevista" && "border border-dashed border-muted-foreground/40")}
                              style={{ left: `${posPct(d.data_base!, janela)}%`, width: `${Math.max(0.8, larguraPct(d.data_base!, fim, janela))}%` }}
                              onMouseMove={(e) => mostrarTooltip(e, {
                                titulo: d.nome,
                                status,
                                linhas: [
                                  `Progresso: ${d.progresso_pct}%`,
                                  `Status contratual: ${d.status}`,
                                  `Data-base ${formatarDataBR(d.data_base!)} · prazo ${d.prazo_dias}d → ${formatarDataBR(fim)}`,
                                  d.data_conclusao ? `Concluída em ${formatarDataBR(d.data_conclusao)}` : "",
                                ].filter(Boolean),
                              })}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {/* Preenchimento = progresso da atividade */}
                              <div className={cn("h-full rounded-l", COR_SOLIDA[status])} style={{ width: `${Math.min(100, d.progresso_pct)}%` }} />
                            </div>
                          ) : (
                            <Marco dataISO={d.data_base!} janela={janela} />
                          )}
                          {d.data_conclusao && (
                            <span
                              className="absolute top-[8px] z-10 size-5 -translate-x-1/2 rounded-full border-2 border-card bg-success shadow-sm"
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
        </CardContent>
      </Card>

      {editando && <ModalCronogramaFase fase={editando} onFechar={() => setEditando(null)} />}
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
