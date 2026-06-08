import { useEffect, useState } from "react";
import { Check, Trash2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarHoraBR, dataISO } from "@/lib/utils";
import type { TurnoValor } from "@/hooks/useTurnos";
import type { CategoriaTurno, TagTurno, Turno, Usuario } from "@/types/database";

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Profissionais ativas de uma categoria (cuidadoras vs enfermeiras). */
export function profissionaisDaCategoria(profissionais: Usuario[], categoria: CategoriaTurno) {
  return profissionais.filter((u) => {
    if (!u.ativo) return false;
    if (categoria === "cuidadoras") return u.funcao === "Cuidadora";
    return u.funcao === "Técnica de Enfermagem" || u.funcao === "Enfermeira";
  });
}

/** Combina data (YYYY-MM-DD) + hora (HH:MM) [+ dias] num ISO local→UTC. */
function combinarISO(data: string, hora: string, addDias = 0): string {
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  return new Date(y, m - 1, d + addDias, hh, mm, 0, 0).toISOString();
}

export function TurnoModal({
  inicial,
  dataPadrao,
  profissionais,
  salvando,
  onSalvar,
  onExcluir,
  onFechar,
}: {
  inicial?: Turno;
  dataPadrao: string;
  profissionais: Usuario[];
  salvando: boolean;
  onSalvar: (valor: TurnoValor) => void;
  onExcluir?: () => void;
  onFechar: () => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaTurno>(inicial?.categoria ?? "cuidadoras");
  const [data, setData] = useState(inicial?.data ?? dataPadrao);
  const [tag, setTag] = useState<TagTurno>(inicial?.tag ?? "diurno");
  const [inicioTime, setInicioTime] = useState(
    inicial ? formatarHoraBR(inicial.inicio) : "07:00",
  );
  const [fimTime, setFimTime] = useState(inicial ? formatarHoraBR(inicial.fim) : "19:00");
  const [fimDiaSeguinte, setFimDiaSeguinte] = useState(
    inicial ? dataISO(new Date(inicial.fim)) !== inicial.data : false,
  );
  const [profissionalId, setProfissionalId] = useState<string>(inicial?.profissional_id ?? "");
  const [obs, setObs] = useState(inicial?.observacao_interna ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const elegiveis = profissionaisDaCategoria(profissionais, categoria);
  // Se a profissional selecionada não pertence mais à categoria, vira "vago".
  const profValido = elegiveis.some((p) => p.id === profissionalId) ? profissionalId : "";

  function aplicarDiurno() {
    setTag("diurno");
    setInicioTime("07:00");
    setFimTime("19:00");
    setFimDiaSeguinte(false);
  }
  function aplicarNoturno() {
    setTag("noturno");
    setInicioTime("19:00");
    setFimTime("07:00");
    setFimDiaSeguinte(true);
  }

  const valido = !!data && !!inicioTime && !!fimTime;

  function salvar() {
    if (!valido) return;
    onSalvar({
      profissional_id: profValido || null,
      categoria,
      data,
      inicio: combinarISO(data, inicioTime, 0),
      fim: combinarISO(data, fimTime, fimDiaSeguinte ? 1 : 0),
      tag,
      observacao_interna: obs.trim() || null,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-hidden="true"
        tabIndex={-1}
        onClick={onFechar}
        className="absolute inset-0 cursor-default bg-secondary/40 backdrop-blur-sm"
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-6 shadow-soft">
        <h2 className="text-lg font-bold text-secondary">
          {inicial ? "Editar turno" : "Novo turno"}
        </h2>

        <div className="mt-4 space-y-4">
          {/* Categoria */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaTurno)}
              className={inputBase}
            >
              <option value="cuidadoras">Cuidadoras</option>
              <option value="enfermeiras">Enfermeiras</option>
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputBase}
            />
          </div>

          {/* Atalhos de turno */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">
              Turno padrão
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={aplicarDiurno}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tag === "diurno"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-secondary hover:border-primary/50"
                }`}
              >
                <Sun className="size-4" /> Diurno (07:00–19:00)
              </button>
              <button
                onClick={aplicarNoturno}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tag === "noturno"
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-card text-secondary hover:border-success/50"
                }`}
              >
                <Moon className="size-4" /> Noturno (19:00–07:00)
              </button>
            </div>
          </div>

          {/* Horários manuais */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Início</label>
              <input
                type="time"
                value={inicioTime}
                onChange={(e) => setInicioTime(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">Fim</label>
              <input
                type="time"
                value={fimTime}
                onChange={(e) => setFimTime(e.target.value)}
                className={inputBase}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-secondary">
            <input
              type="checkbox"
              checked={fimDiaSeguinte}
              onChange={(e) => setFimDiaSeguinte(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Fim no dia seguinte (turno cruza a meia-noite)
          </label>

          {/* Profissional */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">Profissional</label>
            <select
              value={profValido}
              onChange={(e) => setProfissionalId(e.target.value)}
              className={inputBase}
            >
              <option value="">Deixar vago</option>
              {elegiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Observação interna */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-secondary">
              Observação interna (opcional)
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              placeholder="Visível só para a gestão…"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={!valido || salvando}>
              <Check className="size-4" /> {inicial ? "Salvar" : "Criar turno"}
            </Button>
            <Button variant="outline" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
          </div>
          {inicial && onExcluir && (
            <Button variant="outline" onClick={onExcluir} disabled={salvando}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
