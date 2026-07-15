import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange, Pencil, X, Diamond, HardHat, DraftingCompass, AlarmClock } from "lucide-react";
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
import { LoadingState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, hojeISO } from "@/lib/utils";
import type { ObraFase } from "@/types/database";

// ===========================================================================
// MÓDULO OBRA · Aba CRONOGRAMA — Gantt de fases (plano × real × avanço),
// disciplinas de projeto (data-base + prazo) e marcos de prazo (insumos
// críticos, vencimento de documentos, ensaios, entregas de OC). Master/direção
// editam as datas previstas das fases aqui mesmo.
// ===========================================================================

// Cor por STATUS (estado, não série): concluída/andamento/atrasada/prevista.
const COR_BARRA: Record<StatusGantt, string> = {
  concluida: "bg-success",
  andamento: "bg-primary",
  atrasada: "bg-destructive",
  prevista: "bg-muted-foreground/40",
};
const COR_TRILHA: Record<StatusGantt, string> = {
  concluida: "bg-success/20",
  andamento: "bg-primary/20",
  atrasada: "bg-destructive/20",
  prevista: "bg-muted-foreground/15",
};
const STATUS_LABEL: Record<StatusGantt, string> = {
  concluida: "Concluída", andamento: "Em andamento", atrasada: "Atrasada", prevista: "Prevista",
};

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PX_POR_MES = 64; // largura mínima por mês (a área rola horizontalmente)

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
  const hoje = hojeISO();

  const ultimaPorEtapa = useMemo(() => ultimaVerificacaoPorEtapa(checklist.data ?? []), [checklist.data]);

  if (fases.isLoading || disciplinas.isLoading) return <LoadingState />;
  if (fases.isError) return <ErrorState error={fases.error} />;

  const listaFases = [...(fases.data ?? [])].sort((a, b) => a.numero - b.numero);
  const listaDisc = (disciplinas.data ?? []).filter((d) => d.data_base);
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

  // ── Janela do gráfico (todas as datas relevantes) ──
  const janela = janelaGantt(
    [
      ...listaFases.flatMap((f) => [f.data_inicio, f.data_inicio_prevista, f.data_fim_prevista, f.data_trp, f.data_trd]),
      ...listaDisc.flatMap((d) => [d.data_base, d.prazo_dias != null ? somarDias(d.data_base!, d.prazo_dias) : null, d.data_conclusao]),
      ...marcosPrazo.map((m) => m.data),
    ],
    hoje,
  );
  const meses = mesesDaJanela(janela);
  const larguraMin = meses.length * PX_POR_MES;

  const nenhumaDataFase = listaFases.every((f) => !f.data_inicio && !f.data_inicio_prevista && !f.data_fim_prevista);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary"><CalendarRange className="size-5" /></div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Cronograma</h1>
            <p className="text-xs text-muted-foreground">Plano × realizado — fases, projetos e prazos num só lugar.</p>
          </div>
        </div>
        {/* Legenda de status (estado nunca só pela cor: rótulo junto) */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {(Object.keys(STATUS_LABEL) as StatusGantt[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-4 rounded-sm", COR_BARRA[s])} /> {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><Diamond className="size-3 fill-secondary text-secondary" /> Marco de prazo</span>
        </div>
      </div>

      {nenhumaDataFase && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-secondary">
          Nenhuma fase tem datas ainda. Use o lápis ao lado de cada fase para definir o <span className="font-semibold">início e o fim previstos</span> — o plano aparece no gráfico na hora.
        </p>
      )}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${larguraMin + 176}px` }}>
              {/* Cabeçalho de meses */}
              <LinhaGrade janela={janela} meses={meses} hoje={hoje} cabecalho />

              {/* ── Fases ── */}
              <SecaoTitulo icone={<HardHat className="size-4" />} titulo="Obra física — fases" />
              {listaFases.map((f) => {
                const status = statusBarraFase(f, hoje);
                const inicio = f.data_inicio ?? f.data_inicio_prevista;
                const fim = f.data_fim_prevista ?? f.data_trd ?? f.data_trp ?? (f.data_inicio ? hoje : null);
                const av = avancoFisico((etapas.data ?? []).filter((e) => e.fase_id === f.id), ultimaPorEtapa);
                const temPlano = !!(f.data_inicio_prevista && f.data_fim_prevista);
                return (
                  <LinhaGantt
                    key={f.id}
                    janela={janela}
                    meses={meses}
                    hoje={hoje}
                    rotulo={`${f.nome} · ${f.modulos}`}
                    acao={podeEditar ? () => setEditando(f) : undefined}
                    tooltip={[
                      `${f.nome} — ${STATUS_LABEL[status]} · ${av.toFixed(1)}% físico`,
                      f.data_inicio_prevista || f.data_fim_prevista
                        ? `Previsto: ${f.data_inicio_prevista ? formatarDataBR(f.data_inicio_prevista) : "?"} → ${f.data_fim_prevista ? formatarDataBR(f.data_fim_prevista) : "?"}`
                        : "Sem datas previstas",
                      f.data_inicio ? `Início real: ${formatarDataBR(f.data_inicio)}` : "Não iniciada",
                    ].join("\n")}
                  >
                    {/* Plano (linha fina) quando início real difere do previsto */}
                    {temPlano && f.data_inicio && (
                      <div
                        className="absolute top-[3px] h-1 rounded-full bg-muted-foreground/30"
                        style={{ left: `${posPct(f.data_inicio_prevista!, janela)}%`, width: `${larguraPct(f.data_inicio_prevista!, f.data_fim_prevista!, janela)}%` }}
                      />
                    )}
                    {inicio && fim && fim > inicio ? (
                      <div
                        className={cn("absolute top-1.5 h-4 overflow-hidden rounded", COR_TRILHA[status])}
                        style={{ left: `${posPct(inicio, janela)}%`, width: `${Math.max(0.8, larguraPct(inicio, fim, janela))}%` }}
                      >
                        {/* Preenchimento = avanço físico (trilha clara do mesmo matiz) */}
                        <div className={cn("h-full rounded-l", COR_BARRA[status])} style={{ width: `${Math.min(100, av)}%` }} />
                      </div>
                    ) : inicio ? (
                      <Losango dataISO={inicio} janela={janela} />
                    ) : null}
                  </LinhaGantt>
                );
              })}

              {/* ── Disciplinas de projeto ── */}
              {listaDisc.length > 0 && (
                <>
                  <SecaoTitulo icone={<DraftingCompass className="size-4" />} titulo="Projetos — disciplinas (data-base + prazo)" />
                  {listaDisc.map((d) => {
                    const status = statusBarraDisciplina(d, hoje);
                    const fim = d.prazo_dias != null ? somarDias(d.data_base!, d.prazo_dias) : null;
                    return (
                      <LinhaGantt
                        key={d.id}
                        janela={janela}
                        meses={meses}
                        hoje={hoje}
                        rotulo={d.nome}
                        tooltip={[
                          `${d.nome} — ${STATUS_LABEL[status]} (${d.status})`,
                          `Data-base ${formatarDataBR(d.data_base!)}${d.prazo_dias != null ? ` · prazo ${d.prazo_dias}d → ${formatarDataBR(fim!)}` : ""}`,
                          d.data_conclusao ? `Concluída em ${formatarDataBR(d.data_conclusao)}` : "",
                        ].filter(Boolean).join("\n")}
                      >
                        {fim ? (
                          <div
                            className={cn("absolute top-1.5 h-4 rounded", COR_BARRA[status])}
                            style={{ left: `${posPct(d.data_base!, janela)}%`, width: `${Math.max(0.8, larguraPct(d.data_base!, fim, janela))}%` }}
                          />
                        ) : (
                          <Losango dataISO={d.data_base!} janela={janela} />
                        )}
                        {d.data_conclusao && (
                          <span
                            className="absolute top-1 size-5 -translate-x-1/2 rounded-full border-2 border-card bg-success"
                            style={{ left: `${posPct(d.data_conclusao, janela)}%` }}
                          />
                        )}
                      </LinhaGantt>
                    );
                  })}
                  {discSemData > 0 && (
                    <p className="py-1 pl-44 text-xs text-muted-foreground">
                      {discSemData} disciplina(s) sem data-base — defina na aba Projetos para entrarem no gráfico.
                    </p>
                  )}
                </>
              )}

              {/* ── Marcos de prazo ── */}
              {marcosPrazo.length > 0 && (
                <>
                  <SecaoTitulo icone={<AlarmClock className="size-4" />} titulo="Prazos e marcos (insumos · documentos · ensaios · entregas)" />
                  {marcosPrazo.map((m) => (
                    <LinhaGantt
                      key={m.chave}
                      janela={janela}
                      meses={meses}
                      hoje={hoje}
                      compacta
                      rotulo={m.rotulo}
                      tooltip={`${m.tipo}: ${m.rotulo}\n${formatarDataBR(m.data)}${m.data < hoje ? " — VENCIDO" : ""}`}
                    >
                      <Losango dataISO={m.data} janela={janela} vencido={m.data < hoje} />
                    </LinhaGantt>
                  ))}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {editando && <ModalCronogramaFase fase={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças do gráfico
// ---------------------------------------------------------------------------

function SecaoTitulo({ icone, titulo }: { icone: React.ReactNode; titulo: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 border-b pb-1 text-sm font-bold text-secondary">
      <span className="text-primary">{icone}</span> {titulo}
    </div>
  );
}

/** Grade vertical (meses) + linha de HOJE, compartilhada por todas as linhas. */
function LinhaGrade({ janela, meses, hoje, cabecalho = false }: { janela: JanelaGantt; meses: string[]; hoje: string; cabecalho?: boolean }) {
  return (
    <div className={cn("relative ml-44", cabecalho ? "h-6" : "h-0")}>
      {cabecalho &&
        meses.map((m) => {
          const [ano, mes] = m.split("-").map(Number);
          return (
            <span key={m} className="absolute top-0 whitespace-nowrap text-[10px] text-muted-foreground" style={{ left: `${posPct(m, janela)}%` }}>
              {MESES_CURTO[mes - 1]}{mes === 1 || m === meses[0] ? `/${String(ano).slice(2)}` : ""}
            </span>
          );
        })}
      {cabecalho && (
        <span
          className="absolute -top-0.5 z-10 -translate-x-1/2 rounded bg-secondary px-1 py-px text-[9px] font-bold text-secondary-foreground"
          style={{ left: `${posPct(hoje, janela)}%` }}
        >
          Hoje
        </span>
      )}
    </div>
  );
}

/** Linha do Gantt: rótulo fixo à esquerda + área temporal com grade e a barra. */
function LinhaGantt({
  janela, meses, hoje, rotulo, tooltip, acao, compacta = false, children,
}: {
  janela: JanelaGantt;
  meses: string[];
  hoje: string;
  rotulo: string;
  tooltip: string;
  acao?: () => void;
  compacta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("group flex items-stretch", compacta ? "h-6" : "h-7")} title={tooltip}>
      <div className="flex w-44 shrink-0 items-center gap-1 pr-2">
        <span className="truncate text-xs font-medium text-secondary">{rotulo}</span>
        {acao && (
          <button onClick={acao} className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100" title="Editar datas previstas">
            <Pencil className="size-3" />
          </button>
        )}
      </div>
      <div className="relative flex-1 border-l">
        {/* Grade de meses (hairline, recessiva) */}
        {meses.slice(1).map((m) => (
          <span key={m} className="absolute inset-y-0 w-px bg-border" style={{ left: `${posPct(m, janela)}%` }} />
        ))}
        {/* Linha de hoje */}
        <span className="absolute inset-y-0 z-10 w-0.5 bg-secondary/70" style={{ left: `${posPct(hoje, janela)}%` }} />
        {children}
      </div>
    </div>
  );
}

/** Marco pontual (losango). */
function Losango({ dataISO, janela, vencido = false }: { dataISO: string; janela: JanelaGantt; vencido?: boolean }) {
  return (
    <span
      className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-card", vencido ? "bg-destructive" : "bg-secondary")}
      style={{ left: `${posPct(dataISO, janela)}%` }}
    />
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
