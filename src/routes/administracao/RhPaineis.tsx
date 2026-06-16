/**
 * Painéis de RH — Administração/Direção e Master. Lê dos registros de RH
 * (rh_ausencia/afastamento/desligamento) e da escala (turnos). Fórmulas e metas
 * documentadas em lib/paineisRh.ts. PRIVACIDADE: CID restrito a estes perfis.
 *
 * NÃO duplica indicadores existentes — é a visão analítica de RH (turnover,
 * absenteísmo, cobertura). Anotações qualitativas persistem em `configuracao`.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users2, CalendarRange, TrendingDown, HeartPulse, Download, Save } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useTurnos } from "@/hooks/useTurnos";
import {
  useProfissionaisRH,
  useDesligamentosTodos,
  useAusenciasRange,
  useAfastamentosRange,
} from "@/hooks/useRh";
import { useConfiguracao, useSalvarConfiguracao } from "@/hooks/useConfiguracao";
import {
  coberturaDoMes,
  turnoverMes,
  absenteismoMes,
  absenteismoCargoMes,
  afastamentoPorCid,
  META_TURNOVER_PCT,
  TETO_ABSENTEISMO_PCT,
  type MetricasCobertura,
} from "@/lib/paineisRh";
import { MOTIVOS_DESLIGAMENTO } from "@/lib/rh";
import { mesAtual, deslocarMes, intervaloDoMes } from "@/lib/mensalidade";
import { exportarCoberturaExcel } from "@/lib/exportRhCobertura";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraficoCombo } from "@/components/dashboard/GraficoCombo";
import { GraficoPizza } from "@/components/dashboard/GraficoPizza";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import type { RhAfastamento, RhAusencia, RhDesligamento, Turno, Usuario } from "@/types/database";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function mesCurto(mes: string): string {
  return MESES_CURTOS[Number(mes.slice(5, 7)) - 1] ?? mes;
}
const COR_ATUAL = "#6366f1";
const COR_ANTERIOR = "#cbd5e1";
const COR_META = "#ef4444";
const COR_LINHA = "#0ea5e9";
const PALETA_PIZZA = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a78bfa"];

export function RhPaineis() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const anoAtual = Number(mesAtual().slice(0, 4));
  const [ano, setAno] = useState(anoAtual);

  // Meses do ano (até o mês corrente, se for o ano atual) e os do ano anterior.
  const meses = useMemo(() => {
    const ultimo = ano === anoAtual ? mesAtual() : `${ano}-12`;
    const out: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const mm = `${ano}-${String(m).padStart(2, "0")}`;
      if (mm <= ultimo) out.push(mm);
    }
    return out;
  }, [ano, anoAtual]);
  const mesesAnt = useMemo(() => meses.map((m) => deslocarMes(m, -12)), [meses]);

  // Janela de consulta: jan do ano anterior até o fim do último mês exibido.
  const de = `${ano - 1}-01-01`;
  const ate = meses.length ? intervaloDoMes(meses[meses.length - 1]).fim : `${ano}-12-31`;

  const profissionais = useProfissionaisRH();
  const desligTodos = useDesligamentosTodos();
  const turnos = useTurnos(de, ate);
  const ausencias = useAusenciasRange(de, ate);
  const afastamentos = useAfastamentosRange(de, ate);

  const carregando = profissionais.isLoading || desligTodos.isLoading || turnos.isLoading || ausencias.isLoading || afastamentos.isLoading;
  const erro = profissionais.error ?? desligTodos.error ?? turnos.error ?? ausencias.error ?? afastamentos.error;

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const profs = profissionais.data ?? [];
  const desligAll = desligTodos.data ?? [];
  const turnosAll = turnos.data ?? [];
  const ausAll = ausencias.data ?? [];
  const afaAll = afastamentos.data ?? [];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <Users2 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Painéis de RH</h1>
            <p className="text-sm text-muted-foreground">Cobertura de escala · turnover · absenteísmo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Ano:</label>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 rounded-md border border-input bg-card px-2 text-sm">
            {[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <Tabs defaultValue="cobertura">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="cobertura" className="gap-1.5"><CalendarRange className="size-4" /> Cobertura</TabsTrigger>
          <TabsTrigger value="turnover" className="gap-1.5"><TrendingDown className="size-4" /> Turnover</TabsTrigger>
          <TabsTrigger value="absenteismo" className="gap-1.5"><HeartPulse className="size-4" /> Absenteísmo</TabsTrigger>
        </TabsList>

        <TabsContent value="cobertura" className="mt-4">
          <SecaoCobertura ano={ano} meses={meses} profs={profs} deslig={desligAll} turnos={turnosAll} aus={ausAll} />
        </TabsContent>
        <TabsContent value="turnover" className="mt-4">
          <SecaoTurnover ano={ano} meses={meses} mesesAnt={mesesAnt} profs={profs} deslig={desligAll} />
        </TabsContent>
        <TabsContent value="absenteismo" className="mt-4">
          <SecaoAbsenteismo ano={ano} meses={meses} mesesAnt={mesesAnt} profs={profs} deslig={desligAll} afa={afaAll} aus={ausAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── A) Cobertura ─────────────────────────────────────────────────────────────

function SecaoCobertura({ ano, meses, profs, deslig, turnos, aus }: {
  ano: number; meses: string[]; profs: Usuario[]; deslig: RhDesligamento[]; turnos: Turno[]; aus: RhAusencia[];
}) {
  const metricas: MetricasCobertura[] = useMemo(
    () => meses.map((m) => coberturaDoMes(m, profs, deslig, turnos, aus)),
    [meses, profs, deslig, turnos, aus],
  );
  const temDados = metricas.some((m) => m.plantoes > 0 || m.totalCoberturas > 0 || m.funcionarios > 0);

  async function exportar() {
    const ok = await exportarCoberturaExcel(metricas, String(ano));
    if (ok) toast.success("Cobertura exportada em Excel."); else toast.error("Não foi possível exportar.");
  }

  const linhas: { rotulo: string; valor: (m: MetricasCobertura) => string }[] = [
    { rotulo: "Funcionários (ativos)", valor: (m) => String(m.funcionarios) },
    { rotulo: "Plantões (total)", valor: (m) => String(m.plantoes) },
    { rotulo: "Plantões descobertos", valor: (m) => String(m.descobertos) },
    { rotulo: "Cobertura · atestado", valor: (m) => String(m.coberturasPorTipo.atestado) },
    { rotulo: "Cobertura · licença mat./INSS", valor: (m) => String(m.coberturasPorTipo.licenca_maternidade + m.coberturasPorTipo.licenca_inss) },
    { rotulo: "Cobertura · falta s/ atestado", valor: (m) => String(m.coberturasPorTipo.falta_sem_atestado) },
    { rotulo: "Cobertura · férias", valor: (m) => String(m.coberturasPorTipo.ferias) },
    { rotulo: "Cobertura · evento", valor: (m) => String(m.coberturasPorTipo.evento) },
    { rotulo: "Total de coberturas", valor: (m) => String(m.totalCoberturas) },
    { rotulo: "% Atestados / plantões", valor: (m) => (m.pctAtestadosSobrePlantoes == null ? "—" : `${m.pctAtestadosSobrePlantoes.toFixed(1)}%`) },
    { rotulo: "% Coberturas / plantões", valor: (m) => (m.pctCoberturasSobrePlantoes == null ? "—" : `${m.pctCoberturasSobrePlantoes.toFixed(1)}%`) },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Cobertura de escala — {ano}</CardTitle>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportar} disabled={!temDados}><Download className="size-4" /> Excel</Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {!temDados ? (
          <EmptyState label="Sem dados de escala/cobertura no período." />
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 text-left">Métrica</th>
                {meses.map((m) => <th key={m} className="pb-2 px-2 text-right">{mesCurto(m)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.map((l, i) => (
                <tr key={i} className={i >= 9 ? "font-semibold text-secondary" : "text-secondary"}>
                  <td className="py-2 pr-3">{l.rotulo}</td>
                  {metricas.map((m) => <td key={m.mes} className="py-2 px-2 text-right tabular-nums">{l.valor(m)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Plantão descoberto = turno sem profissional escalado. % Atestados = dias de atestado ÷ plantões.</p>
      </CardContent>
    </Card>
  );
}

// ─── B) Turnover ──────────────────────────────────────────────────────────────

function SecaoTurnover({ ano, meses, mesesAnt, profs, deslig }: {
  ano: number; meses: string[]; mesesAnt: string[]; profs: Usuario[]; deslig: RhDesligamento[];
}) {
  const serieAtual = useMemo(() => meses.map((m) => turnoverMes(m, profs, deslig) ?? 0), [meses, profs, deslig]);
  const serieAnt = useMemo(() => mesesAnt.map((m) => turnoverMes(m, profs, deslig) ?? 0), [mesesAnt, profs, deslig]);
  const temAnterior = serieAnt.some((v) => v > 0);

  const desligAno = useMemo(() => deslig.filter((d) => d.data_desligamento.slice(0, 4) === String(ano)), [deslig, ano]);

  const pizza = useMemo(() => {
    return MOTIVOS_DESLIGAMENTO.map((mo, i) => ({
      label: mo.label,
      valor: desligAno.filter((d) => d.motivo === mo.value).length,
      cor: PALETA_PIZZA[i % PALETA_PIZZA.length],
    })).filter((f) => f.valor > 0);
  }, [desligAno]);

  const porCargo = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of desligAno) m.set(d.cargo || "Não informado", (m.get(d.cargo || "Não informado") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [desligAno]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Turnover mensal (%) — {ano}{temAnterior ? ` vs ${ano - 1}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {meses.length === 0 ? <EmptyState label="Sem dados." /> : (
            <GraficoCombo
              categorias={meses.map(mesCurto)}
              barras={temAnterior
                ? [{ label: String(ano), cor: COR_ATUAL, valores: serieAtual }, { label: String(ano - 1), cor: COR_ANTERIOR, valores: serieAnt }]
                : [{ label: String(ano), cor: COR_ATUAL, valores: serieAtual }]}
              meta={{ label: `Meta ${META_TURNOVER_PCT}%`, valor: META_TURNOVER_PCT, cor: COR_META }}
              formatarBarra={(n) => `${n}%`}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Turnover do mês = (desligamentos no mês ÷ nº médio de funcionários) × 100. Linha = meta configurável.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Motivos de desligamento ({ano})</CardTitle></CardHeader>
          <CardContent>{pizza.length === 0 ? <EmptyState label="Sem desligamentos no ano." /> : <GraficoPizza fatias={pizza} />}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Desligamentos por cargo ({ano})</CardTitle></CardHeader>
          <CardContent>
            {porCargo.length === 0 ? <EmptyState label="Sem desligamentos no ano." /> : (
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {porCargo.map(([cargo, n]) => (
                    <tr key={cargo} className="text-secondary"><td className="py-2 pr-3 font-medium">{cargo}</td><td className="py-2 text-right font-bold tabular-nums">{n}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <NotasPeriodo chave={`rh_nota_turnover_${ano}`} titulo="Observações de retenção (turnover)" />
    </div>
  );
}

// ─── C) Absenteísmo ───────────────────────────────────────────────────────────

function SecaoAbsenteismo({ ano, meses, mesesAnt, profs, deslig, afa, aus }: {
  ano: number; meses: string[]; mesesAnt: string[]; profs: Usuario[]; deslig: RhDesligamento[]; afa: RhAfastamento[]; aus: RhAusencia[];
}) {
  const serieAtual = useMemo(() => meses.map((m) => absenteismoMes(m, profs, deslig, afa, aus) ?? 0), [meses, profs, deslig, afa, aus]);
  const serieAnt = useMemo(() => mesesAnt.map((m) => absenteismoMes(m, profs, deslig, afa, aus) ?? 0), [mesesAnt, profs, deslig, afa, aus]);
  const temAnterior = serieAnt.some((v) => v > 0);

  const afaAno = useMemo(() => afa.filter((a) => a.data_inicio.slice(0, 4) === String(ano)), [afa, ano]);
  const cargoMes = useMemo(() => absenteismoCargoMes(meses, profs, afaAno), [meses, profs, afaAno]);
  const cid = useMemo(() => afastamentoPorCid(afaAno), [afaAno]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Absenteísmo mensal (%) — {ano}{temAnterior ? ` vs ${ano - 1}` : ""}</CardTitle></CardHeader>
        <CardContent>
          {meses.length === 0 ? <EmptyState label="Sem dados." /> : (
            <GraficoCombo
              categorias={meses.map(mesCurto)}
              barras={temAnterior
                ? [{ label: String(ano), cor: COR_ATUAL, valores: serieAtual }, { label: String(ano - 1), cor: COR_ANTERIOR, valores: serieAnt }]
                : [{ label: String(ano), cor: COR_ATUAL, valores: serieAtual }]}
              meta={{ label: `Teto ${TETO_ABSENTEISMO_PCT}%`, valor: TETO_ABSENTEISMO_PCT, cor: COR_META }}
              formatarBarra={(n) => `${n}%`}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Absenteísmo = (dias perdidos por afastamento + faltas/atestados ÷ dias trabalháveis) × 100. Linha = teto configurável.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Absenteísmo por cargo (dias de afastamento) — {ano}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {cargoMes.length === 0 ? <EmptyState label="Sem afastamentos no ano." /> : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3 text-left">Cargo</th>
                  {meses.map((m) => <th key={m} className="pb-2 px-2 text-right">{mesCurto(m)}</th>)}
                  <th className="pb-2 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cargoMes.map((l) => (
                  <tr key={l.cargo} className="text-secondary">
                    <td className="py-2 pr-3 font-medium">{l.cargo}</td>
                    {l.porMes.map((v, i) => <td key={i} className="py-2 px-2 text-right tabular-nums">{v || <span className="text-muted-foreground">—</span>}</td>)}
                    <td className="py-2 pl-2 text-right font-bold tabular-nums">{l.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Afastamentos por grupo de CID — {ano}</CardTitle></CardHeader>
        <CardContent>
          {cid.length === 0 ? <EmptyState label="Sem afastamentos com CID no ano." /> : (
            <GraficoCombo
              categorias={cid.map((c) => c.grupo.split(" - ")[0])}
              barras={[{ label: "Dias perdidos", cor: COR_ATUAL, valores: cid.map((c) => c.dias) }]}
              linha={{ label: "Colaboradores afastados", cor: COR_LINHA, valores: cid.map((c) => c.colaboradores) }}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">Barras = dias perdidos; linha = nº de colaboradores. Grupo do CID (categoria) — dado sensível, sem diagnóstico.</p>
        </CardContent>
      </Card>

      <NotasPeriodo chave={`rh_nota_absenteismo_${ano}`} titulo="Observações de absenteísmo (picos, focos)" />
    </div>
  );
}

// ─── Anotações qualitativas (persistidas em `configuracao`) ──────────────────

function NotasPeriodo({ chave, titulo }: { chave: string; titulo: string }) {
  const atual = useConfiguracao(chave);
  const salvar = useSalvarConfiguracao();
  const [texto, setTexto] = useState<string | null>(null);
  const valor = texto ?? atual.data ?? "";

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({ chave, valor: valor.trim() });
      setTexto(null);
      toast.success("Observações salvas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <textarea
          rows={4}
          value={valor}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Análise e insights do período (retenção, gargalos, focos)…"
          className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending || atual.isLoading} className="gap-2">
          <Save className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar observações"}
        </Button>
      </CardContent>
    </Card>
  );
}
