/**
 * Painel da Administração — Visão geral (BLOCO Adm3)
 *
 * Indicadores do mês atual calculados a partir dos dados reais: ocupação,
 * receita prevista (mensalidades + upselling), inadimplência e
 * recebido vs. pendente.
 */
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { useCustosPessoalDoMes } from "@/hooks/usePagamentoPessoal";
import { formatarMoeda, formatarMesReferencia, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, ProgressBar } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";

export function PainelAdministracao() {
  const mes = mesAtual();
  const demo = useDemonstrativoMes(mes);
  const custos = useCustosPessoalDoMes(mes);

  if (demo.isLoading || custos.isLoading) return <LoadingState />;
  if (demo.isError) return <ErrorState error={demo.error} />;
  if (custos.isError) return <ErrorState error={custos.error} />;

  const totalHospedes = demo.linhas.length;
  const totalMensalidades = demo.linhas.reduce((acc, l) => acc + l.mensalidade, 0);
  const totalUpselling = demo.linhas.reduce((acc, l) => acc + l.upselling, 0);
  const receitaTotalPrevista = totalMensalidades + totalUpselling;

  const inadimplentes = demo.linhas.filter((l) => !l.pago);
  const valorInadimplente = inadimplentes.reduce((acc, l) => acc + l.mensalidade, 0);
  const valorRecebido = totalMensalidades - valorInadimplente;
  const percentRecebido = totalMensalidades > 0 ? Math.round((valorRecebido / totalMensalidades) * 100) : 0;

  const totalCustoPessoal = custos.linhas.reduce((acc, l) => acc + l.valorFinal, 0);
  const resultadoMes = receitaTotalPrevista - totalCustoPessoal;

  const resultadoPositivo = resultadoMes >= 0;

  return (
    <div className="space-y-6">
      {/* HERO: resultado do mês (receita − pessoal) */}
      <div className="relative overflow-hidden rounded-lg bg-hero-navy p-6 text-white shadow-cinematic sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 size-56 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur-sm">
              <Sparkles className="size-3.5" /> {formatarMesReferencia(mes)}
            </span>
            <p className="mt-3 text-sm font-medium text-white/70">Resultado previsto do mês</p>
            <p className="mt-1 text-5xl font-extrabold leading-none tracking-tight tabular-nums">
              {formatarMoeda(resultadoMes)}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {formatarMoeda(receitaTotalPrevista)} receita − {formatarMoeda(totalCustoPessoal)} pessoal
            </p>
          </div>
          <div className="w-full max-w-xs">
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/70">
              <span>Recebido no mês</span>
              <span className="font-bold text-white">{percentRecebido}%</span>
            </div>
            <ProgressBar valor={percentRecebido} tom={resultadoPositivo ? "success" : "warning"} />
            <p className="mt-1.5 text-xs text-white/60">
              {formatarMoeda(valorRecebido)} de {formatarMoeda(totalMensalidades)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={BedDouble} tom="primary" rotulo="Hóspedes ocupando suítes" valor={totalHospedes} />
        <StatCard icon={Wallet} tom="primary" rotulo="Receita (mensalidades)" valor={formatarMoeda(totalMensalidades)} />
        <StatCard icon={Receipt} tom="secondary" rotulo="Upselling do mês" valor={formatarMoeda(totalUpselling)} />
        <StatCard icon={TrendingUp} tom="success" rotulo="Receita total prevista" valor={formatarMoeda(receitaTotalPrevista)} />
        <StatCard icon={Users} tom="secondary" rotulo="Custo de pessoal" valor={formatarMoeda(totalCustoPessoal)} />
        <StatCard
          icon={AlertTriangle}
          tom={inadimplentes.length > 0 ? "destructive" : "success"}
          destaque={inadimplentes.length > 0}
          rotulo="Inadimplência"
          valor={formatarMoeda(valorInadimplente)}
          apoio={`${inadimplentes.length} hóspede(s) pendente(s)`}
        />
        <StatCard
          icon={CheckCircle2}
          tom="success"
          rotulo={`Recebido no mês (${percentRecebido}%)`}
          valor={formatarMoeda(valorRecebido)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-secondary">
          <p>
            {totalHospedes} hóspede(s) cadastrado(s), totalizando {formatarMoeda(totalMensalidades)} em
            mensalidades e {formatarMoeda(totalUpselling)} em upselling no mês —{" "}
            <span className="font-semibold">{formatarMoeda(receitaTotalPrevista)}</span> de receita total prevista.
          </p>
          <p>
            {valorRecebido > 0 || totalMensalidades === 0 ? (
              <>
                Já recebido: <span className="font-semibold">{formatarMoeda(valorRecebido)}</span> ({percentRecebido}
                %).{" "}
              </>
            ) : null}
            {inadimplentes.length > 0 ? (
              <>
                Pendente: <span className="font-semibold">{formatarMoeda(valorInadimplente)}</span> em{" "}
                {inadimplentes.length} hóspede(s).
              </>
            ) : (
              "Nenhuma mensalidade pendente neste mês."
            )}
          </p>
          <p>
            Custo de pessoal do mês: <span className="font-semibold">{formatarMoeda(totalCustoPessoal)}</span>.
            Resultado previsto (receita − pessoal):{" "}
            <span className="font-semibold">{formatarMoeda(resultadoMes)}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
