import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TAREFAS_PREDEFINIDAS, TAREFA_OUTRA, TURNO_LIVRE_OPCOES, type Responsavel } from "@/data/tarefas";
import type { TurnoLivre } from "@/types/database";

export interface ItemTarefaValor {
  tarefa: string;
  /** Horário fixo "HH:MM"; null quando a tarefa é ao longo do turno. */
  horario: string | null;
  /** Ao longo do turno (0145): diurno | noturno | ambos; null = horário fixo. */
  turno_livre: TurnoLivre | null;
  responsavel: Responsavel;
  tolerancia_minutos: number;
}

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Valor do seletor "Quando": horário fixo ou uma das opções ao longo do turno. */
export type QuandoTarefa = "horario" | TurnoLivre;

export function SeletorQuando({
  valor,
  onChange,
  className,
}: {
  valor: QuandoTarefa;
  onChange: (v: QuandoTarefa) => void;
  className?: string;
}) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value as QuandoTarefa)} className={className ?? inputBase}>
      <option value="horario">Em horário fixo</option>
      {TURNO_LIVRE_OPCOES.map((o) => (
        <option key={o.valor} value={o.valor}>{o.label}</option>
      ))}
    </select>
  );
}

/**
 * Formulário compartilhado para adicionar uma tarefa, usado tanto no plano de
 * cuidado do hóspede quanto nos itens de um modelo de rotina.
 * O seletor inclui a opção "Outra (digitar)" que libera um campo de texto livre.
 * "Quando": em horário fixo (com tolerância) ou a qualquer momento do turno —
 * ex.: banho, feito em qualquer hora do plantão de 12h.
 */
export function ItemTarefaForm({
  onSalvar,
  onCancelar,
  salvando,
}: {
  onSalvar: (valor: ItemTarefaValor) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [tarefaSel, setTarefaSel] = useState("");
  const [tarefaOutra, setTarefaOutra] = useState("");
  const [quando, setQuando] = useState<QuandoTarefa>("horario");
  const [horario, setHorario] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel | "">("");
  const [tolerancia, setTolerancia] = useState(30);

  const ehOutra = tarefaSel === TAREFA_OUTRA;
  const aoLongoDoTurno = quando !== "horario";
  const tarefaFinal = ehOutra ? tarefaOutra.trim() : tarefaSel;
  const valido = !!tarefaFinal && (aoLongoDoTurno || !!horario) && !!responsavel;

  function submeter() {
    if (!valido) return;
    onSalvar({
      tarefa: tarefaFinal,
      horario: aoLongoDoTurno ? null : horario,
      turno_livre: aoLongoDoTurno ? quando : null,
      responsavel: responsavel as Responsavel,
      tolerancia_minutos: aoLongoDoTurno ? 0 : Number.isFinite(tolerancia) ? tolerancia : 30,
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-accent/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Tarefa</label>
          <select
            value={tarefaSel}
            onChange={(e) => setTarefaSel(e.target.value)}
            className={inputBase}
          >
            <option value="" disabled>
              Selecione uma tarefa…
            </option>
            {TAREFAS_PREDEFINIDAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={TAREFA_OUTRA}>{TAREFA_OUTRA}</option>
          </select>
          {ehOutra && (
            <input
              autoFocus
              value={tarefaOutra}
              onChange={(e) => setTarefaOutra(e.target.value)}
              placeholder="Descreva a tarefa…"
              className={`${inputBase} mt-2`}
            />
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Quando</label>
          <SeletorQuando valor={quando} onChange={setQuando} />
          {aoLongoDoTurno && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sem hora marcada: a cuidadora marca como feita em qualquer momento do plantão e o sistema registra quem fez e quando.
            </p>
          )}
        </div>

        {!aoLongoDoTurno && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Horário</label>
            <input
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              className={inputBase}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Responsável</label>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value as Responsavel)}
            className={inputBase}
          >
            <option value="" disabled>
              Selecione…
            </option>
            <option value="cuidador">Cuidador</option>
            <option value="enfermagem">Enfermagem</option>
          </select>
        </div>

        {!aoLongoDoTurno && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">
              Tolerância (minutos)
            </label>
            <input
              type="number"
              min={0}
              value={tolerancia}
              onChange={(e) => setTolerancia(parseInt(e.target.value, 10))}
              className={inputBase}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={submeter} disabled={!valido || salvando}>
          <Check className="size-4" /> Salvar tarefa
        </Button>
        <Button variant="outline" onClick={onCancelar} disabled={salvando}>
          <X className="size-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
