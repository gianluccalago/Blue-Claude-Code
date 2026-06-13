import { Ambulance, Stethoscope, Timer, Hospital } from "lucide-react";
import { cn } from "@/lib/utils";
import { DESFECHO_AMBULANCIA, type DadosAmbulancia } from "@/lib/ambulancia";
import type { DesfechoAmbulancia } from "@/types/database";

// Bloco reutilizável do CHAMADO DE AMBULÂNCIA dentro de uma intercorrência.
// Controlado: o pai guarda `acionada` + `valor` e recebe as mudanças.

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AmbulanciaFields({
  acionada,
  onAcionadaChange,
  valor,
  onChange,
}: {
  acionada: boolean;
  onAcionadaChange: (v: boolean) => void;
  valor: DadosAmbulancia;
  onChange: (patch: Partial<DadosAmbulancia>) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Toggle: a ambulância foi acionada? */}
      <button
        type="button"
        onClick={() => onAcionadaChange(!acionada)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
          acionada
            ? "border-destructive bg-destructive/5"
            : "border-dashed border-border hover:border-destructive/50",
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            acionada ? "bg-destructive text-white" : "bg-accent text-secondary",
          )}
        >
          <Ambulance className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-secondary">Chamado de ambulância</span>
          <span className="block text-xs text-muted-foreground">
            {acionada ? "Acionada — preencha o atendimento abaixo" : "Toque se a ambulância (SAMU/privada) foi acionada"}
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            acionada ? "bg-destructive" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
              acionada ? "left-[1.375rem]" : "left-0.5",
            )}
          />
        </span>
      </button>

      {acionada && (
        <div className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                <Stethoscope className="size-3.5" /> Médico que atendeu
              </span>
              <input
                value={valor.medico}
                onChange={(e) => onChange({ medico: e.target.value })}
                placeholder="Nome do médico"
                className={inputBase}
              />
            </label>
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                <Timer className="size-3.5" /> Tempo até chegar (min)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={valor.tempoRespostaMin ?? ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  onChange({ tempoRespostaMin: Number.isFinite(n) ? n : null });
                }}
                placeholder="ex: 25"
                className={inputBase}
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Desfecho</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {DESFECHO_AMBULANCIA.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onChange({ desfecho: d.value as DesfechoAmbulancia })}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-semibold transition-all",
                    valor.desfecho === d.value
                      ? "border-secondary bg-secondary text-secondary-foreground shadow-card"
                      : "border-border bg-card text-secondary hover:border-secondary/50",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {valor.desfecho === "removido_hospital" && (
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-secondary">
                <Hospital className="size-3.5" /> Hospital de destino
              </span>
              <input
                value={valor.hospitalDestino}
                onChange={(e) => onChange({ hospitalDestino: e.target.value })}
                placeholder="ex: Hospital Marcelino Champagnat"
                className={inputBase}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
