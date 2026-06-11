/**
 * Painel da Hotelaria — visão do dia (BLOCO H4)
 * Reúne Inspeção de suítes (H1), Manutenção (H2) e Rouparia (H3) numa única
 * tela. Alertas e contadores são calculados ao abrir a tela (sem polling).
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Shirt,
  ArrowRight,
  Siren,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useInspecoesHoje } from "@/hooks/useHotelaria";
import { useChamadosManutencao } from "@/hooks/useManutencao";
import { useRouparia } from "@/hooks/useRouparia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { ChamadoManutencao, InspecaoSuite, Residente, UrgenciaChamado } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusSuite = "conforme" | "nao_conformidade" | "pendente";

function statusDaSuite(residenteId: string, inspecoesHoje: InspecaoSuite[]): StatusSuite {
  const diarias = inspecoesHoje.filter((i) => i.residente_id === residenteId && i.tipo === "diaria");
  if (diarias.length === 0) return "pendente";
  if (diarias.some((i) => i.tem_nao_conformidade)) return "nao_conformidade";
  return "conforme";
}

function emergenciaAtiva(c: ChamadoManutencao): boolean {
  return c.urgencia === "emergencia" && c.status !== "resolvido";
}

const URGENCIA_LABEL: Record<UrgenciaChamado, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  emergencia: "Emergência",
};

const URGENCIA_BADGE: Record<UrgenciaChamado, "muted" | "secondary" | "warning" | "destructive"> = {
  baixa: "muted",
  media: "secondary",
  alta: "warning",
  emergencia: "destructive",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function PainelHotelaria() {
  const { data: residentes = [], isLoading: loadRes, error: errRes } = useResidentes();
  const { data: inspecoesHoje = [], isLoading: loadInsp, error: errInsp } = useInspecoesHoje();
  const { data: chamados = [], isLoading: loadCham, error: errCham } = useChamadosManutencao();
  const { data: rouparia = [], isLoading: loadRoup, error: errRoup } = useRouparia();

  const isLoading = loadRes || loadInsp || loadCham || loadRoup;
  const anyError = errRes || errInsp || errCham || errRoup;

  // ── 1. Suítes — inspeção do dia ───────────────────────────────────────────
  const suitesComQuarto = useMemo(() => residentes.filter((r) => r.quarto), [residentes]);

  const gruposSuites = useMemo(() => {
    const mapa = new Map<string, { modulo: number | null; andar: number | null; suites: Residente[] }>();
    for (const r of suitesComQuarto) {
      const chave = `${r.modulo ?? "x"}|${r.andar ?? "x"}`;
      if (!mapa.has(chave)) mapa.set(chave, { modulo: r.modulo, andar: r.andar, suites: [] });
      mapa.get(chave)!.suites.push(r);
    }
    return Array.from(mapa.values())
      .map((g) => ({
        ...g,
        suites: [...g.suites].sort((a, b) => (a.quarto ?? "").localeCompare(b.quarto ?? "", "pt-BR")),
      }))
      .sort((a, b) => {
        const am = a.modulo ?? Infinity;
        const bm = b.modulo ?? Infinity;
        if (am !== bm) return am - bm;
        return (a.andar ?? Infinity) - (b.andar ?? Infinity);
      });
  }, [suitesComQuarto]);

  const suitesPendentes = useMemo(
    () => suitesComQuarto.filter((r) => statusDaSuite(r.id, inspecoesHoje) === "pendente").length,
    [suitesComQuarto, inspecoesHoje]
  );
  const suitesNaoConformes = useMemo(
    () => suitesComQuarto.filter((r) => statusDaSuite(r.id, inspecoesHoje) === "nao_conformidade").length,
    [suitesComQuarto, inspecoesHoje]
  );

  // ── 2. Manutenção — chamados ──────────────────────────────────────────────
  const contadoresChamados = useMemo(
    () => ({
      emergencias: chamados.filter(emergenciaAtiva).length,
      abertos: chamados.filter((c) => c.status === "aberto").length,
      emAndamento: chamados.filter((c) => c.status === "em_andamento").length,
    }),
    [chamados]
  );

  const chamadosUrgentes = useMemo(
    () =>
      chamados
        .filter(
          (c) => (c.urgencia === "alta" || c.urgencia === "emergencia") && c.status !== "resolvido"
        )
        .sort((a, b) => {
          const aE = emergenciaAtiva(a);
          const bE = emergenciaAtiva(b);
          if (aE !== bE) return aE ? -1 : 1;
          return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        }),
    [chamados]
  );

  // ── 3. Rouparia — saldo em trânsito ───────────────────────────────────────
  const saldoRoupariaTotal = useMemo(() => rouparia.reduce((s, i) => s + i.saldo_atual, 0), [rouparia]);
  const limiteRoupariaTotal = useMemo(() => rouparia.reduce((s, i) => s + i.limite, 0), [rouparia]);
  const roupariaAcimaDoLimite = saldoRoupariaTotal > limiteRoupariaTotal;

  if (isLoading) return <LoadingState />;
  if (anyError) return <ErrorState error={anyError} />;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-bold">Painel da Hotelaria</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* ── 4. Visão geral do dia ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResumoCard
          label="Suítes pendentes"
          value={suitesPendentes}
          cor={suitesPendentes > 0 ? "border-l-warning" : "border-l-success"}
          icon={suitesPendentes > 0 ? Clock : CheckCircle2}
          destaque={suitesPendentes > 0 ? "amber" : undefined}
        />
        <ResumoCard
          label="Não-conformidades"
          value={suitesNaoConformes}
          cor={suitesNaoConformes > 0 ? "border-l-destructive" : "border-l-success"}
          icon={suitesNaoConformes > 0 ? AlertTriangle : CheckCircle2}
          destaque={suitesNaoConformes > 0 ? "destructive" : undefined}
        />
        <ResumoCard
          label="Emergências"
          value={contadoresChamados.emergencias}
          cor={contadoresChamados.emergencias > 0 ? "border-l-destructive" : "border-l-success"}
          icon={contadoresChamados.emergencias > 0 ? Siren : CheckCircle2}
          destaque={contadoresChamados.emergencias > 0 ? "destructive" : undefined}
        />
        <ResumoCard
          label="Saldo rouparia"
          value={saldoRoupariaTotal}
          cor={roupariaAcimaDoLimite ? "border-l-destructive" : "border-l-success"}
          icon={roupariaAcimaDoLimite ? AlertTriangle : Shirt}
          destaque={roupariaAcimaDoLimite ? "destructive" : undefined}
        />
      </div>

      {/* ── 1. Suítes — inspeção do dia ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BedDouble className="h-4 w-4 text-primary" />
              Suítes — inspeção do dia
            </CardTitle>
            <Link to="/app/hotelaria/inspecao-suites">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                Ver inspeção <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ResumoCard
              label="Pendentes hoje"
              value={suitesPendentes}
              cor={suitesPendentes > 0 ? "border-l-warning" : "border-l-success"}
              icon={suitesPendentes > 0 ? Clock : CheckCircle2}
            />
            <ResumoCard
              label="Não-conformidades"
              value={suitesNaoConformes}
              cor={suitesNaoConformes > 0 ? "border-l-destructive" : "border-l-success"}
              icon={suitesNaoConformes > 0 ? AlertTriangle : CheckCircle2}
            />
          </div>

          {suitesComQuarto.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum hóspede com quarto cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {gruposSuites.map((g) => (
                <div key={`${g.modulo ?? "x"}|${g.andar ?? "x"}`}>
                  <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    {g.modulo !== null ? `Módulo ${g.modulo}` : "Módulo não informado"}
                    {" · "}
                    {g.andar !== null ? `Andar ${g.andar}` : "Andar não informado"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.suites.map((r) => {
                      const st = statusDaSuite(r.id, inspecoesHoje);
                      return (
                        <Link
                          key={r.id}
                          to="/app/hotelaria/inspecao-suites"
                          search={{ residente: r.id }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:opacity-80",
                            st === "conforme" && "border-success/40 bg-success/10 text-success",
                            st === "nao_conformidade" && "border-destructive/40 bg-destructive/10 text-destructive",
                            st === "pendente" && "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          {st === "conforme" && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {st === "nao_conformidade" && <AlertTriangle className="h-3.5 w-3.5" />}
                          {st === "pendente" && <Clock className="h-3.5 w-3.5" />}
                          Quarto {ouNaoInformado(r.quarto)}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 2. Manutenção — chamados ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-primary" />
              Manutenção — chamados
            </CardTitle>
            <Link to="/app/hotelaria/manutencao">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                Ver manutenção <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {contadoresChamados.emergencias > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              <Siren className="h-4 w-4 shrink-0" />
              {contadoresChamados.emergencias} emergência{contadoresChamados.emergencias > 1 ? "s" : ""} ativa
              {contadoresChamados.emergencias > 1 ? "s" : ""}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <ResumoCard
              label="Emergências"
              value={contadoresChamados.emergencias}
              cor={contadoresChamados.emergencias > 0 ? "border-l-destructive" : "border-l-success"}
              icon={contadoresChamados.emergencias > 0 ? Siren : CheckCircle2}
            />
            <ResumoCard
              label="Abertos"
              value={contadoresChamados.abertos}
              cor={contadoresChamados.abertos > 0 ? "border-l-destructive" : "border-l-success"}
              icon={contadoresChamados.abertos > 0 ? AlertTriangle : CheckCircle2}
            />
            <ResumoCard
              label="Em andamento"
              value={contadoresChamados.emAndamento}
              cor={contadoresChamados.emAndamento > 0 ? "border-l-warning" : "border-l-success"}
              icon={contadoresChamados.emAndamento > 0 ? Clock : CheckCircle2}
            />
          </div>

          {chamadosUrgentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum chamado de urgência alta ou emergência em aberto.</p>
          ) : (
            <div className="space-y-2">
              {chamadosUrgentes.map((c) => (
                <Link
                  key={c.id}
                  to="/app/hotelaria/manutencao"
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
                    emergenciaAtiva(c) && "border-destructive bg-destructive/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      emergenciaAtiva(c) ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"
                    )}
                  >
                    {emergenciaAtiva(c) ? <Siren className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.local}</span>
                      <Badge variant={URGENCIA_BADGE[c.urgencia]} className="text-xs">
                        {URGENCIA_LABEL[c.urgencia]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.problema}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3. Rouparia ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shirt className="h-4 w-4 text-primary" />
              Rouparia — saldo em trânsito
            </CardTitle>
            <Link to="/app/hotelaria/rouparia">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                Ver rouparia <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Card className={cn("border-l-4", roupariaAcimaDoLimite ? "border-l-destructive" : "border-l-success")}>
            <CardContent className="flex items-center gap-3 pt-4 pb-3">
              {roupariaAcimaDoLimite ? (
                <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
              ) : (
                <Shirt className="h-6 w-6 shrink-0 text-success" />
              )}
              <div>
                <p className={cn("text-2xl font-bold leading-none", roupariaAcimaDoLimite && "text-destructive")}>
                  {saldoRoupariaTotal}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saldo total em trânsito (limite: {limiteRoupariaTotal})
                  {roupariaAcimaDoLimite && " · acima do limite"}
                </p>
              </div>
            </CardContent>
          </Card>

          {rouparia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria de rouparia cadastrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {rouparia.map((item) => {
                const acima = item.saldo_atual > item.limite;
                return (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className={cn("text-xs", acima && "border-destructive text-destructive")}
                  >
                    {item.categoria} — {item.saldo_atual}/{item.limite}
                  </Badge>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function ResumoCard({
  label,
  value,
  cor,
  icon: Icon,
  destaque,
}: {
  label: string;
  value: number;
  cor: string;
  icon: React.ElementType;
  destaque?: "destructive" | "amber";
}) {
  return (
    <Card className={cn("border-l-4", cor)}>
      <CardContent className="flex items-center gap-3 pt-4 pb-3">
        <Icon
          className={cn(
            "h-6 w-6 shrink-0 opacity-70",
            destaque === "destructive" && "text-destructive opacity-100",
            destaque === "amber" && "text-warning opacity-100"
          )}
        />
        <div>
          <p
            className={cn(
              "text-2xl font-bold leading-none",
              destaque === "destructive" && "text-destructive"
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
