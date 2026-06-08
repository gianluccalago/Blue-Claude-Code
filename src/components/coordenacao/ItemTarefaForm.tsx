import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TAREFAS_PREDEFINIDAS, TAREFA_OUTRA, type Responsavel } from "@/data/tarefas";

export interface ItemTarefaValor {
  tarefa: string;
  horario: string;
  responsavel: Responsavel;
  tolerancia_minutos: number;
}

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Formulário compartilhado para adicionar uma tarefa, usado tanto no plano de
 * cuidado do hóspede quanto nos itens de um modelo de rotina.
 * O seletor inclui a opção "Outra (digitar)" que libera um campo de texto livre.
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
  const [horario, setHorario] = useState("");
  const [responsavel, setResponsavel] = useState<Responsavel | "">("");
  const [tolerancia, setTolerancia] = useState(30);

  const ehOutra = tarefaSel === TAREFA_OUTRA;
  const tarefaFinal = ehOutra ? tarefaOutra.trim() : tarefaSel;
  const valido = !!tarefaFinal && !!horario && !!responsavel;

  function submeter() {
    if (!valido) return;
    onSalvar({
      tarefa: tarefaFinal,
      horario,
      responsavel: responsavel as Responsavel,
      tolerancia_minutos: Number.isFinite(tolerancia) ? tolerancia : 30,
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

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-secondary">Horário</label>
          <input
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            className={inputBase}
          />
        </div>

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
