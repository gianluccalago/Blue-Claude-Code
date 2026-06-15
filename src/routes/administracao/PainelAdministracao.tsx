/**
 * Painel da Administração — FONTE ÚNICA dos indicadores financeiro-operacionais.
 *
 * Reorganizado em blocos enxutos (Ocupação · Financeiro do mês · Custos e
 * Resultado) + evolução do faturamento. Todos os números vêm de useResumoMes
 * (mesma fonte do cockpit do Master, para não repetir o mesmo número com
 * aparências diferentes em telas distintas).
 *
 * CONSOLIDAÇÃO (ver INDICADORES.md):
 *  - Antes havia "Receita (mensalidades)", "Upselling do mês" e "Receita total
 *    prevista" como 3 cards: viraram UM card "Faturamento do mês" decomposto na
 *    nota (mensalidades + upselling).
 *  - "Recebido no mês" aparecia 2x (hero + card): agora 1x (bloco financeiro).
 *  - O card "Resumo do mês" em prosa repetia tudo: removido.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BedDouble,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  BadgeCheck,
  Wrench,
  Megaphone,
  Phone,
  Building2,
  Boxes,
  LineChart,
  Pencil,
} from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useResumoMes, useEvolucaoFinanceira } from "@/hooks/useIndicadoresGestao";
import { useResumoFunil } from "@/hooks/useCrm";
import { useChamadosManutencao } from "@/hooks/useManutencao";
import {
  useTelefonePlantao,
  useConfiguracao,
  useSalvarConfiguracao,
  CHAVE_TELEFONE_PLANTAO,
  CHAVE_TOTAL_SUITES,
} from "@/hooks/useConfiguracao";
import { formatarMoeda, formatarMesReferencia, mesAtual, deslocarMes } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, ProgressBar } from "@/components/dashboard/primitives";
import { BarrasMensais } from "@/components/dashboard/BarrasMensais";
import { LoadingState, ErrorState } from "@/components/states";
// (Badge não é usado neste painel — números vêm dos StatCards/HeroStat.)

export function PainelAdministracao() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  const temCrm = perfil === "direcao"; // CRM é da Direção.

  const [mes, setMes] = useState(mesAtual());
  const r = useResumoMes(mes);

  if (r.isLoading) return <LoadingState />;
  if (r.isError) return <ErrorState error={r.error} />;

  const resultadoPositivo = r.resultado >= 0;

  return (
    <div className="space-y-6">
      {/* HERO: resultado do mês + seletor de mês + recebido */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm">
              <Sparkles className="size-3.5" /> Painel da gestão
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 backdrop-blur-sm">
              <button type="button" aria-label="Mês anterior" onClick={() => setMes((m) => deslocarMes(m, -1))} className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white">‹</button>
              <span className="min-w-32 text-center text-sm font-bold text-white">{formatarMesReferencia(mes)}</span>
              <button type="button" aria-label="Próximo mês" onClick={() => setMes((m) => deslocarMes(m, 1))} disabled={mes >= mesAtual()} className="grid size-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white disabled:opacity-40">›</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-white/70">Resultado do mês</p>
              <p className={`mt-1 text-5xl font-extrabold leading-none tracking-tight tabular-nums ${resultadoPositivo ? "" : "text-rose-300"}`}>
                {formatarMoeda(r.resultado)}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-white/70">
                {resultadoPositivo ? <ArrowUpRight className="size-4 text-emerald-300" /> : <ArrowDownRight className="size-4 text-rose-300" />}
                {formatarMoeda(r.faturamento)} faturamento − {formatarMoeda(r.custoPessoal + (r.custoMateriais ?? 0))} custos
              </p>
            </div>
            <div className="w-full max-w-xs">
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/70">
                <span>Recebido no mês</span>
                <span className="font-bold text-white">{r.pctRecebido == null ? "—" : `${r.pctRecebido}%`}</span>
              </div>
              <ProgressBar valor={r.pctRecebido ?? 0} tom={resultadoPositivo ? "success" : "warning"} />
              <p className="mt-1.5 text-xs text-white/60">{formatarMoeda(r.recebido)} de {formatarMoeda(r.mensalidades)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== BLOCO OCUPAÇÃO ===================== */}
      <BlocoTitulo icon={Building2} titulo="Ocupação" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LinkCard to={`${base}/mapa-suites`}>
          <StatCard icon={BedDouble} tom="primary" rotulo="Hóspedes ativos" valor={r.ativos} apoio={r.capacidade ? `de ${r.capacidade} suítes` : "capacidade não cadastrada"} />
        </LinkCard>
        <StatCard
          icon={Building2}
          tom={r.taxaOcupacao != null && r.taxaOcupacao >= 90 ? "success" : "secondary"}
          rotulo="Taxa de ocupação"
          valor={r.taxaOcupacao == null ? "sem dados" : `${r.taxaOcupacao}%`}
        />
        <StatCard icon={ArrowUpRight} tom="secondary" rotulo="Entradas no mês" valor={r.entradas} />
        <LinkCard to={`${base}/analise-saidas`}>
          <StatCard icon={ArrowDownRight} tom={r.saidas > 0 ? "warning" : "secondary"} rotulo="Saídas no mês" valor={r.saidas} />
        </LinkCard>
      </div>
      <CapacidadeEditor ativos={r.ativos} />

      {/* ===================== BLOCO FINANCEIRO DO MÊS ===================== */}
      <BlocoTitulo icon={Wallet} titulo="Financeiro do mês" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LinkCard to={`${base}/demonstrativo`}>
          <StatCard
            icon={TrendingUp}
            tom="success"
            rotulo="Faturamento do mês"
            valor={formatarMoeda(r.faturamento)}
            apoio={
              `Mensalidades ${formatarMoeda(r.mensalidades)} + upselling ${formatarMoeda(r.upselling)}` +
              (r.decimoTerceiro > 0 ? ` + 13º ${formatarMoeda(r.decimoTerceiro)}` : "")
            }
          />
        </LinkCard>
        <LinkCard to={`${base}/cobranca`}>
          <StatCard
            icon={Receipt}
            tom="secondary"
            rotulo="Recebido vs. pendente"
            valor={formatarMoeda(r.recebido)}
            apoio={`${r.pctRecebido == null ? "—" : `${r.pctRecebido}%`} recebido · pendente ${formatarMoeda(r.pendente)}`}
          />
        </LinkCard>
        <LinkCard to={`${base}/cobranca`}>
          <StatCard
            icon={AlertTriangle}
            tom={r.inadimplentesCount > 0 ? "destructive" : "success"}
            destaque={r.inadimplentesCount > 0}
            rotulo="Inadimplência"
            valor={formatarMoeda(r.inadimplenteValor)}
            apoio={`${r.inadimplentesCount} hóspede(s) vencido(s)`}
          />
        </LinkCard>
      </div>

      {/* ===================== BLOCO CUSTOS E RESULTADO ===================== */}
      <BlocoTitulo icon={Boxes} titulo="Custos e resultado" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <LinkCard to={`${base}/custos-pessoal`}>
          <StatCard icon={Users} tom="secondary" rotulo="Custo de pessoal" valor={formatarMoeda(r.custoPessoal)} />
        </LinkCard>
        <LinkCard to={`${base}/custos-materiais`}>
          <StatCard
            icon={Boxes}
            tom="secondary"
            rotulo="Custo de materiais"
            valor={formatarMoeda(r.custoMateriais)}
            apoio="limpeza + manutenção"
          />
        </LinkCard>
        <StatCard
          icon={Wallet}
          tom={resultadoPositivo ? "success" : "destructive"}
          destaque
          rotulo="Resultado do mês"
          valor={formatarMoeda(r.resultado)}
          apoio="faturamento − custos"
        />
      </div>

      {/* ===================== EVOLUÇÃO DO FATURAMENTO ===================== */}
      <EvolucaoFaturamento mes={mes} />

      {/* Cards operacionais/comerciais (sem duplicar números financeiros). */}
      {perfil === "administracao" && <ResumoServicosCard base={base} />}
      {perfil === "administracao" && <TelefonePlantaoCard />}
      {temCrm && <FunilComercialCard base={base} />}
    </div>
  );
}

// ─── Bloco / utilitários ─────────────────────────────────────────────────────

function BlocoTitulo({ icon: Icon, titulo }: { icon: typeof Wallet; titulo: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="size-4 text-secondary" />
      <h2 className="text-sm font-bold uppercase tracking-wide text-secondary">{titulo}</h2>
    </div>
  );
}

/** Envolve um StatCard num link de detalhe (indicador clicável leva à ação). */
function LinkCard({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {children}
    </Link>
  );
}

// ─── Evolução do faturamento (12 meses) ──────────────────────────────────────

function EvolucaoFaturamento({ mes }: { mes: string }) {
  const evo = useEvolucaoFinanceira(mes, 12);
  const [serie, setSerie] = useState<"faturamento" | "resultado">("faturamento");

  const pontos = useMemo(
    () => (evo.data ?? []).map((p) => ({ mes: p.mes, valor: serie === "faturamento" ? p.faturamento : p.resultado })),
    [evo.data, serie],
  );
  const temDados = pontos.some((p) => p.valor !== 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChart className="size-4 text-primary" /> Evolução do faturamento (12 meses)
        </CardTitle>
        <div className="flex gap-1.5">
          <Button variant={serie === "faturamento" ? "default" : "outline"} size="sm" onClick={() => setSerie("faturamento")}>Faturamento</Button>
          <Button variant={serie === "resultado" ? "default" : "outline"} size="sm" onClick={() => setSerie("resultado")}>Resultado</Button>
        </div>
      </CardHeader>
      <CardContent>
        {evo.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !temDados ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          <BarrasMensais pontos={pontos} formatar={(n) => formatarMoeda(n)} tom={serie === "faturamento" ? "primary" : "secondary"} />
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Faturamento = mensalidades (roster presente no mês) + upselling. Resultado desconta o custo de pessoal registrado.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Editor de capacidade (total de suítes) ──────────────────────────────────

function CapacidadeEditor({ ativos }: { ativos: number }) {
  const atual = useConfiguracao(CHAVE_TOTAL_SUITES);
  const salvar = useSalvarConfiguracao();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");

  async function handleSalvar() {
    const n = parseInt(valor, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe um total de suítes válido.");
      return;
    }
    if (n < ativos) {
      toast.error(`A capacidade não pode ser menor que os ${ativos} hóspedes ativos.`);
      return;
    }
    try {
      await salvar.mutateAsync({ chave: CHAVE_TOTAL_SUITES, valor: String(n) });
      toast.success("Capacidade atualizada.");
      setEditando(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  if (!editando) {
    return (
      <button onClick={() => { setValor(atual.data ?? ""); setEditando(true); }} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Pencil className="size-3" /> {atual.data ? "Editar capacidade (total de suítes)" : "Cadastrar capacidade (total de suítes)"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="number" min={1} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Total de suítes" className="h-9 w-40 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
      <Button size="sm" variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
    </div>
  );
}

// ─── Telefone do plantão (família) ───────────────────────────────────────────

function TelefonePlantaoCard() {
  const atual = useTelefonePlantao();
  const salvar = useSalvarConfiguracao();
  const [valor, setValor] = useState<string | null>(null);
  const texto = valor ?? atual.data ?? "";

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({ chave: CHAVE_TELEFONE_PLANTAO, valor: texto.trim() });
      setValor(null);
      toast.success("Telefone do plantão atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="size-5 text-primary" /> Telefone do plantão (família)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Número FIXO do aparelho da casa que fica com a enfermagem de plantão. Aparece em destaque no portal da família.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={texto} onChange={(e) => setValor(e.target.value)} placeholder="(41) 0000-0000" className="h-11 w-56 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <Button onClick={handleSalvar} disabled={salvar.isPending || atual.isLoading}>{salvar.isPending ? "Salvando…" : "Salvar"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Resumo de serviços (Administração) ──────────────────────────────────────

function ResumoServicosCard({ base }: { base: string }) {
  const chamados = useChamadosManutencao();
  const abertos = (chamados.data ?? []).filter((c) => c.status !== "resolvido");
  const sg = abertos.filter((c) => c.destino === "servicos_gerais").length;
  const ht = abertos.filter((c) => c.destino === "hotelaria").length;
  const emergencias = abertos.filter((c) => c.urgencia === "emergencia").length;
  const priorizados = abertos.filter((c) => c.cobrado_gestao).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Wrench className="size-5 text-primary" /> Serviços
        </CardTitle>
        <Link to={`${base}/servicos`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Abrir supervisão <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={Wrench} tom={sg > 0 ? "warning" : "success"} rotulo="Serviços Gerais (abertos)" valor={sg} />
          <StatCard icon={BedDouble} tom={ht > 0 ? "warning" : "success"} rotulo="Hotelaria (abertos)" valor={ht} />
          <StatCard icon={AlertTriangle} tom={emergencias > 0 ? "destructive" : "success"} destaque={emergencias > 0} rotulo="Emergências" valor={emergencias} />
          <StatCard icon={Megaphone} tom="secondary" rotulo="Priorizados" valor={priorizados} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Funil comercial (Direção) ───────────────────────────────────────────────

function FunilComercialCard({ base }: { base: string }) {
  const funil = useResumoFunil();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" /> Funil comercial
        </CardTitle>
        <Link to={`${base}/crm`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Abrir pipeline <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={TrendingUp} tom="primary" rotulo="Oportunidades ativas" valor={funil.data?.oportunidadesAtivas ?? 0} />
          <StatCard icon={CalendarCheck} tom="secondary" rotulo="Visitas agendadas na semana" valor={funil.data?.visitasNaSemana ?? 0} />
          <StatCard icon={BadgeCheck} tom="success" rotulo="Admissões no mês" valor={funil.data?.admissoesNoMes ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}
