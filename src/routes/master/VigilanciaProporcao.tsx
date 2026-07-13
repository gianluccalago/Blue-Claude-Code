import { useState } from "react";
import { Scale, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useProporcaoTurno, useHistoricoProporcao } from "@/hooks/useProporcaoRh";
import { PROPORCAO_RDC, STATUS_PROPORCAO_LABEL, STATUS_PROPORCAO_VARIANTE } from "@/lib/proporcaoRh";
import { TURNOS_COBERTURA, TURNO_LABEL, turnoCorrente } from "@/lib/cobertura";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, dataISO, formatarDataBR } from "@/lib/utils";
import type { TagTurno } from "@/types/database";

function deslocarDia(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return dataISO(d);
}

// ===========================================================================
// VIGILÂNCIA SANITÁRIA · Proporção mínima de cuidadores (RDC 502 Art. 16, II).
// Verificação de APOIO: compara o mínimo legal (pelo grau real dos hóspedes)
// com o nº escalado (Escala). O dimensionamento é responsabilidade da gestão/RT.
// ===========================================================================

export function VigilanciaProporcao() {
  const inicial = turnoCorrente();
  const [data, setData] = useState(inicial.data);
  const [tag, setTag] = useState<TagTurno>(inicial.tag);

  const prop = useProporcaoTurno(data, tag);
  const hist = useHistoricoProporcao(30);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-secondary">
          <Scale className="size-6 text-primary" /> Proporção mínima de cuidadores
        </h2>
      </div>

      {/* Seletor data + turno */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setData((d) => deslocarDia(d, -1))}><ChevronLeft className="size-4" /></Button>
            <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" />
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm" />
            </span>
            <Button variant="outline" size="icon" onClick={() => setData((d) => deslocarDia(d, 1))}><ChevronRight className="size-4" /></Button>
          </div>
          <div className="flex gap-1.5">
            {TURNOS_COBERTURA.map((t) => (
              <button key={t.tag} onClick={() => setTag(t.tag)}
                className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  tag === t.tag ? "bg-primary text-primary-foreground shadow-card" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
                {t.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Turno selecionado */}
      {prop.isLoading ? (
        <LoadingState />
      ) : prop.isError ? (
        <ErrorState error={prop.error} />
      ) : prop.data ? (
        <div className="space-y-3">
          {/* Status grande */}
          <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4",
            prop.data.status === "abaixo" ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/5")}>
            <div className="flex items-center gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg",
                prop.data.status === "abaixo" ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                {prop.data.status === "abaixo" ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
              </span>
              <div>
                <p className="text-lg font-extrabold text-secondary">
                  {STATUS_PROPORCAO_LABEL[prop.data.status]} — {TURNO_LABEL[tag]}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mínimo legal <span className="font-bold text-secondary">{prop.data.minimo}</span> · escalado{" "}
                  <span className={cn("font-bold", prop.data.escalado < prop.data.minimo ? "text-destructive" : "text-success")}>{prop.data.escalado}</span>
                </p>
              </div>
            </div>
            <Badge variant={STATUS_PROPORCAO_VARIANTE[prop.data.status]} className="px-3 py-1.5 text-sm">
              {prop.data.escalado} / {prop.data.minimo}
            </Badge>
          </div>

          {/* Detalhe por grau */}
          <div className="grid gap-3 sm:grid-cols-3">
            <GrauCard grau="I" qtd={prop.data.contagem.I} prop={PROPORCAO_RDC.I} minimo={Math.ceil(prop.data.contagem.I / PROPORCAO_RDC.I)} />
            <GrauCard grau="II" qtd={prop.data.contagem.II} prop={PROPORCAO_RDC.II} minimo={Math.ceil(prop.data.contagem.II / PROPORCAO_RDC.II)} />
            <GrauCard grau="III" qtd={prop.data.contagem.III} prop={PROPORCAO_RDC.III} minimo={Math.ceil(prop.data.contagem.III / PROPORCAO_RDC.III)} />
          </div>

          {prop.data.contagem.semGrau > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                <strong>{prop.data.contagem.semGrau}</strong> hóspede(s) <strong>sem grau definido</strong> não entram no
                cálculo legal — defina o grau (IVCF) para a verificação ficar completa.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Histórico (30 dias)
            {hist.data && hist.data.abaixo > 0 && (
              <Badge variant="destructive" className="ml-1">{hist.data.abaixo} abaixo do mínimo</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hist.isLoading ? (
            <LoadingState />
          ) : hist.isError ? (
            <ErrorState error={hist.error} />
          ) : (hist.data?.linhas.length ?? 0) === 0 ? (
            <EmptyState label="Sem turnos com escala registrada no período." />
          ) : (
            <div className="space-y-1.5">
              {hist.data!.linhas.map((l) => (
                <div key={`${l.data}|${l.tag}`} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                  l.status === "abaixo" ? "bg-destructive/5" : "bg-muted/20")}>
                  <span className="font-medium text-secondary">{formatarDataBR(l.data)} · {TURNO_LABEL[l.tag]}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">escalado {l.escalado} / mín. {l.minimo}</span>
                    <Badge variant={STATUS_PROPORCAO_VARIANTE[l.status]}>{STATUS_PROPORCAO_LABEL[l.status]}</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GrauCard({ grau, qtd, prop, minimo }: { grau: string; qtd: number; prop: number; minimo: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grau {grau} · 1:{prop}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-secondary">{qtd}</p>
      <p className="text-xs text-muted-foreground">{qtd === 1 ? "hóspede" : "hóspedes"} · exige {minimo} cuidador(es)</p>
    </div>
  );
}
