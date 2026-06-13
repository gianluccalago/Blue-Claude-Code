/**
 * Painel da Hotelaria — visão do dia (BLOCO H4)
 * Foco da Hotelaria: Inspeção de suítes (H1) + Rouparia (H3). A Manutenção (H2)
 * passou a ser de Serviços Gerais. Alertas e contadores são calculados ao abrir
 * a tela (sem polling).
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shirt,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useInspecoesHoje } from "@/hooks/useHotelaria";
import { useRouparia } from "@/hooks/useRouparia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Medalhao } from "@/components/dashboard/primitives";
import { LoadingState, ErrorState } from "@/components/states";
import { cn, ouNaoInformado } from "@/lib/utils";
import type { InspecaoSuite, Residente } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusSuite = "conforme" | "nao_conformidade" | "pendente";

function statusDaSuite(residenteId: string, inspecoesHoje: InspecaoSuite[]): StatusSuite {
  const diarias = inspecoesHoje.filter((i) => i.residente_id === residenteId && i.tipo === "diaria");
  if (diarias.length === 0) return "pendente";
  if (diarias.some((i) => i.tem_nao_conformidade)) return "nao_conformidade";
  return "conforme";
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PainelHotelaria() {
  const { data: residentes = [], isLoading: loadRes, error: errRes } = useResidentes();
  const { data: inspecoesHoje = [], isLoading: loadInsp, error: errInsp } = useInspecoesHoje();
  const { data: rouparia = [], isLoading: loadRoup, error: errRoup } = useRouparia();

  const isLoading = loadRes || loadInsp || loadRoup;
  const anyError = errRes || errInsp || errRoup;

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

  // ── 2. Rouparia — saldo em trânsito ───────────────────────────────────────
  const saldoRoupariaTotal = useMemo(() => rouparia.reduce((s, i) => s + i.saldo_atual, 0), [rouparia]);
  const limiteRoupariaTotal = useMemo(() => rouparia.reduce((s, i) => s + i.limite, 0), [rouparia]);
  const roupariaAcimaDoLimite = saldoRoupariaTotal > limiteRoupariaTotal;

  if (isLoading) return <LoadingState />;
  if (anyError) return <ErrorState error={anyError} />;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Painel da Hotelaria</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* ── 4. Visão geral do dia ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      {/* ── 2. Rouparia ── */}
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
                <p className={cn("text-2xl font-extrabold leading-none tracking-tight tabular-nums", roupariaAcimaDoLimite && "text-destructive")}>
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
  icon: LucideIcon;
  destaque?: "destructive" | "amber";
}) {
  // Mapeia o filete herdado + destaque para o tom do medalhão.
  const tom: "primary" | "success" | "warning" | "destructive" =
    destaque === "destructive" || cor.includes("destructive")
      ? "destructive"
      : destaque === "amber" || cor.includes("warning")
        ? "warning"
        : cor.includes("success")
          ? "success"
          : "primary";
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/70 bg-card p-4 shadow-xs transition-all duration-200 hover:shadow-card">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/5 blur-2xl"
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
          {label}
        </p>
        <Medalhao icon={Icon} tom={tom} className="size-9 rounded-lg" />
      </div>
      <p
        className={cn(
          "relative mt-2 text-3xl font-extrabold leading-none tracking-tight tabular-nums",
          destaque === "destructive" ? "text-destructive" : "text-secondary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
