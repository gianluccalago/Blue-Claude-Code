import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  BedDouble,
  Layers,
  Wallet,
  TrendingUp,
  Coins,
  Receipt,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Droplet,
  Wrench,
  Sparkles,
  Stethoscope,
  HeartPulse,
  ClipboardCheck,
  Activity,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import {
  useTratamentos,
  useTodasIntercorrencias,
  useMedicacoesPendentesHoje,
  useAlertasEliminacaoPainel,
  estadoDaPendencia,
} from "@/hooks/useCoordenacao";
import {
  calcularOcupacao,
  calcularAderencia,
  useAderenciaHoje,
  useAceitacaoBaixaRecente,
} from "@/hooks/useMaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

// ===========================================================================
// MASTER-1 · Painel estratégico (cockpit do CEO).
//
// Cada indicador vem de dados REAIS do banco. Onde a fonte ainda não existe,
// o card mostra "sem dados" e um comentário aponta a origem futura — nunca um
// número fictício. A tela separa o estratégico (voo-alto: ocupação e
// financeiro) do operacional/assistencial (tempo real) e do clínico.
// ===========================================================================

/** Primeiro dia do mês de um Date (para o seletor financeiro). */
function inicioDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function labelMes(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function PainelEstrategico() {
  // Seletor de mês: escopo dos indicadores financeiros (BLOCO FINANCEIRO).
  // Os dados financeiros ainda não têm tabela; quando o módulo Administração/
  // Financeiro existir, este mês será o filtro das consultas de receita/custo.
  const [mes, setMes] = useState<Date>(() => inicioDoMes(new Date()));

  const residentes = useResidentes();
  const tratamentos = useTratamentos();
  const intercorrencias = useTodasIntercorrencias();
  const medicacoes = useMedicacoesPendentesHoje();
  const alertasElim = useAlertasEliminacaoPainel();
  const aderencia = useAderenciaHoje();
  const aceitacao = useAceitacaoBaixaRecente();

  const carregando =
    residentes.isLoading ||
    tratamentos.isLoading ||
    intercorrencias.isLoading ||
    medicacoes.isLoading ||
    alertasElim.isLoading ||
    aderencia.isLoading ||
    aceitacao.isLoading;

  const erro =
    residentes.error ??
    tratamentos.error ??
    intercorrencias.error ??
    medicacoes.error ??
    alertasElim.error ??
    aderencia.error ??
    aceitacao.error;

  if (carregando) return <LoadingState />;
  if (erro) return <ErrorState error={erro} />;

  const listaResidentes = residentes.data ?? [];
  const ocupacao = calcularOcupacao(listaResidentes);
  const nomePorId = new Map(listaResidentes.map((r) => [r.id, r.nome]));

  // ----- OPERACIONAL: alertas críticos abertos (tempo real) -----
  const trat = tratamentos.data ?? [];
  const intercAbertas = (intercorrencias.data ?? []).filter(
    (i) => !estadoDaPendencia(trat, "intercorrencia", i.id).resolvido,
  ).length;
  const medsAbertas = (medicacoes.data ?? []).filter(
    (m) => !estadoDaPendencia(trat, "medicacao", m.id).resolvido,
  ).length;
  const alertas = alertasElim.data ?? [];
  const alertasEliminacao = alertas.length;
  const criticosTotal = intercAbertas + alertasEliminacao + medsAbertas;

  // ----- OPERACIONAL: aderência da equipe ao plano (hoje) -----
  const ad = calcularAderencia(aderencia.data?.itens ?? [], aderencia.data?.registros ?? []);

  // ----- CLÍNICO: hóspedes sem evacuação há 3+ dias (alerta de eliminação) -----
  const semEvacuacao = alertas.filter((a) => a.tipo === "evacuacao");
  // ----- CLÍNICO: baixa aceitação alimentar recente -----
  const riscoAlimentar = aceitacao.data?.riscos ?? [];
  const temDadosAceitacao = aceitacao.data?.comDados ?? false;

  return (
    <div className="space-y-8">
      {/* Cabeçalho com seletor de mês (escopo dos indicadores financeiros). */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-secondary">
            Painel estratégico
          </h2>
          <p className="text-sm text-muted-foreground">
            Visão de voo-alto da operação · indicadores em dados reais
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5 shadow-card">
          <CalendarDays className="ml-1 size-4 text-muted-foreground" />
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-bold text-secondary">
            {labelMes(mes)}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* ====================== VOO-ALTO (ESTRATÉGICO) ====================== */}

      {/* BLOCO OCUPAÇÃO */}
      <section className="space-y-3">
        <SectionTitle icon={Building2} titulo="Ocupação" tom="estrategico" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric
            icon={BedDouble}
            rotulo="Residentes ativos"
            valor={ocupacao.totalAtivos}
            // "Ativos" = residentes cadastrados. Ainda não há campo de saída/
            // desligamento na ficha (residentes); todos contam como ativos.
          />
          <Metric
            icon={Building2}
            rotulo="Taxa de ocupação"
            // SEM DADOS: não há cadastro do total de suítes da casa. Quando
            // existir (módulo Administração / cadastro da estrutura), a taxa
            // será residentes ativos / total de suítes.
            valor={null}
            nota="total de suítes não cadastrado"
          />
          <Metric
            icon={Layers}
            rotulo="Grau de dependência"
            valor={
              <span className="text-sm font-semibold text-secondary">
                I: {ocupacao.porGrau.I} · II: {ocupacao.porGrau.II} · III:{" "}
                {ocupacao.porGrau.III}
                {ocupacao.porGrau.sem > 0 ? ` · s/ grau: ${ocupacao.porGrau.sem}` : ""}
              </span>
            }
          />
          <Metric
            icon={BedDouble}
            rotulo="Por tipo de suíte"
            // SEM DADOS: a ficha do residente tem módulo/andar/quarto, mas não
            // "tipo de suíte". Exibimos a distribuição por módulo (dado real)
            // e marcamos tipo de suíte como pendente de cadastro.
            valor={
              <span className="text-sm font-semibold text-secondary">
                {ocupacao.porModulo.map((m) => `${m.rotulo}: ${m.total}`).join(" · ")}
              </span>
            }
            nota="tipo de suíte não cadastrado — exibindo por módulo"
          />
        </div>
      </section>

      {/* BLOCO FINANCEIRO (mês selecionado) */}
      <section className="space-y-3">
        <SectionTitle
          icon={Wallet}
          titulo={`Financeiro · ${labelMes(mes)}`}
          tom="estrategico"
        />
        {/* SEM DADOS em todo o bloco: ainda não existem as tabelas de
            mensalidades/contratos, upselling, custos de pessoal nem baixas
            financeiras. Origem futura: módulo Administração/Financeiro
            (mensalidades, inadimplência, recebimentos) e módulo de Custos
            (pessoal fixo + por plantão). Cada card aponta para a tela de
            detalhe quando ela existir (ex: inadimplência → Mensalidades). */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Metric
            icon={TrendingUp}
            rotulo="Receita prevista"
            valor={null}
            nota="mensalidades vigentes + upselling — módulo Financeiro"
          />
          <Metric
            icon={Coins}
            rotulo="Custo de pessoal"
            valor={null}
            nota="mensal fixo + por plantão — módulo de Custos"
          />
          <Metric
            icon={Wallet}
            rotulo="Resultado bruto"
            valor={null}
            nota="receita prevista − custo de pessoal"
          />
          <Metric
            icon={AlertCircle}
            rotulo="Inadimplência"
            valor={null}
            nota="hóspedes com mensalidade vencida — Mensalidades"
          />
          <Metric
            icon={Receipt}
            rotulo="Recebido vs. pendente"
            valor={null}
            nota="recebimentos do mês — módulo Financeiro"
          />
        </div>
      </section>

      {/* ===================== OPERACIONAL (TEMPO REAL) ===================== */}

      <section className="space-y-3">
        <SectionTitle icon={Activity} titulo="Operacional e assistencial" tom="operacional" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {/* Alertas críticos → painel da Coordenação (tela de detalhe). */}
          <Metric
            icon={AlertTriangle}
            rotulo="Alertas críticos abertos"
            valor={criticosTotal}
            destaque={criticosTotal > 0}
            to="/app/coordenacao"
            nota={`${intercAbertas} intercorrências · ${alertasEliminacao} eliminação · ${medsAbertas} medicação`}
          />
          <Metric
            icon={ClipboardCheck}
            rotulo="Aderência ao plano (hoje)"
            valor={ad.pct === null ? null : `${ad.pct}%`}
            destaque={ad.pct !== null && ad.pct < 80}
            nota={
              ad.pct === null
                ? "nenhuma tarefa com horário no plano"
                : `${ad.noPrazo}/${ad.totalComPrazo} no prazo · ${ad.atrasados} atrasadas · ${ad.pendentes} pendentes`
            }
          />
          <Metric
            icon={Wrench}
            rotulo="Manutenção"
            // SEM DADOS: não há tabela de chamados/emergências de manutenção.
            // Origem futura: módulo de Manutenção (chamados abertos + emergências).
            valor={null}
            nota="chamados e emergências — módulo de Manutenção"
          />
          <Metric
            icon={Sparkles}
            rotulo="Hotelaria"
            // SEM DADOS: não há tabela de não-conformidades/inspeção de suítes.
            // Origem futura: módulo de Hotelaria (inspeção e não-conformidades).
            valor={null}
            nota="não-conformidades e inspeção — módulo de Hotelaria"
          />
        </div>
      </section>

      {/* ========================= CLÍNICO (médico) ======================== */}

      <section className="space-y-3">
        <SectionTitle icon={HeartPulse} titulo="Clínico" tom="operacional" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ClinicoCard
            icon={Stethoscope}
            titulo="IVCF desatualizado"
            // SEM DADOS: não existe tabela de avaliações IVCF no schema atual.
            // Origem futura: módulo clínico/avaliação (avaliacao_ivcf) — então
            // listaremos quem está sem avaliação há 6+ meses ou sem nenhuma.
            corpo={<SemDados nota="avaliação IVCF ainda não registrada no sistema" />}
          />
          <ClinicoCard
            icon={Layers}
            titulo="Divergência de grau"
            // SEM DADOS por ora: o grau ATUAL viria da última avaliação IVCF
            // (tabela inexistente) e o grau CONTRATUAL não é cadastrado na ficha
            // do hóspede. O campo residentes.grau_contratual será adicionado na
            // ficha do hóspede em MASTER-3; aqui sinalizamos a pendência.
            corpo={<SemDados nota="grau contratual não cadastrado (será adicionado na ficha — MASTER-3)" />}
          />
          <ClinicoCard
            icon={HeartPulse}
            titulo="Hóspedes em risco"
            corpo={
              <div className="space-y-3">
                {/* Sem evacuação há 3+ dias — dado REAL (eliminações). */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Droplet className="size-3.5" /> Sem evacuação há 3+ dias
                  </div>
                  {semEvacuacao.length === 0 ? (
                    <p className="mt-1 text-sm text-success">Nenhum</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {semEvacuacao.map((a) => (
                        <li key={a.residenteId} className="text-sm font-semibold text-secondary">
                          {nomePorId.get(a.residenteId) ?? "Não informado"}
                          {a.reincidente && (
                            <Badge variant="destructive" className="ml-2">
                              reincidente
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {/* Baixa aceitação alimentar — dado REAL (tarefa_registro). */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Utensils className="size-3.5" /> Baixa aceitação alimentar (3 dias)
                  </div>
                  {!temDadosAceitacao ? (
                    <SemDados nota="sem registros de aceitação recentes" />
                  ) : riscoAlimentar.length === 0 ? (
                    <p className="mt-1 text-sm text-success">Nenhum</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {riscoAlimentar.map((r) => (
                        <li key={r.residenteId} className="text-sm font-semibold text-secondary">
                          {nomePorId.get(r.residenteId) ?? "Não informado"}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {r.baixas} refeições "Nada/Pouco"
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            }
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------------

function SectionTitle({
  icon: Icon,
  titulo,
  tom,
}: {
  icon: LucideIcon;
  titulo: string;
  tom: "estrategico" | "operacional";
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          tom === "estrategico" ? "bg-secondary text-secondary-foreground" : "bg-accent text-secondary",
        )}
      >
        <Icon className="size-4" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-secondary">{titulo}</h3>
      <Badge variant={tom === "estrategico" ? "secondary" : "default"} className="ml-1">
        {tom === "estrategico" ? "Estratégico" : "Tempo real"}
      </Badge>
    </div>
  );
}

/** Texto padrão de ausência de dado (nunca número fictício). */
function SemDados({ nota }: { nota?: string }) {
  return (
    <div className="mt-1">
      <span className="text-base font-semibold text-muted-foreground">sem dados</span>
      {nota && <p className="text-xs text-muted-foreground/80">{nota}</p>}
    </div>
  );
}

/** Card de métrica do painel. `valor === null` renderiza "sem dados". */
function Metric({
  icon: Icon,
  rotulo,
  valor,
  sufixo,
  nota,
  destaque,
  to,
}: {
  icon: LucideIcon;
  rotulo: string;
  valor: ReactNode | number | null;
  sufixo?: string;
  nota?: string;
  destaque?: boolean;
  to?: string;
}) {
  const semDados = valor === null || valor === undefined;
  const conteudo = (
    <Card
      className={cn(
        "h-full p-4 transition-colors",
        destaque && "border-primary/40 bg-primary/5",
        to && "hover:border-primary hover:shadow-soft",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-semibold">{rotulo}</span>
      </div>
      <div className="mt-2">
        {semDados ? (
          <span className="text-2xl font-extrabold text-muted-foreground">sem dados</span>
        ) : typeof valor === "number" || typeof valor === "string" ? (
          <span className="text-3xl font-extrabold tabular-nums text-secondary">
            {valor}
            {sufixo}
          </span>
        ) : (
          valor
        )}
      </div>
      {nota && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/80">{nota}</p>}
    </Card>
  );
  return to ? (
    <Link to={to} className="block focus-visible:outline-none">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

function ClinicoCard({
  icon: Icon,
  titulo,
  corpo,
}: {
  icon: LucideIcon;
  titulo: string;
  corpo: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-secondary" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>{corpo}</CardContent>
    </Card>
  );
}
