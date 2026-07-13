import { useMemo, useState } from "react";
import { BarChart3, Filter, TrendingDown, Radio, Clock, Trophy } from "lucide-react";
import { useOportunidades, useCrmEtapas, type OportunidadeCard } from "@/hooks/useCrm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, ProgressBar } from "@/components/dashboard/primitives";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { ouNaoInformado } from "@/lib/utils";
import { CrmNav } from "./CrmNav";

type Periodo = "mes" | "trimestre" | "ano" | "tudo";

const PERIODO_LABEL: Record<Periodo, string> = {
  mes: "Este mês",
  trimestre: "Últimos 3 meses",
  ano: "Este ano",
  tudo: "Todo o período",
};

function inicioDoPeriodo(p: Periodo): string | null {
  const hoje = new Date();
  if (p === "tudo") return null;
  if (p === "mes") return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
  if (p === "trimestre") return new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1).toISOString();
  return new Date(hoje.getFullYear(), 0, 1).toISOString(); // ano
}

export function CrmRelatorios() {
  const ops = useOportunidades();
  const etapas = useCrmEtapas();
  const [periodo, setPeriodo] = useState<Periodo>("trimestre");

  const desde = inicioDoPeriodo(periodo);
  const lista = useMemo(
    () => (ops.data ?? []).filter((o) => !desde || o.criado_em >= desde),
    [ops.data, desde],
  );

  if (ops.isLoading || etapas.isLoading) return <LoadingState />;
  if (ops.isError) return <ErrorState error={ops.error} />;

  const etapasOrdenadas = etapas.data ?? [];
  const total = lista.length;
  const ganhas = lista.filter((o) => o.status === "ganha");
  const perdidas = lista.filter((o) => o.status === "perdida");

  const inputBase =
    "h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5">
      <CrmNav ativa="crm-relatorios" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Relatórios do funil</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={inputBase}>
            {(Object.keys(PERIODO_LABEL) as Periodo[]).map((p) => (
              <option key={p} value={p}>{PERIODO_LABEL[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState label="Sem dados no período selecionado." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Trophy} rotulo="Oportunidades no período" valor={total} tom="primary" />
            <StatCard
              icon={Trophy}
              rotulo="Admissões (ganhas)"
              valor={ganhas.length}
              tom="success"
              apoio={total > 0 ? `${Math.round((ganhas.length / total) * 100)}% de conversão` : undefined}
            />
            <StatCard
              icon={TrendingDown}
              rotulo="Perdidas"
              valor={perdidas.length}
              tom="destructive"
              apoio={total > 0 ? `${Math.round((perdidas.length / total) * 100)}% do total` : undefined}
            />
          </div>

          <Funil lista={lista} etapas={etapasOrdenadas} />

          <div className="grid gap-5 lg:grid-cols-2">
            <Origens lista={lista} />
            <Perdas perdidas={perdidas} />
          </div>

          <TempoAteAdmissao ganhas={ganhas} />
        </>
      )}
    </div>
  );
}

// ─── Funil de conversão (alcance monotônico por etapa) ───────────────────────

function Funil({ lista, etapas }: { lista: OportunidadeCard[]; etapas: { id: string; nome: string }[] }) {
  if (etapas.length === 0) return null;
  const idxPorEtapa = new Map(etapas.map((e, i) => [e.nome, i]));
  // Cada oportunidade "alcançou" todas as etapas até a sua etapa atual.
  const alcance = etapas.map(() => 0);
  for (const o of lista) {
    const idx = idxPorEtapa.get(o.etapa);
    if (idx == null) continue;
    for (let i = 0; i <= idx; i++) alcance[i]++;
  }
  const base = alcance[0] || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {etapas.map((et, i) => {
          const qtd = alcance[i];
          const pctDoTopo = base > 0 ? Math.round((qtd / base) * 100) : 0;
          const conv = i > 0 && alcance[i - 1] > 0 ? Math.round((qtd / alcance[i - 1]) * 100) : null;
          return (
            <div key={et.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-secondary">{et.nome}</span>
                <span className="tabular-nums text-muted-foreground">
                  {qtd} {conv != null && <span className="ml-1 text-xs">({conv}% da etapa anterior)</span>}
                </span>
              </div>
              <ProgressBar valor={pctDoTopo} tom="primary" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Origens ──────────────────────────────────────────────────────────────────

function Origens({ lista }: { lista: OportunidadeCard[] }) {
  const grupos = useMemo(() => {
    const m = new Map<string, { total: number; ganhas: number }>();
    for (const o of lista) {
      const k = o.origemNome ?? "Não informado";
      const g = m.get(k) ?? { total: 0, ganhas: 0 };
      g.total++;
      if (o.status === "ganha") g.ganhas++;
      m.set(k, g);
    }
    return [...m.entries()].map(([nome, g]) => ({ nome, ...g })).sort((a, b) => b.total - a.total);
  }, [lista]);

  const maxTotal = grupos[0]?.total ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Radio className="size-4 text-primary" /> Origens</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {grupos.length === 0 ? (
          <EmptyState label="Sem dados." />
        ) : (
          grupos.map((g) => (
            <div key={g.nome}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-secondary">{ouNaoInformado(g.nome)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {g.total} <span className="text-xs">({g.ganhas} ganha(s))</span>
                </span>
              </div>
              <ProgressBar valor={maxTotal > 0 ? (g.total / maxTotal) * 100 : 0} tom="secondary" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Perdas ───────────────────────────────────────────────────────────────────

function Perdas({ perdidas }: { perdidas: OportunidadeCard[] }) {
  const grupos = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of perdidas) {
      const k = o.motivo_perda ?? "Não informado";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [perdidas]);

  const max = grupos[0]?.qtd ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><TrendingDown className="size-4 text-destructive" /> Motivos de perda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {grupos.length === 0 ? (
          <EmptyState label="Nenhuma perda no período." />
        ) : (
          grupos.map((g) => (
            <div key={g.motivo}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-secondary">{g.motivo}</span>
                <span className="tabular-nums text-muted-foreground">{g.qtd}</span>
              </div>
              <ProgressBar valor={max > 0 ? (g.qtd / max) * 100 : 0} tom="destructive" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tempo médio até admissão ─────────────────────────────────────────────────

function TempoAteAdmissao({ ganhas }: { ganhas: OportunidadeCard[] }) {
  const comDatas = ganhas.filter((o) => o.fechado_em);
  const mediaDias =
    comDatas.length > 0
      ? Math.round(
          comDatas.reduce((acc, o) => {
            const ms = new Date(o.fechado_em as string).getTime() - new Date(o.criado_em).getTime();
            return acc + ms / 86_400_000;
          }, 0) / comDatas.length,
        )
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        icon={Clock}
        rotulo="Tempo médio até admissão"
        valor={mediaDias != null ? mediaDias : "sem dados"}
        sufixo={mediaDias != null ? (mediaDias === 1 ? "dia" : "dias") : undefined}
        tom="primary"
        apoio={comDatas.length > 0 ? `base: ${comDatas.length} admissão(ões)` : "nenhuma admissão no período"}
      />
    </div>
  );
}
