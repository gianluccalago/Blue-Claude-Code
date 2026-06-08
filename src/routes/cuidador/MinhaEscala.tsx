import { Sun, Moon } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useMinhaEscala } from "@/hooks/useTurnos";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, hojeISO, formatarHoraBR } from "@/lib/utils";
import type { Turno } from "@/types/database";

export function MinhaEscala() {
  // Somente consulta: o cuidador vê apenas os próprios turnos.
  const escala = useMinhaEscala(CUIDADOR_ATUAL.id);

  if (escala.isLoading) return <LoadingState />;
  if (escala.isError) return <ErrorState error={escala.error} />;

  const turnos = escala.data ?? [];
  if (turnos.length === 0)
    return <EmptyState label="Você ainda não possui turnos na escala." />;

  return (
    <div className="space-y-3">
      {turnos.map((t) => (
        <TurnoLinha key={t.id} turno={t} />
      ))}
    </div>
  );
}

function TurnoLinha({ turno: t }: { turno: Turno }) {
  const ehHoje = t.data === hojeISO();
  const noturno = t.tag === "noturno";
  const Icone = noturno ? Moon : Sun;
  const dataObj = new Date(t.data + "T00:00:00");

  return (
    <Card className={cn("overflow-hidden", ehHoje && "ring-2 ring-primary")}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-accent py-2 text-secondary">
          <span className="text-xs font-semibold capitalize">
            {dataObj.toLocaleDateString("pt-BR", { weekday: "short" })}
          </span>
          <span className="text-xl font-extrabold tabular-nums">{dataObj.getDate()}</span>
          <span className="text-[11px] text-muted-foreground">
            {dataObj.toLocaleDateString("pt-BR", { month: "short" })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-secondary">
              {formatarHoraBR(t.inicio)}–{formatarHoraBR(t.fim)}
            </span>
            {ehHoje && <Badge variant="default">Hoje</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {dataObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
        <Badge
          variant={noturno ? "success" : "default"}
          className="shrink-0 px-3 py-1.5 capitalize"
        >
          <Icone className="size-3.5" /> {t.tag}
        </Badge>
      </CardContent>
    </Card>
  );
}
