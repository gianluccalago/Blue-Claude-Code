import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Edição enxuta de um item já existente: apenas horário e tolerância
 * (a tarefa e o responsável não mudam aqui). Reutilizado em planos e modelos.
 */
export function EditarItemForm({
  horarioInicial,
  toleranciaInicial,
  onSalvar,
  onCancelar,
  salvando,
}: {
  horarioInicial: string | null;
  toleranciaInicial: number;
  onSalvar: (args: { horario: string; tolerancia_minutos: number }) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [horario, setHorario] = useState(horarioInicial ?? "");
  const [tolerancia, setTolerancia] = useState(toleranciaInicial);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-primary/30 bg-accent/40 p-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-secondary">Horário</label>
        <input
          type="time"
          value={horario}
          onChange={(e) => setHorario(e.target.value)}
          className={inputBase}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-secondary">Tolerância (min)</label>
        <input
          type="number"
          min={0}
          value={tolerancia}
          onChange={(e) => setTolerancia(parseInt(e.target.value, 10))}
          className={inputBase}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!horario || salvando}
          onClick={() =>
            onSalvar({
              horario,
              tolerancia_minutos: Number.isFinite(tolerancia) ? tolerancia : 30,
            })
          }
        >
          <Check className="size-4" /> Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={onCancelar} disabled={salvando}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
