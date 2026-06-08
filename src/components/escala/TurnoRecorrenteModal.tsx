import { useEffect, useState } from "react";
import { Sun, Moon, CalendarRange, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { profissionaisDaCategoria } from "@/components/escala/TurnoModal";
import type { RecorrenciaArgs, RecorrenciaResultado } from "@/hooks/useTurnos";
import type { CategoriaTurno, TagTurno, Usuario } from "@/types/database";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const inputBase =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Conta as datas do período que caem nos dias da semana escolhidos. */
function contarCandidatas(diasSemana: number[], dataInicial: string, dataFinal: string): number {
  if (!dataInicial || !dataFinal || diasSemana.length === 0) return 0;
  const ini = new Date(dataInicial + "T00:00:00");
  const fim = new Date(dataFinal + "T00:00:00");
  if (ini > fim) return 0;
  let n = 0;
  for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    if (diasSemana.includes(d.getDay())) n++;
  }
  return n;
}

/** Excedeu 3 meses entre inicial e final? */
function excede3Meses(dataInicial: string, dataFinal: string): boolean {
  if (!dataInicial || !dataFinal) return false;
  const ini = new Date(dataInicial + "T00:00:00");
  const limite = new Date(ini);
  limite.setMonth(limite.getMonth() + 3);
  return new Date(dataFinal + "T00:00:00") > limite;
}

export function TurnoRecorrenteModal({
  profissionais,
  dataPadrao,
  onGerar,
  onFechar,
}: {
  profissionais: Usuario[];
  dataPadrao: string;
  onGerar: (args: RecorrenciaArgs) => Promise<RecorrenciaResultado>;
  onFechar: () => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaTurno>("cuidadoras");
  const [tag, setTag] = useState<TagTurno>("diurno");
  const [inicioTime, setInicioTime] = useState("07:00");
  const [fimTime, setFimTime] = useState("19:00");
  const [fimDiaSeguinte, setFimDiaSeguinte] = useState(false);
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [diasSemana, setDiasSemana] = useState<Set<number>>(new Set());
  const [dataInicial, setDataInicial] = useState(dataPadrao);
  const [dataFinal, setDataFinal] = useState(dataPadrao);

  const [etapa, setEtapa] = useState<"form" | "confirmar" | "resultado">("form");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<RecorrenciaResultado | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const elegiveis = profissionaisDaCategoria(profissionais, categoria);
  const profValido = elegiveis.some((p) => p.id === profissionalId) ? profissionalId : "";

  const diasArray = [...diasSemana].sort();
  const total = contarCandidatas(diasArray, dataInicial, dataFinal);
  const excedeu = excede3Meses(dataInicial, dataFinal);
  const periodoInvalido = !dataInicial || !dataFinal || dataInicial > dataFinal;
  const valido = diasSemana.size > 0 && !periodoInvalido && !excedeu && total > 0;

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
  function toggleDia(d: number) {
    setDiasSemana((prev) => {
      const novo = new Set(prev);
      if (novo.has(d)) novo.delete(d);
      else novo.add(d);
      return novo;
    });
  }

  async function gerar() {
    setGerando(true);
    try {
      const r = await onGerar({
        categoria,
        tag,
        diasSemana: diasArray,
        dataInicial,
        dataFinal,
        inicioTime,
        fimTime,
        fimDiaSeguinte,
        profissional_id: profValido || null,
      });
      setResultado(r);
      setEtapa("resultado");
    } finally {
      setGerando(false);
    }
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
        <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
          <CalendarRange className="size-5 text-primary" /> Criar turnos recorrentes
        </h2>

        {etapa === "resultado" && resultado ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-4 text-success">
              <CheckCircle2 className="size-6 shrink-0" />
              <div>
                <p className="font-bold">
                  {resultado.criados} turno{resultado.criados === 1 ? "" : "s"} criado
                  {resultado.criados === 1 ? "" : "s"}.
                </p>
                {resultado.pulados > 0 && (
                  <p className="text-sm text-secondary/80">
                    {resultado.pulados} dia{resultado.pulados === 1 ? "" : "s"} pulado
                    {resultado.pulados === 1 ? "" : "s"} (a profissional já tinha turno).
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onFechar}>Fechar</Button>
            </div>
          </div>
        ) : etapa === "confirmar" ? (
          <div className="mt-6 space-y-4">
            <p className="text-secondary">
              Serão criados <span className="font-bold">{total}</span> turno
              {total === 1 ? "" : "s"}
              {profValido ? "" : " (vagos)"}. Continuar?
            </p>
            {profValido && (
              <p className="text-sm text-muted-foreground">
                Dias em que a profissional já tiver turno serão pulados automaticamente.
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={gerar} disabled={gerando}>
                {gerando ? "Criando…" : "Continuar"}
              </Button>
              <Button variant="outline" onClick={() => setEtapa("form")} disabled={gerando}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
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

            {/* Profissional (opcional) */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">
                Profissional (opcional)
              </label>
              <select
                value={profValido}
                onChange={(e) => setProfissionalId(e.target.value)}
                className={inputBase}
              >
                <option value="">Deixar vago (gerar slots a preencher)</option>
                {elegiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Dias da semana */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-secondary">
                Dias da semana
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DIAS.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => toggleDia(i)}
                    className={`rounded-md border py-2 text-xs font-semibold transition-colors ${
                      diasSemana.has(i)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Período */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-secondary">De</label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-secondary">
                  Repetir até
                </label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>

            {/* Avisos / resumo */}
            {excedeu && (
              <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" /> Máximo de 3 meses por geração.
              </p>
            )}
            {!excedeu && !periodoInvalido && diasSemana.size > 0 && (
              <p className="text-sm text-muted-foreground">
                Prévia: <span className="font-semibold text-secondary">{total}</span> turno
                {total === 1 ? "" : "s"} no período.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={() => setEtapa("confirmar")} disabled={!valido}>
                Revisar e criar
              </Button>
              <Button variant="outline" onClick={onFechar}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
