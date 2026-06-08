import { LogIn, LogOut, CheckCircle2, CalendarOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/states";
import { formatarHoraBR } from "@/lib/utils";
import type { Plantao } from "@/hooks/usePlantao";

/**
 * Faixa de estado do plantão no topo das telas de registro do Cuidador.
 * Controla o check-in/check-out e comunica se o checklist está liberado.
 * (Geolocalização será acoplada ao check-in numa etapa posterior.)
 */
export function PlantaoBar({ plantao }: { plantao: Plantao }) {
  if (plantao.estado === "carregando") return <LoadingState label="Verificando seu plantão…" />;

  if (plantao.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
        Não foi possível verificar seu plantão. Tente recarregar.
      </div>
    );
  }

  if (plantao.estado === "sem_turno") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <CalendarOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-bold text-secondary">Você não tem plantão ativo no momento</p>
          <p className="text-sm text-muted-foreground">
            Para registrar cuidados, solicite à Coordenação Assistencial que inclua você na escala.
          </p>
        </div>
      </div>
    );
  }

  if (plantao.estado === "sem_checkin") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-bold text-secondary">Inicie seu plantão</p>
            <p className="text-sm text-muted-foreground">
              Faça o check-in para registrar os cuidados.
            </p>
          </div>
        </div>
        <Button size="lg" onClick={plantao.fazerCheckIn} disabled={plantao.pending}>
          <LogIn className="size-5" /> Iniciar plantão (check-in)
        </Button>
      </div>
    );
  }

  // estado === "ativo"
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        <div>
          <p className="font-bold text-secondary">
            Plantão ativo — iniciado às {formatarHoraBR(plantao.checkInEm)}
          </p>
          <p className="text-sm text-muted-foreground">
            Os registros de cuidado estão liberados.
          </p>
        </div>
      </div>
      <Button variant="outline" size="lg" onClick={plantao.fazerCheckOut} disabled={plantao.pending}>
        <LogOut className="size-5" /> Encerrar plantão (check-out)
      </Button>
    </div>
  );
}
