import { CalendarClock, Bus, Check, AlertTriangle, Info } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useCompromissos, useDarCiencia } from "@/hooks/useCompromissos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import type { CompromissoExterno } from "@/types/database";

export function Compromissos() {
  const hosp = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const ids = (hosp.data ?? []).map((h) => h.id);
  const comp = useCompromissos(ids);
  const darCiencia = useDarCiencia(ids);

  if (hosp.isLoading || comp.isLoading) return <LoadingState />;
  if (hosp.isError) return <ErrorState error={hosp.error} />;
  if (comp.isError) return <ErrorState error={comp.error} />;

  const nomePorId = new Map((hosp.data ?? []).map((h) => [h.id, h.nome]));
  const compromissos = comp.data ?? [];
  const pendentes = compromissos.filter((c) => !c.ciente_em);

  if (compromissos.length === 0)
    return <EmptyState label="Nenhum compromisso externo para seus hóspedes." />;

  return (
    <div className="space-y-6">
      {pendentes.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning-foreground">
              <AlertTriangle className="size-5" /> Sem ciência — requer ação ({pendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendentes.map((c) => (
              <CompromissoCard
                key={c.id}
                compromisso={c}
                hospedeNome={nomePorId.get(c.residente_id) ?? "Não informado"}
                onCiencia={() => darCiencia.mutate(c.id)}
                pendente={darCiencia.isPending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Todos os compromissos
        </h2>
        {compromissos.map((c) => (
          <CompromissoCard
            key={c.id}
            compromisso={c}
            hospedeNome={nomePorId.get(c.residente_id) ?? "Não informado"}
            onCiencia={() => darCiencia.mutate(c.id)}
            pendente={darCiencia.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function CompromissoCard({
  compromisso: c,
  hospedeNome,
  onCiencia,
  pendente,
}: {
  compromisso: CompromissoExterno;
  hospedeNome: string;
  onCiencia: () => void;
  pendente: boolean;
}) {
  const semCiencia = !c.ciente_em;
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center ${
        semCiencia ? "border-warning/50 bg-warning/5" : ""
      }`}
    >
      <div className="flex w-28 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary p-3 text-secondary-foreground">
        <CalendarClock className="mb-1 size-4 opacity-80" />
        <span className="text-xs font-semibold">{formatarDataBR(c.data)}</span>
        <span className="text-lg font-extrabold tabular-nums">{c.horario ?? "--:--"}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-bold text-secondary">{c.titulo}</div>
        <div className="text-sm text-muted-foreground">{hospedeNome}</div>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Bus className="size-3.5" /> Transporte às {c.horario_transporte ?? "--:--"}
        </div>
        {/* Detalhes/instruções (alimentado por Família/Administrativo no futuro). */}
        {c.detalhes && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-accent/60 px-2.5 py-1.5 text-sm text-secondary">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{c.detalhes}</span>
          </div>
        )}
      </div>

      <div className="shrink-0">
        {semCiencia ? (
          <Button variant="warning" onClick={onCiencia} disabled={pendente}>
            <Check className="size-4" /> Dar ciência
          </Button>
        ) : (
          <Badge variant="success" className="px-3 py-1.5">
            <Check className="size-3.5" /> Ciente · {c.ciente_por} · {formatarDataHoraBR(c.ciente_em)}
          </Badge>
        )}
      </div>
    </div>
  );
}
