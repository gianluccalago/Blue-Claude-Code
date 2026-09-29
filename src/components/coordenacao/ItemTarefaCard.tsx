import { Clock4, Pencil, Trash2, Sun, Moon, SunMoon, Repeat, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ouNaoInformado } from "@/lib/utils";
import { rotuloTurnoLivre } from "@/data/tarefas";
import { rotuloIntervalo } from "@/lib/rotina";
import type { TurnoLivre } from "@/types/database";

/** Ícone do "quando" de uma tarefa ao longo do turno. */
export function IconeTurnoLivre({ turnoLivre, className }: { turnoLivre: TurnoLivre; className?: string }) {
  const cls = className ?? "size-4 text-muted-foreground";
  if (turnoLivre === "diurno") return <Sun className={cls} />;
  if (turnoLivre === "noturno") return <Moon className={cls} />;
  return <SunMoon className={cls} />;
}

/**
 * Cartão de exibição de uma tarefa (plano ou modelo): horário (ou "ao longo
 * do turno"), nome, responsável e tolerância, com ações de editar e remover.
 */
export function ItemTarefaCard({
  tarefa,
  horario,
  turnoLivre,
  intervaloDias,
  objetivo,
  responsavel,
  toleranciaMinutos,
  onEditar,
  onRemover,
  disabled,
}: {
  tarefa: string;
  horario: string | null;
  turnoLivre?: TurnoLivre | null;
  intervaloDias?: number | null;
  /** Descrição do objetivo de autonomia que a tarefa apoia. */
  objetivo?: string | null;
  responsavel: string | null;
  toleranciaMinutos: number;
  /** Sem onEditar/onRemover → cartão somente leitura (esconde as ações). */
  onEditar?: () => void;
  onRemover?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex w-16 shrink-0 flex-col items-center text-center">
        {turnoLivre ? (
          <>
            <IconeTurnoLivre turnoLivre={turnoLivre} />
            <span className="text-[11px] font-bold leading-tight text-secondary">{rotuloTurnoLivre(turnoLivre)}</span>
          </>
        ) : (
          <>
            <Clock4 className="size-4 text-muted-foreground" />
            <span className="text-sm font-bold tabular-nums text-secondary">{horario ?? "--:--"}</span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-secondary">{tarefa}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant={responsavel === "enfermagem" ? "secondary" : "muted"}>
            {ouNaoInformado(responsavel)}
          </Badge>
          {objetivo ? (
            <Badge variant="success" className="gap-1"><Target className="size-3" /> {objetivo}</Badge>
          ) : null}
          {intervaloDias ? (
            <Badge variant="default" className="gap-1"><Repeat className="size-3" /> {rotuloIntervalo(intervaloDias)}</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {turnoLivre ? "A qualquer momento do turno" : `Tolerância: ${toleranciaMinutos} min`}
          </span>
        </div>
      </div>
      {(onEditar || onRemover) && (
        <div className="flex shrink-0 gap-1">
          {onEditar && (
            <button
              onClick={onEditar}
              disabled={disabled}
              className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-secondary"
              aria-label="Editar"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {onRemover && (
            <button
              onClick={onRemover}
              disabled={disabled}
              className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
