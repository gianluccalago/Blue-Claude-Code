import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeletorQuando, SeletorRepeticao, SeletorObjetivo, intervaloValido, type QuandoTarefa } from "@/components/coordenacao/ItemTarefaForm";
import type { TurnoLivre } from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface EdicaoItemTarefa {
  horario: string | null;
  turno_livre: TurnoLivre | null;
  intervalo_dias: number | null;
  tolerancia_minutos: number;
  /** Só no plano do hóspede (autonomia, 0147). */
  objetivo_id?: string | null;
}

/**
 * Edição enxuta de um item já existente: "quando" (horário fixo com
 * tolerância, ou ao longo do turno) e "repetir" (todo dia / a cada N dias). A tarefa e o responsável não mudam aqui.
 * Reutilizado em planos e modelos.
 */
export function EditarItemForm({
  horarioInicial,
  turnoLivreInicial,
  intervaloInicial,
  toleranciaInicial,
  objetivos,
  objetivoInicial,
  onSalvar,
  onCancelar,
  salvando,
}: {
  horarioInicial: string | null;
  turnoLivreInicial?: TurnoLivre | null;
  intervaloInicial?: number | null;
  toleranciaInicial: number;
  objetivos?: ReadonlyArray<{ id: string; descricao: string }>;
  objetivoInicial?: string | null;
  onSalvar: (args: EdicaoItemTarefa) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [quando, setQuando] = useState<QuandoTarefa>(turnoLivreInicial ?? "horario");
  const [horario, setHorario] = useState(horarioInicial ?? "");
  const [tolerancia, setTolerancia] = useState(toleranciaInicial);
  const [intervalo, setIntervalo] = useState<number | null>(intervaloInicial ?? null);
  const [objetivoId, setObjetivoId] = useState<string | null>(objetivoInicial ?? null);
  const aoLongoDoTurno = quando !== "horario";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-primary/30 bg-accent/40 p-3">
      <div className="min-w-[220px]">
        <label className="mb-1 block text-xs font-semibold text-secondary">Quando</label>
        <SeletorQuando valor={quando} onChange={setQuando} className={inputBase} />
      </div>
      <div className="min-w-[200px]">
        <label className="mb-1 block text-xs font-semibold text-secondary">Repetir</label>
        <SeletorRepeticao valor={intervalo} onChange={setIntervalo} compacto />
      </div>
      {objetivos && objetivos.length > 0 && (
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-semibold text-secondary">Apoia o objetivo</label>
          <SeletorObjetivo objetivos={objetivos} valor={objetivoId} onChange={setObjetivoId} className={inputBase} />
        </div>
      )}
      {!aoLongoDoTurno && (
        <>
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
        </>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={(!aoLongoDoTurno && !horario) || !intervaloValido(intervalo) || salvando}
          onClick={() =>
            onSalvar({
              horario: aoLongoDoTurno ? null : horario,
              turno_livre: aoLongoDoTurno ? quando : null,
              intervalo_dias: intervalo,
              ...(objetivos ? { objetivo_id: objetivoId } : {}),
              tolerancia_minutos: aoLongoDoTurno ? 0 : Number.isFinite(tolerancia) ? tolerancia : 30,
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
