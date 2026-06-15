/**
 * Resultados NPS — ANÁLISE (somente Master e Administração; a RLS nega leitura
 * aos aplicadores). NPS por dimensão (% promotores − % detratores, -100..+100)
 * + nota média, distribuição e comentários (com destaque para detratores).
 * Visão AGREGADA da casa e visão por hóspede (histórico). Filtros de período e
 * respondente, com destaque para dimensões de NPS baixo.
 */
import { useMemo, useState } from "react";
import { BarChart3, AlertTriangle, MessageSquareText, Sparkles, TrendingDown, LineChart } from "lucide-react";
import { useNpsPesquisas, useNpsRespostas } from "@/hooks/useNps";
import { useResidentes } from "@/hooks/usePlanos";
import {
  DIMENSOES_NPS,
  RESPONDENTE_LABEL,
  classeNps,
  resumoNps,
  npsBaixo,
  type ClasseNps,
  type DimensaoNps,
} from "@/lib/nps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { BarrasAgrupadas, PALETA_BARRAS, type SerieAgrupada } from "@/components/dashboard/BarrasAgrupadas";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { NpsPesquisa, NpsResposta } from "@/types/database";

// Rótulos curtos das dimensões para o eixo X do comparativo.
const DIM_CURTA: Record<DimensaoNps, string> = {
  geral: "Geral",
  limpeza_suites: "Suítes",
  limpeza_areas_comuns: "Áreas com.",
  atendimento_equipe: "Atend.",
  comida: "Comida",
  atividades_fisicas: "Ativ. fís.",
  atividades_lazer: "Lazer",
  lavanderia: "Lavand.",
};

function trimestreDe(dataISO: string): string {
  const d = new Date(dataISO);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-T${q}`;
}
function rotuloTrimestre(key: string): string {
  const [ano, t] = key.split("-T");
  return `${t}ºT/${ano}`;
}

type Periodo = "30" | "90" | "180" | "tudo";
const PERIODOS: { value: Periodo; label: string }[] = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "tudo", label: "Tudo" },
];

const selectBase =
  "h-9 rounded-md border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function dentroPeriodo(dataISO: string, periodo: Periodo): boolean {
  if (periodo === "tudo") return true;
  const limite = Date.now() - Number(periodo) * 24 * 60 * 60 * 1000;
  return new Date(dataISO).getTime() >= limite;
}

export function ResultadosNps() {
  const pesquisasQ = useNpsPesquisas();
  const respostasQ = useNpsRespostas();
  const residentesQ = useResidentes();

  const [periodo, setPeriodo] = useState<Periodo>("90");
  const [respFiltro, setRespFiltro] = useState<"todos" | "familiar" | "idoso">("todos");
  const [hospedeFiltro, setHospedeFiltro] = useState<string>("todos");

  const carregando = pesquisasQ.isLoading || respostasQ.isLoading || residentesQ.isLoading;
  const erro = pesquisasQ.error ?? respostasQ.error ?? residentesQ.error;

  const nomePorId = useMemo(
    () => new Map((residentesQ.data ?? []).map((r) => [r.id, r.nome])),
    [residentesQ.data],
  );

  const pesquisas = pesquisasQ.data ?? [];
  const respostas = respostasQ.data ?? [];

  // Filtro de respondente + hóspede SEM o período (base do comparativo por trimestre).
  const pesquisasRespHosp = useMemo(
    () =>
      pesquisas.filter(
        (p) =>
          (respFiltro === "todos" || p.respondente === respFiltro) &&
          (hospedeFiltro === "todos" || p.residente_id === hospedeFiltro),
      ),
    [pesquisas, respFiltro, hospedeFiltro],
  );

  const pesquisasFiltradas = useMemo(
    () => pesquisasRespHosp.filter((p) => dentroPeriodo(p.data, periodo)),
    [pesquisasRespHosp, periodo],
  );

  const respostasPorDimensao = useMemo(() => {
    const ids = new Set(pesquisasFiltradas.map((p) => p.id));
    const filtradas = respostas.filter((r) => ids.has(r.pesquisa_id));
    const mapa = new Map<string, NpsResposta[]>();
    for (const r of filtradas) {
      const arr = mapa.get(r.dimensao) ?? [];
      arr.push(r);
      mapa.set(r.dimensao, arr);
    }
    return mapa;
  }, [pesquisasFiltradas, respostas]);

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const geral = resumoNps((respostasPorDimensao.get("geral") ?? []).map((r) => r.nota));
  const totalPesquisas = pesquisasFiltradas.length;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="size-3.5" /> Satisfação · NPS
            </span>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Resultados NPS</h1>
            <p className="mt-1.5 text-sm text-white/70">
              {hospedeFiltro === "todos" ? "Visão agregada da casa" : nomePorId.get(hospedeFiltro) ?? "Hóspede"} ·{" "}
              {totalPesquisas} pesquisa(s) no período
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">NPS geral</p>
            <p className="text-4xl font-extrabold tabular-nums">{geral.nps ?? "—"}</p>
            <p className="text-xs text-white/60">
              média {geral.media ?? "—"} · {geral.total} resposta(s)
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
          <Filtro label="Período">
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={selectBase}>
              {PERIODOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Filtro>
          <Filtro label="Respondente">
            <select value={respFiltro} onChange={(e) => setRespFiltro(e.target.value as typeof respFiltro)} className={selectBase}>
              <option value="todos">Todos</option>
              <option value="familiar">Familiar</option>
              <option value="idoso">Idoso(a)</option>
            </select>
          </Filtro>
          <Filtro label="Hóspede">
            <select value={hospedeFiltro} onChange={(e) => setHospedeFiltro(e.target.value)} className={selectBase}>
              <option value="todos">Casa toda</option>
              {(residentesQ.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </Filtro>
        </CardContent>
      </Card>

      {totalPesquisas === 0 ? (
        <EmptyState label="Nenhuma pesquisa de NPS no período/filtro selecionado." />
      ) : (
        <>
          {/* KPIs por status (do NPS geral) */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={BarChart3} tom="success" rotulo="Promotores (9-10)" valor={geral.promotores} apoio={pct(geral.promotores, geral.total)} />
            <StatCard icon={BarChart3} tom="warning" rotulo="Neutros (7-8)" valor={geral.neutros} apoio={pct(geral.neutros, geral.total)} />
            <StatCard icon={BarChart3} tom="destructive" rotulo="Detratores (0-6)" valor={geral.detratores} apoio={pct(geral.detratores, geral.total)} />
          </div>

          {/* Comparativo por trimestre (independe do filtro de período) */}
          <ComparativoTrimestral pesquisas={pesquisasRespHosp} respostas={respostas} />

          {/* Por dimensão */}
          <div className="space-y-4">
            {DIMENSOES_NPS.map((d) => (
              <DimensaoCard
                key={d.key}
                titulo={d.label}
                respostas={respostasPorDimensao.get(d.key) ?? []}
                pesquisaInfo={(id) => {
                  const p = pesquisasFiltradas.find((x) => x.id === id);
                  return p
                    ? `${nomePorId.get(p.residente_id) ?? "Hóspede"} · ${RESPONDENTE_LABEL[p.respondente]} · ${formatarDataBR(p.data)}`
                    : "";
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function pct(parte: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((parte / total) * 100)}%`;
}

// ─── Comparativo por trimestre (barras agrupadas) ────────────────────────────

function ComparativoTrimestral({
  pesquisas,
  respostas,
}: {
  pesquisas: NpsPesquisa[];
  respostas: NpsResposta[];
}) {
  const trimestres = useMemo(() => {
    const set = new Set(pesquisas.map((p) => trimestreDe(p.data)));
    return Array.from(set).sort(); // crescente cronológico ("YYYY-TQ")
  }, [pesquisas]);

  // null = ainda não escolheu → usa os 4 trimestres mais recentes.
  const [selecionados, setSelecionados] = useState<string[] | null>(null);
  const selecao = useMemo(() => {
    const base = selecionados ?? trimestres.slice(-4);
    return base.filter((t) => trimestres.includes(t)).sort();
  }, [selecionados, trimestres]);

  const idsPorTri = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const p of pesquisas) {
      const t = trimestreDe(p.data);
      if (!m.has(t)) m.set(t, new Set());
      m.get(t)!.add(p.id);
    }
    return m;
  }, [pesquisas]);

  // NPS por dimensão × trimestre selecionado (null = sem respostas).
  const npsPorDimTri = useMemo(() => {
    const out = new Map<DimensaoNps, Map<string, number | null>>();
    for (const d of DIMENSOES_NPS) {
      const porTri = new Map<string, number | null>();
      for (const t of selecao) {
        const ids = idsPorTri.get(t) ?? new Set<string>();
        const notas = respostas.filter((r) => r.dimensao === d.key && ids.has(r.pesquisa_id)).map((r) => r.nota);
        porTri.set(t, resumoNps(notas).nps);
      }
      out.set(d.key, porTri);
    }
    return out;
  }, [respostas, idsPorTri, selecao]);

  const categorias = DIMENSOES_NPS.map((d) => DIM_CURTA[d.key]);
  const series: SerieAgrupada[] = selecao.map((t, i) => ({
    label: rotuloTrimestre(t),
    corClasse: PALETA_BARRAS[i % PALETA_BARRAS.length],
    valores: DIMENSOES_NPS.map((d) => npsPorDimTri.get(d.key)!.get(t) ?? 0),
  }));

  // Destaques: piora (último < penúltimo) e atenção (NPS baixo no último).
  const ultimo = selecao[selecao.length - 1];
  const penultimo = selecao[selecao.length - 2];
  const emQueda = DIMENSOES_NPS.filter((d) => {
    if (!penultimo) return false;
    const a = npsPorDimTri.get(d.key)!.get(penultimo);
    const b = npsPorDimTri.get(d.key)!.get(ultimo);
    return a != null && b != null && b < a;
  });
  const atencao = DIMENSOES_NPS.filter((d) => ultimo && npsBaixo(npsPorDimTri.get(d.key)!.get(ultimo) ?? null));

  if (trimestres.length === 0) return null;

  function toggle(t: string) {
    const base = selecionados ?? trimestres.slice(-4);
    setSelecionados(base.includes(t) ? base.filter((x) => x !== t) : [...base, t]);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChart className="size-4 text-primary" /> Comparativo por trimestre
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {trimestres.map((t) => (
            <Button key={t} size="sm" variant={selecao.includes(t) ? "default" : "outline"} onClick={() => toggle(t)}>
              {rotuloTrimestre(t)}
            </Button>
          ))}
        </div>

        {selecao.length === 0 ? (
          <p className="text-sm text-muted-foreground">Selecione ao menos um trimestre.</p>
        ) : (
          <>
            <BarrasAgrupadas categorias={categorias} series={series} formatarValor={(n) => String(Math.round(n))} />
            <p className="text-xs text-muted-foreground">Eixo Y = NPS por dimensão (−100 a +100) · séries = trimestres.</p>
            {(emQueda.length > 0 || atencao.length > 0) && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                {emQueda.map((d) => (
                  <Badge key={`q-${d.key}`} variant="warning" className="gap-1">
                    <TrendingDown className="size-3" /> {d.label}: em queda
                  </Badge>
                ))}
                {atencao.map((d) => (
                  <Badge key={`a-${d.key}`} variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" /> {d.label}: NPS baixo
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

const CLASSE_LABEL: Record<ClasseNps, string> = {
  promotor: "Promotor",
  neutro: "Neutro",
  detrator: "Detrator",
};
const CLASSE_DOT: Record<ClasseNps, string> = {
  promotor: "bg-success",
  neutro: "bg-warning",
  detrator: "bg-destructive",
};

function DimensaoCard({
  titulo,
  respostas,
  pesquisaInfo,
}: {
  titulo: string;
  respostas: NpsResposta[];
  pesquisaInfo: (pesquisaId: string) => string;
}) {
  const [verComentarios, setVerComentarios] = useState(false);
  const resumo = resumoNps(respostas.map((r) => r.nota));
  const atencao = npsBaixo(resumo.nps);

  // Comentários: detratores primeiro (são os de ação).
  const comentarios = respostas
    .filter((r) => r.comentario && r.comentario.trim() !== "")
    .sort((a, b) => a.nota - b.nota);

  const total = resumo.total || 1;
  return (
    <Card className={cn(atencao && "border-destructive/40")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {titulo}
            {atencao && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" /> atenção
              </Badge>
            )}
          </CardTitle>
          <div className="text-right">
            <span className="text-2xl font-extrabold tabular-nums text-secondary">
              {resumo.nps ?? "—"}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">NPS · média {resumo.media ?? "—"}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {resumo.total === 0 ? (
          <p className="text-sm text-muted-foreground">Sem respostas no período.</p>
        ) : (
          <>
            {/* Distribuição */}
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-success" style={{ width: `${(resumo.promotores / total) * 100}%` }} />
              <div className="bg-warning" style={{ width: `${(resumo.neutros / total) * 100}%` }} />
              <div className="bg-destructive" style={{ width: `${(resumo.detratores / total) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><span className="font-semibold text-success">{resumo.promotores}</span> promotores</span>
              <span><span className="font-semibold text-warning-foreground">{resumo.neutros}</span> neutros</span>
              <span><span className="font-semibold text-destructive">{resumo.detratores}</span> detratores</span>
              <span>· {resumo.total} resposta(s)</span>
            </div>

            {comentarios.length > 0 && (
              <button
                onClick={() => setVerComentarios((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <MessageSquareText className="size-3.5" />
                {verComentarios ? "Ocultar" : `Ver ${comentarios.length} comentário(s)`}
              </button>
            )}
            {verComentarios && (
              <ul className="space-y-2">
                {comentarios.map((r) => {
                  const c = classeNps(r.nota);
                  return (
                    <li key={r.id} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", CLASSE_DOT[c])} />
                        <span className="font-semibold text-secondary">Nota {r.nota}</span>
                        <Badge variant="muted">{CLASSE_LABEL[c]}</Badge>
                      </div>
                      <p className="mt-1 text-secondary/90">"{r.comentario}"</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{ouNaoInformado(pesquisaInfo(r.pesquisa_id))}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
