/**
 * Funil de Vendas histórico — Administração/Direção e Master.
 * Consolida o CRM já existente numa visão histórica e de conversão (não recria
 * coleta). Definições/mapeamento dos estágios: ver src/lib/funilVendas.ts.
 *
 * NÃO duplica o card "Funil comercial" do painel (snapshot do momento:
 * oportunidades ativas, visitas na semana, admissões no mês). Aqui é a visão
 * HISTÓRICA por mês + conversão do período.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, Download, Percent, Wallet, Timer, LineChart } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useOportunidadesFunil } from "@/hooks/useCrm";
import { useModalidadePorResidente } from "@/hooks/usePlanos";
import { funilHistorico, resumoFunilPeriodo, vendasPorTipo, TIPO_VENDA_LABEL, type LinhaFunil } from "@/lib/funilVendas";
import { formatarMoeda, mesAtual, deslocarMes, formatarMesReferencia } from "@/lib/mensalidade";
import { exportarFunilExcel } from "@/lib/exportFunil";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/primitives";
import { BarrasMensais } from "@/components/dashboard/BarrasMensais";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";

const PERFIS_GESTAO = new Set(["administracao", "direcao", "master"]);
const fmtPct = (v: number | null) => (v == null ? "—" : `${v}%`);

export function FunilVendas() {
  const { usuarioEfetivo } = useAuth();
  const perfil = usuarioEfetivo?.perfil;
  const ops = useOportunidadesFunil();
  const modalidadeMap = useModalidadePorResidente();
  const [mesAte, setMesAte] = useState(mesAtual());

  // Janela de 12 meses terminando no mês selecionado (cronológico crescente).
  const meses = useMemo(() => {
    const out: string[] = [];
    for (let i = 11; i >= 0; i--) out.push(deslocarMes(mesAte, -i));
    return out;
  }, [mesAte]);

  const dados = useMemo(() => ops.data ?? [], [ops.data]);
  const linhas = useMemo(() => funilHistorico(dados, meses), [dados, meses]);
  const resumo = useMemo(() => resumoFunilPeriodo(dados, meses), [dados, meses]);
  // Vendas por tipo (LP/CP/SD) — conectado à modalidade real do residente admitido.
  const porTipo = useMemo(
    () => vendasPorTipo(dados, meses, modalidadeMap.data ?? new Map()),
    [dados, meses, modalidadeMap.data],
  );

  // Rodapé: médias das taxas e do ticket (sobre os meses com dado).
  const medias = useMemo(() => {
    const mediaDe = (vals: (number | null)[]) => {
      const v = vals.filter((x): x is number => x != null);
      return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
    };
    return {
      visitasLeads: mediaDe(linhas.map((l) => l.pctVisitasLeads)),
      vendasVisitas: mediaDe(linhas.map((l) => l.pctVendasVisitas)),
      vendasLeads: mediaDe(linhas.map((l) => l.pctVendasLeads)),
      ticket: (() => {
        const v = linhas.map((l) => l.ticketMedio).filter((x): x is number => x != null);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
      })(),
    };
  }, [linhas]);

  const temDados = dados.some((o) => meses.includes(o.criado_em.slice(0, 7)));

  if (!PERFIS_GESTAO.has(perfil ?? "")) {
    return <EmptyState label="Acesso restrito à gestão (Administração, Direção e Master)." />;
  }
  if (ops.isLoading) return <LoadingState />;
  if (ops.isError) return <ErrorState error={ops.error} />;

  async function exportar() {
    const ok = await exportarFunilExcel(linhas, mesAte);
    if (ok) toast.success("Funil exportado em Excel.");
    else toast.error("Não foi possível exportar.");
  }

  // Linhas da tabela: mais recente primeiro.
  const linhasTabela = [...linhas].reverse();

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Funil de Vendas</h1>
            <p className="text-sm text-muted-foreground">12 meses até {formatarMesReferencia(mesAte)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMesAte((m) => deslocarMes(m, -1))}>Anterior</Button>
          <span className="min-w-[120px] text-center text-sm font-semibold text-secondary">{formatarMesReferencia(mesAte)}</span>
          <Button variant="outline" size="sm" onClick={() => setMesAte((m) => deslocarMes(m, 1))} disabled={mesAte >= mesAtual()}>Próximo</Button>
          <Button onClick={exportar} className="gap-2" disabled={!temDados}><Download className="size-4" /> Excel</Button>
        </div>
      </div>

      {!temDados ? (
        <EmptyState label="Sem dados de funil no período." />
      ) : (
        <>
          {/* Resumo de conversão do período (não duplica o snapshot do painel) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Percent} tom="primary" destaque rotulo="Conversão global (vendas/leads)" valor={fmtPct(resumo.conversaoGlobal)} apoio={`${resumo.vendas} vendas / ${resumo.leads} leads`} />
            <StatCard icon={Wallet} tom="secondary" rotulo="Ticket médio do período" valor={resumo.ticketMedio == null ? "sem dados" : formatarMoeda(resumo.ticketMedio)} />
            <StatCard icon={Timer} tom="secondary" rotulo="Tempo médio lead → venda" valor={resumo.tempoMedioDias == null ? "sem dados" : `${resumo.tempoMedioDias} dias`} />
            <StatCard icon={Wallet} tom="secondary" rotulo="Receita do período" valor={formatarMoeda(resumo.receita)} apoio="mensalidades estimadas das vendas" />
          </div>

          {/* Vendas por tipo (LP/CP/SD) — origem real via modalidade do residente */}
          {(porTipo.LP + porTipo.CP + porTipo.SD + porTipo.indefinido) > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vendas por tipo no período</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="default" className="gap-1">{TIPO_VENDA_LABEL.LP} (LP): <strong>{porTipo.LP}</strong></Badge>
                <Badge variant="warning" className="gap-1">{TIPO_VENDA_LABEL.CP} (CP): <strong>{porTipo.CP}</strong></Badge>
                <Badge variant="secondary" className="gap-1">{TIPO_VENDA_LABEL.SD} (SD): <strong>{porTipo.SD}</strong></Badge>
                {porTipo.indefinido > 0 && <Badge variant="muted">Sem vínculo: {porTipo.indefinido}</Badge>}
              </CardContent>
            </Card>
          )}

          {/* Evolução do ticket médio (Realizado) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <LineChart className="size-4 text-primary" /> Evolução do ticket médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Série "Realizado". META (OKR) futura: quando metas forem cadastradas,
                  adicionar uma segunda série/sobreposição aqui. Correção por IPCA é
                  sofisticação futura (não aplicada). */}
              <BarrasMensais pontos={linhas.map((l) => ({ mes: l.mes, valor: l.ticketMedio ?? 0 }))} formatar={(n) => formatarMoeda(n)} tom="primary" />
            </CardContent>
          </Card>

          {/* Tabela funil histórico */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Funil histórico (por mês)</CardTitle>
            </CardHeader>
            <CardContent className="planilha-fixa">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-3">Mês/Ano</th>
                    <th className="pb-2 px-2 text-right">Leads</th>
                    <th className="pb-2 px-2 text-right">Qualif.</th>
                    <th className="pb-2 px-2 text-right">Visitas</th>
                    <th className="pb-2 px-2 text-right">Vendas</th>
                    <th className="pb-2 px-2 text-right">% Vis/Lead</th>
                    <th className="pb-2 px-2 text-right">% Ven/Vis</th>
                    <th className="pb-2 px-2 text-right">% Ven/Lead</th>
                    <th className="pb-2 px-2 text-right">Receita</th>
                    <th className="pb-2 pl-2 text-right">Ticket médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhasTabela.map((l) => (
                    <LinhaTabela key={l.mes} l={l} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold text-secondary">
                    <td className="pt-2 pr-3">Média / Total</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{resumo.leads}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{linhas.reduce((s, l) => s + l.qualificados, 0)}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{linhas.reduce((s, l) => s + l.visitas, 0)}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{resumo.vendas}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{fmtPct(medias.visitasLeads)}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{fmtPct(medias.vendasVisitas)}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{fmtPct(medias.vendasLeads)}</td>
                    <td className="pt-2 px-2 text-right tabular-nums">{formatarMoeda(resumo.receita)}</td>
                    <td className="pt-2 pl-2 text-right tabular-nums">{medias.ticket == null ? "—" : formatarMoeda(medias.ticket)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function LinhaTabela({ l }: { l: LinhaFunil }) {
  const traco = (v: number | null) => (v == null ? <span className="text-muted-foreground">—</span> : `${v}%`);
  return (
    <tr className="text-secondary">
      <td className="py-2.5 pr-3 font-medium">{formatarMesReferencia(l.mes)}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{l.leads || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{l.qualificados || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{l.visitas || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2.5 px-2 text-right tabular-nums font-semibold">{l.vendas || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{traco(l.pctVisitasLeads)}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{traco(l.pctVendasVisitas)}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{traco(l.pctVendasLeads)}</td>
      <td className="py-2.5 px-2 text-right tabular-nums">{l.receita > 0 ? formatarMoeda(l.receita) : <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2.5 pl-2 text-right tabular-nums">{l.ticketMedio == null ? <span className="text-muted-foreground">—</span> : formatarMoeda(l.ticketMedio)}</td>
    </tr>
  );
}
