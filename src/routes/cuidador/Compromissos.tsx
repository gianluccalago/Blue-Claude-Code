import { useState } from "react";
import { CalendarClock, Bus, Check, AlertTriangle, Info, MessageCircleHeart } from "lucide-react";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import { useCompromissos, useDarCiencia, useRegistrarComoFoi } from "@/hooks/useCompromissos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { formatarDataBR, formatarDataHoraBR, hojeISO } from "@/lib/utils";
import type { CompromissoExterno } from "@/types/database";

export function Compromissos() {
  const hosp = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const ids = (hosp.data ?? []).map((h) => h.id);
  const comp = useCompromissos(ids);
  const darCiencia = useDarCiencia(ids);
  const registrarComoFoi = useRegistrarComoFoi(ids);

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
            onComoFoi={(texto) => registrarComoFoi.mutate({ compromissoId: c.id, comoFoi: texto })}
            salvandoComoFoi={registrarComoFoi.isPending}
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
  onComoFoi,
  salvandoComoFoi = false,
}: {
  compromisso: CompromissoExterno;
  hospedeNome: string;
  onCiencia: () => void;
  pendente: boolean;
  onComoFoi?: (texto: string) => void;
  salvandoComoFoi?: boolean;
}) {
  const semCiencia = !c.ciente_em;
  const [comoFoi, setComoFoi] = useState("");
  // 5.5: após a data, o cuidador registra o desfecho ("como foi") — fecha o
  // ciclo com a família no portal.
  const jaPassou = !!c.data && c.data < hojeISO();
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

        {/* Desfecho ("como foi") — visível à família no portal */}
        {c.como_foi ? (
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-sm text-secondary">
            <MessageCircleHeart className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>
              {c.como_foi}
              <span className="block text-xs text-muted-foreground">
                {c.como_foi_por} · {c.como_foi_em ? formatarDataBR(c.como_foi_em) : ""}
              </span>
            </span>
          </div>
        ) : (
          jaPassou &&
          onComoFoi && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={comoFoi}
                onChange={(e) => setComoFoi(e.target.value)}
                placeholder="Como foi? Ex: correu bem, retorno em 30 dias"
                className="h-10 min-w-[220px] flex-1 rounded-md border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!comoFoi.trim() || salvandoComoFoi}
                onClick={() => onComoFoi(comoFoi)}
              >
                <MessageCircleHeart className="size-4" /> Registrar
              </Button>
            </div>
          )
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
