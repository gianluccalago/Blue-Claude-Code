/**
 * Análise de Saídas (churn) — Master e Administração/Direção (leitura).
 * Usa os dados reais de inativação (status_hospede='inativo'): distribuição por
 * motivo, tempo médio de permanência (retenção/LTV) e saídas detalhadas.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  TrendingDown,
  Users,
  Timer,
  Download,
  ArrowUpDown,
  PieChart,
  BarChart3,
  Grid3x3,
  Layers,
} from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useResidentesInativos } from "@/hooks/useCicloVida";
import { mesesPermanencia, formatarMeses, tempoPermanencia, MOTIVOS_SAIDA } from "@/lib/cicloVida";
import {
  anosDeSaida,
  contagemAnoMotivo,
  matrizTempoMotivo,
  resumoMacro,
} from "@/lib/analiseSaidas";
import { exportarSaidasExcel } from "@/lib/exportSaidas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard, ProgressBar } from "@/components/dashboard/primitives";
import { BarrasAgrupadas, PALETA_BARRAS, type SerieAgrupada } from "@/components/dashboard/BarrasAgrupadas";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, ouNaoInformado } from "@/lib/utils";
import type { Residente } from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
type Ordenacao = { campo: "saida" | "permanencia"; dir: "asc" | "desc" };

function anoDe(dataISO: string | null): string | null {
  return dataISO ? dataISO.slice(0, 4) : null;
}

const MOTIVO_CURTO: Record<string, string> = {
  Falecimento: "Falec.",
  "Retorno para casa": "Retorno",
  "Mudança para outro residencial": "Mudança",
  Inadimplência: "Inadimpl.",
  "Aumento de grau (incompatível)": "Aum. grau",
  "Curta permanência": "Curta perm.",
  Outro: "Outro",
};
function abreviarMotivo(m: string): string {
  return MOTIVO_CURTO[m] ?? m;
}

export function AnaliseSaidas() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const inativos = useResidentesInativos();
  const [ano, setAno] = useState<string>("todos");
  const [ordem, setOrdem] = useState<Ordenacao>({ campo: "saida", dir: "desc" });

  const todos = useMemo(() => inativos.data ?? [], [inativos.data]);

  // Anos disponíveis (a partir das datas de saída reais).
  const anosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const r of todos) {
      const a = anoDe(r.data_saida);
      if (a) set.add(a);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [todos]);

  // Saídas do período selecionado.
  const saidas = useMemo(() => {
    if (ano === "todos") return todos;
    return todos.filter((r) => anoDe(r.data_saida) === ano);
  }, [todos, ano]);

  // Tempo médio de permanência (meses) no período.
  const tempoMedio = useMemo(() => {
    const meses = saidas.map((r) => mesesPermanencia(r.data_admissao, r.data_saida)).filter((m): m is number => m != null);
    if (meses.length === 0) return null;
    return meses.reduce((s, m) => s + m, 0) / meses.length;
  }, [saidas]);

  // Distribuição por motivo (+ tempo médio por motivo).
  const porMotivo = useMemo(() => {
    const mapa = new Map<string, { count: number; mesesTotal: number; mesesN: number }>();
    for (const r of saidas) {
      const motivo = r.motivo_saida ?? "Não informado";
      const atual = mapa.get(motivo) ?? { count: 0, mesesTotal: 0, mesesN: 0 };
      atual.count += 1;
      const m = mesesPermanencia(r.data_admissao, r.data_saida);
      if (m != null) {
        atual.mesesTotal += m;
        atual.mesesN += 1;
      }
      mapa.set(motivo, atual);
    }
    // Ordena pela ordem canônica dos motivos; extras (ex.: "Não informado") ao fim.
    const ordemMotivo = (m: string) => {
      const i = (MOTIVOS_SAIDA as readonly string[]).indexOf(m);
      return i === -1 ? 999 : i;
    };
    return Array.from(mapa.entries())
      .map(([motivo, v]) => ({
        motivo,
        count: v.count,
        pct: saidas.length > 0 ? (v.count / saidas.length) * 100 : 0,
        mediaMeses: v.mesesN > 0 ? v.mesesTotal / v.mesesN : null,
      }))
      .sort((a, b) => b.count - a.count || ordemMotivo(a.motivo) - ordemMotivo(b.motivo));
  }, [saidas]);

  const topMotivos = porMotivo.slice(0, 3);
  const maxCount = porMotivo.reduce((m, x) => Math.max(m, x.count), 0);

  // Tabela ordenada.
  const linhas = useMemo(() => {
    const arr = [...saidas];
    arr.sort((a, b) => {
      let cmp = 0;
      if (ordem.campo === "saida") {
        cmp = (a.data_saida ?? "").localeCompare(b.data_saida ?? "");
      } else {
        const ma = mesesPermanencia(a.data_admissao, a.data_saida) ?? -1;
        const mb = mesesPermanencia(b.data_admissao, b.data_saida) ?? -1;
        cmp = ma - mb;
      }
      return ordem.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [saidas, ordem]);

  // ── Análises adicionais ───────────────────────────────────────────────────
  // Evolução por ANO (todos os anos, independe do filtro): séries = motivos.
  const anosTodos = useMemo(() => anosDeSaida(todos), [todos]);
  const seriesAno: SerieAgrupada[] = useMemo(
    () =>
      contagemAnoMotivo(todos, anosTodos, [...MOTIVOS_SAIDA]).map((s, i) => ({
        label: s.motivo,
        corClasse: PALETA_BARRAS[i % PALETA_BARRAS.length],
        valores: s.valores,
      })),
    [todos, anosTodos],
  );
  // Matriz e macro respeitam o período (saidas filtradas).
  const matriz = useMemo(() => matrizTempoMotivo(saidas, [...MOTIVOS_SAIDA]), [saidas]);
  const macro = useMemo(() => resumoMacro(saidas), [saidas]);

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (inativos.isLoading) return <LoadingState />;
  if (inativos.isError) return <ErrorState error={inativos.error} />;

  const periodoLabel = ano === "todos" ? "todos" : ano;

  function alternarOrdem(campo: Ordenacao["campo"]) {
    setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "desc" }));
  }

  async function exportar() {
    const ok = await exportarSaidasExcel(linhas, periodoLabel);
    if (ok) toast.success("Saídas exportadas em Excel.");
    else toast.error("Não foi possível exportar.");
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <TrendingDown className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Análise de Saídas</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Período:</label>
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <Button onClick={exportar} className="gap-2" disabled={saidas.length === 0}>
            <Download className="size-4" /> Excel
          </Button>
        </div>
      </div>

      {saidas.length === 0 ? (
        <EmptyState label="Sem saídas no período." />
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={Users} tom="secondary" rotulo="Saídas no período" valor={saidas.length} />
            <StatCard
              icon={Timer}
              tom="primary"
              destaque
              rotulo="Tempo médio de permanência"
              valor={formatarMeses(tempoMedio)}
              apoio="retenção / LTV"
            />
            <StatCard
              icon={PieChart}
              tom="secondary"
              rotulo="Motivo mais frequente"
              valor={topMotivos[0]?.motivo ?? "Não informado"}
              apoio={topMotivos[0] ? `${topMotivos[0].count} (${Math.round(topMotivos[0].pct)}%)` : undefined}
            />
          </div>

          {/* Destaque dos 2-3 motivos mais frequentes */}
          {topMotivos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topMotivos.map((m, i) => (
                <Badge key={m.motivo} variant={i === 0 ? "default" : "secondary"} className="gap-1">
                  {m.motivo}: <strong>{m.count}</strong> ({Math.round(m.pct)}%)
                </Badge>
              ))}
            </div>
          )}

          {/* Gráfico — saídas por motivo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="size-4 text-secondary" /> Saídas por motivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {porMotivo.map((m) => (
                <div key={m.motivo} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-secondary">{m.motivo}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {m.count} ({Math.round(m.pct)}%) · perm. méd. {formatarMeses(m.mediaMeses)}
                    </span>
                  </div>
                  <ProgressBar valor={maxCount > 0 ? (m.count / maxCount) * 100 : 0} tom="primary" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Gráfico — evolução por ANO (barras agrupadas por motivo) */}
          {anosTodos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4 text-secondary" /> Evolução por ano (todos os anos)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BarrasAgrupadas categorias={anosTodos} series={seriesAno} />
              </CardContent>
            </Card>
          )}

          {/* Matriz — tempo de permanência × motivo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid3x3 className="size-4 text-secondary" /> Matriz tempo de casa × motivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Sem scroll interno: % vira sub-linha do Total e o padding é
                  menor para a matriz caber inteira na tela. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-2">Tempo de casa</th>
                    {MOTIVOS_SAIDA.map((m) => (
                      <th key={m} className="pb-2 px-1.5 text-center" title={m}>{abreviarMotivo(m)}</th>
                    ))}
                    <th className="pb-2 pl-1.5 text-right" title="Total (e % das saídas)">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {matriz.map((linha) => (
                    <tr key={linha.faixa} className="text-secondary align-top">
                      <td className="py-2.5 pr-2 font-medium">{linha.faixa}</td>
                      {MOTIVOS_SAIDA.map((m) => (
                        <td key={m} className="py-2.5 px-1.5 text-center tabular-nums">
                          {linha.porMotivo[m] > 0 ? linha.porMotivo[m] : <span className="text-muted-foreground">—</span>}
                        </td>
                      ))}
                      <td className="py-2.5 pl-1.5 text-right tabular-nums">
                        <span className="font-bold">{linha.total}</span>
                        <div className="text-xs text-muted-foreground">{linha.pct}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold text-secondary align-top">
                    <td className="pt-2 pr-2">Total</td>
                    {MOTIVOS_SAIDA.map((m) => {
                      const col = matriz.reduce((s, l) => s + l.porMotivo[m], 0);
                      return (
                        <td key={m} className="pt-2 px-1.5 text-center tabular-nums">{col || ""}</td>
                      );
                    })}
                    <td className="pt-2 pl-1.5 text-right tabular-nums">
                      {saidas.length}
                      <div className="text-xs font-normal text-muted-foreground">100%</div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* Resumo por macro-grupo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4 text-secondary" /> Resumo por macro-grupo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {macro.map((g) => (
                <div key={g.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-secondary">{g.label}</span>
                    <span className="tabular-nums text-muted-foreground">{g.count} ({g.pct}%)</span>
                  </div>
                  <ProgressBar valor={g.pct} tom="secondary" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tabela — saídas detalhadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saídas detalhadas ({linhas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Sem scroll interno: tipo de suíte vira sub-linha do hóspede
                  para a tabela caber inteira na tela. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">Hóspede</th>
                    <th className="pb-2 pr-3">Entrada</th>
                    <th className="pb-2 pr-3">
                      <button className="inline-flex items-center gap-1 hover:text-secondary" onClick={() => alternarOrdem("saida")}>
                        Saída <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th className="pb-2 pr-3">
                      <button className="inline-flex items-center gap-1 hover:text-secondary" onClick={() => alternarOrdem("permanencia")}>
                        Permanência <ArrowUpDown className="size-3" />
                      </button>
                    </th>
                    <th className="pb-2">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((r: Residente) => (
                    <tr key={r.id} className="text-secondary align-top">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{r.nome}</div>
                        <div className="text-xs text-muted-foreground">suíte: {ouNaoInformado(r.tipo_suite)}</div>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado"}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{r.data_saida ? formatarDataBR(r.data_saida) : "Não informado"}</td>
                      <td className="py-2.5 pr-3">{tempoPermanencia(r.data_admissao, r.data_saida)}</td>
                      <td className="py-2.5">{ouNaoInformado(r.motivo_saida)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
