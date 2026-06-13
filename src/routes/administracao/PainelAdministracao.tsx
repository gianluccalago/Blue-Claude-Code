/**
 * Painel da Administração — Visão geral (BLOCO Adm3)
 *
 * Indicadores do mês atual calculados a partir dos dados reais: ocupação,
 * receita prevista (mensalidades + upselling), inadimplência e
 * recebido vs. pendente.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  ArrowRight,
  CalendarCheck,
  BadgeCheck,
  Wrench,
  Megaphone,
  Phone,
} from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { useCustosPessoalDoMes } from "@/hooks/usePagamentoPessoal";
import { useResumoFunil } from "@/hooks/useCrm";
import { useChamadosManutencao } from "@/hooks/useManutencao";
import {
  useTelefonePlantao,
  useSalvarConfiguracao,
  CHAVE_TELEFONE_PLANTAO,
} from "@/hooks/useConfiguracao";
import { formatarMoeda, formatarMesReferencia, mesAtual } from "@/lib/mensalidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, ProgressBar } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";

export function PainelAdministracao() {
  const { perfil } = useParams({ strict: false }) as { perfil?: string };
  const base = `/app/${perfil ?? "administracao"}`;
  // CRM (funil comercial) pertence à Direção; a Administração não o vê.
  const temCrm = perfil === "direcao";
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

      {/* Supervisão de Serviços — Administração (a Direção não tem essa tela). */}
      {perfil === "administracao" && <ResumoServicosCard base={base} />}

      {/* Telefone do plantão exibido à família (config editável). */}
      {perfil === "administracao" && <TelefonePlantaoCard />}

      {/* Funil comercial — só Direção (CRM). A Administração não vê. */}
      {temCrm && <FunilComercialCard base={base} />}

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

/**
 * Editor do TELEFONE DO PLANTÃO mostrado à família (número fixo do aparelho da
 * casa, não a escala). Editável por Master/Administração (RLS reforça).
 */
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
          Número FIXO do aparelho da casa que fica com a enfermagem de plantão (passa de mão
          entre os plantões). Aparece em destaque no portal da família.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={texto}
            onChange={(e) => setValor(e.target.value)}
            placeholder="(41) 0000-0000"
            className="h-11 w-56 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={handleSalvar} disabled={salvar.isPending || atual.isLoading}>
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Card "Serviços" do painel da Administração — resumo dos três serviços
 * operacionais (chamados por destino, emergências, priorizados) com atalho para
 * a supervisão. Hook próprio para só consultar quando o card é renderizado.
 */
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
        <Link
          to={`${base}/servicos` as string}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
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

/**
 * Card "Funil comercial" do painel — exclusivo da Direção (única, junto do
 * Master, com acesso ao CRM). Isolado num componente para que o hook de CRM
 * só seja consultado quando o card é renderizado (a Administração não tem RLS
 * de CRM e nem deve disparar a query).
 */
function FunilComercialCard({ base }: { base: string }) {
  const funil = useResumoFunil();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" /> Funil comercial
        </CardTitle>
        <Link
          to={`${base}/crm` as string}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Abrir pipeline <ArrowRight className="size-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={TrendingUp}
            tom="primary"
            rotulo="Oportunidades ativas"
            valor={funil.data?.oportunidadesAtivas ?? 0}
          />
          <StatCard
            icon={CalendarCheck}
            tom="secondary"
            rotulo="Visitas agendadas na semana"
            valor={funil.data?.visitasNaSemana ?? 0}
          />
          <StatCard
            icon={BadgeCheck}
            tom="success"
            rotulo="Admissões no mês"
            valor={funil.data?.admissoesNoMes ?? 0}
          />
        </div>
      </CardContent>
    </Card>
  );
}
