/**
 * Painel da Hotelaria — visão do dia (BLOCO H4)
 * Foco da Hotelaria: Inspeção de suítes + os chamados de Manutenção DIRECIONADOS
 * a ela (governança/limpeza). A manutenção predial é de Serviços Gerais e a
 * rouparia, da Lavanderia. Contadores calculados ao abrir a tela (sem polling).
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BedDouble,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useResidentes } from "@/hooks/usePlanos";
import { useInspecoesHoje } from "@/hooks/useHotelaria";
import { useChamadosManutencao } from "@/hooks/useManutencao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  // A RLS já entrega só os chamados com destino 'hotelaria' para este perfil.
  const { data: chamados = [], isLoading: loadCham, error: errCham } = useChamadosManutencao();

  const isLoading = loadRes || loadInsp || loadCham;
  const anyError = errRes || errInsp || errCham;

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

  // ── 2. Manutenção da Hotelaria — chamados em aberto/andamento ──────────────
  const chamadosAbertos = useMemo(
    () => chamados.filter((c) => c.status !== "resolvido").length,
    [chamados]
  );

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
          label="Manutenção (sua fila)"
          value={chamadosAbertos}
          cor={chamadosAbertos > 0 ? "border-l-warning" : "border-l-success"}
          icon={chamadosAbertos > 0 ? Wrench : CheckCircle2}
          destaque={chamadosAbertos > 0 ? "amber" : undefined}
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

      {/* ── 2. Manutenção da Hotelaria (chamados direcionados a ela) ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-primary" />
              Manutenção — sua fila
            </CardTitle>
            <Link to="/app/hotelaria/manutencao">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                Ver manutenção <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {chamadosAbertos === 0
              ? "Nenhum chamado em aberto direcionado à Hotelaria."
              : `${chamadosAbertos} chamado(s) em aberto/andamento direcionados à Hotelaria (governança/limpeza). A manutenção predial é de Serviços Gerais.`}
          </p>
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
