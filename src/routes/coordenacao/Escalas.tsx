import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, AlertTriangle, CalendarRange } from "lucide-react";
import {
  useTurnos,
  useCriarTurno,
  useEditarTurno,
  useExcluirTurno,
  useCriarTurnosRecorrentes,
  type TurnoValor,
} from "@/hooks/useTurnos";
import { useProfissionais } from "@/hooks/useProfissionais";
import { useRegistrarPonto } from "@/hooks/usePonto";
import { useTurnosVagosProximos } from "@/hooks/useMaster";
import { TurnoModal } from "@/components/escala/TurnoModal";
import { TurnoRecorrenteModal } from "@/components/escala/TurnoRecorrenteModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/states";
import {
  cn,
  dataISO,
  hojeISO,
  inicioDaSemana,
  somarDias,
  formatarHoraBR,
  combinarDataHoraISO,
} from "@/lib/utils";
import type { CategoriaTurno, Turno } from "@/types/database";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Visao = "semana" | "mes";
type CategoriaFiltro = "todas" | CategoriaTurno;
type ModalEstado = { inicial?: Turno; dataPadrao: string };

function primeiroDoMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function Escalas() {
  const profissionais = useProfissionais();
  const criar = useCriarTurno();
  const editar = useEditarTurno();
  const excluir = useExcluirTurno();
  const recorrentes = useCriarTurnosRecorrentes();
  const ajustarPonto = useRegistrarPonto();
  const vagos7 = useTurnosVagosProximos(7);

  const [ancora, setAncora] = useState(() => new Date());
  const [visao, setVisao] = useState<Visao>("semana");
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>("todas");
  const [profFiltro, setProfFiltro] = useState<string>("todas");
  const [modal, setModal] = useState<ModalEstado | null>(null);
  const [recorrenteAberto, setRecorrenteAberto] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [diaDetalhe, setDiaDetalhe] = useState<string | null>(null);

  // Intervalo de busca conforme a visão.
  const base = useMemo(
    () => (visao === "semana" ? inicioDaSemana(ancora) : inicioDaSemana(primeiroDoMes(ancora))),
    [visao, ancora],
  );
  const fim = useMemo(() => somarDias(base, visao === "semana" ? 6 : 41), [base, visao]);
  const turnos = useTurnos(dataISO(base), dataISO(fim));

  const nomePorId = useMemo(
    () => new Map((profissionais.data ?? []).map((p) => [p.id, p.nome])),
    [profissionais.data],
  );

  const filtrados = useMemo(
    () =>
      (turnos.data ?? []).filter(
        (t) =>
          (categoriaFiltro === "todas" || t.categoria === categoriaFiltro) &&
          (profFiltro === "todas" || t.profissional_id === profFiltro),
      ),
    [turnos.data, categoriaFiltro, profFiltro],
  );

  const turnosDoDia = (iso: string) =>
    filtrados
      .filter((t) => t.data === iso)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

  function navegar(dir: -1 | 1) {
    if (visao === "semana") {
      setAncora((a) => somarDias(a, dir * 7));
    } else {
      setAncora((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    }
    setDiaDetalhe(null);
  }

  const titulo =
    visao === "semana"
      ? `${base.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${somarDias(base, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
      : ancora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function salvar(valor: TurnoValor) {
    if (modal?.inicial) {
      editar.mutate({ id: modal.inicial.id, valor }, { onSuccess: () => setModal(null) });
    } else {
      criar.mutate(valor, { onSuccess: () => setModal(null) });
    }
  }

  const salvando = criar.isPending || editar.isPending;

  const turnosVagos = vagos7.data ?? [];

  return (
    <div className="space-y-5">
      {/* Faixa de furos de escala (próximos 7 dias) */}
      {turnosVagos.length > 0 && (
        <button
          onClick={() => {
            const primeiro = turnosVagos[0];
            setAncora(new Date(`${primeiro.data}T12:00:00`));
            setVisao("semana");
            setDiaDetalhe(primeiro.data);
          }}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-left transition-colors hover:bg-destructive/15"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            Próximos 7 dias: {turnosVagos.length} turno{turnosVagos.length > 1 ? "s" : ""} vago
            {turnosVagos.length > 1 ? "s" : ""} a cobrir
          </span>
          <span className="text-xs font-semibold text-destructive underline">ver →</span>
        </button>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAncora(new Date())}>
            Hoje
          </Button>
          <div className="flex items-center">
            <button
              onClick={() => navegar(-1)}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-secondary"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => navegar(1)}
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-secondary"
              aria-label="Próximo"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
          <h2 className="text-lg font-bold capitalize text-secondary">{titulo}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de visão */}
          <div className="flex rounded-md border border-border p-0.5">
            {(["semana", "mes"] as Visao[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisao(v)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                  visao === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-secondary",
                )}
              >
                {v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => setRecorrenteAberto(true)}>
            <CalendarRange className="size-4" /> Criar turnos recorrentes
          </Button>
          <Button onClick={() => setModal({ dataPadrao: hojeISO() })}>
            <Plus className="size-4" /> Novo turno
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value as CategoriaFiltro)}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="todas">Todas as categorias</option>
          <option value="cuidadoras">Cuidadoras</option>
          <option value="enfermeiras">Enfermeiras</option>
        </select>
        <select
          value={profFiltro}
          onChange={(e) => setProfFiltro(e.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="todas">Todas as profissionais</option>
          {(profissionais.data ?? [])
            .filter((p) => p.ativo)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
        </select>
      </div>

      {/* Conteúdo */}
      {turnos.isLoading ? (
        <LoadingState />
      ) : turnos.isError ? (
        <ErrorState error={turnos.error} />
      ) : visao === "semana" ? (
        <VisaoSemana
          base={base}
          turnosDoDia={turnosDoDia}
          nomePorId={nomePorId}
          onNovo={(iso) => setModal({ dataPadrao: iso })}
          onEditar={(t) => setModal({ inicial: t, dataPadrao: t.data })}
        />
      ) : (
        <VisaoMes
          base={base}
          mesAtual={ancora.getMonth()}
          turnosDoDia={turnosDoDia}
          diaDetalhe={diaDetalhe}
          onSelecionarDia={setDiaDetalhe}
          nomePorId={nomePorId}
          onNovo={(iso) => setModal({ dataPadrao: iso })}
          onEditar={(t) => setModal({ inicial: t, dataPadrao: t.data })}
        />
      )}

      {modal && (
        <TurnoModal
          key={modal.inicial?.id ?? "novo"}
          inicial={modal.inicial}
          dataPadrao={modal.dataPadrao}
          profissionais={profissionais.data ?? []}
          salvando={salvando}
          onSalvar={salvar}
          onExcluir={
            modal.inicial
              ? () => {
                  const id = modal.inicial!.id;
                  setModal(null);
                  setExcluirId(id);
                }
              : undefined
          }
          onAjustarPonto={
            modal.inicial?.profissional_id
              ? ({ tipo, hora }) => {
                  const t = modal.inicial!;
                  // Noturno: a saída pertence ao dia seguinte.
                  const addDias = tipo === "saida" && t.tag === "noturno" ? 1 : 0;
                  ajustarPonto.mutate({
                    turnoId: t.id,
                    tipo,
                    manual: true,
                    quando: combinarDataHoraISO(t.data, hora, addDias),
                  });
                }
              : undefined
          }
          ajustandoPonto={ajustarPonto.isPending}
          onFechar={() => setModal(null)}
        />
      )}

      {recorrenteAberto && (
        <TurnoRecorrenteModal
          profissionais={profissionais.data ?? []}
          dataPadrao={hojeISO()}
          onGerar={(args) => recorrentes.mutateAsync(args)}
          onFechar={() => setRecorrenteAberto(false)}
        />
      )}

      <ConfirmDialog
        aberto={!!excluirId}
        titulo="Excluir este turno?"
        descricao="O turno será removido da escala."
        textoConfirmar="Sim, excluir"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          if (excluirId) excluir.mutate(excluirId);
          setExcluirId(null);
        }}
        onCancelar={() => setExcluirId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TurnoCartao({
  turno,
  nome,
  onClick,
}: {
  turno: Turno;
  nome: string | undefined;
  onClick: () => void;
}) {
  const vago = !turno.profissional_id;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-md border-l-4 border bg-card p-2 text-left transition-colors hover:bg-accent",
        turno.tag === "diurno" ? "border-l-primary" : "border-l-success",
        vago && "border-destructive/50 bg-destructive/10 hover:bg-destructive/15",
      )}
    >
      <div className="text-xs font-bold tabular-nums text-secondary">
        {formatarHoraBR(turno.inicio)}–{formatarHoraBR(turno.fim)}
      </div>
      <div
        className={cn(
          "truncate text-xs",
          vago ? "font-bold text-destructive" : "text-muted-foreground",
        )}
      >
        {vago ? "VAGO" : (nome ?? "Não informado")}
      </div>
      {/* Ponto real registrado (controle interno), se houver. */}
      {(turno.check_in || turno.check_out) && (
        <div className="mt-0.5 text-[11px] tabular-nums text-primary">
          Ent {horaPonto(turno.check_in)} · Saí {horaPonto(turno.check_out)}
        </div>
      )}
    </button>
  );
}

/** Hora do ponto ou "—" quando ausente. */
function horaPonto(ts: string | null): string {
  return ts ? formatarHoraBR(ts) : "—";
}

function VisaoSemana({
  base,
  turnosDoDia,
  nomePorId,
  onNovo,
  onEditar,
}: {
  base: Date;
  turnosDoDia: (iso: string) => Turno[];
  nomePorId: Map<string, string>;
  onNovo: (iso: string) => void;
  onEditar: (t: Turno) => void;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(base, i));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {dias.map((dia) => {
        const iso = dataISO(dia);
        const ehHoje = iso === hojeISO();
        const turnos = turnosDoDia(iso);
        return (
          <Card key={iso} className={cn("flex flex-col", ehHoje && "ring-2 ring-primary")}>
            <div
              className={cn(
                "flex items-center justify-between rounded-t-lg px-3 py-2",
                ehHoje ? "bg-primary text-primary-foreground" : "bg-muted/50",
              )}
            >
              <div className="text-sm font-bold">
                {DIAS[dia.getDay()]} {dia.getDate()}
              </div>
              <button
                onClick={() => onNovo(iso)}
                className={cn(
                  "grid size-6 place-items-center rounded",
                  ehHoje ? "hover:bg-white/20" : "text-muted-foreground hover:bg-accent",
                )}
                aria-label="Novo turno neste dia"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <CardContent className="flex-1 space-y-2 p-2">
              {turnos.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground/60">—</p>
              ) : (
                turnos.map((t) => (
                  <TurnoCartao
                    key={t.id}
                    turno={t}
                    nome={t.profissional_id ? nomePorId.get(t.profissional_id) : undefined}
                    onClick={() => onEditar(t)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function VisaoMes({
  base,
  mesAtual,
  turnosDoDia,
  diaDetalhe,
  onSelecionarDia,
  nomePorId,
  onNovo,
  onEditar,
}: {
  base: Date;
  mesAtual: number;
  turnosDoDia: (iso: string) => Turno[];
  diaDetalhe: string | null;
  onSelecionarDia: (iso: string | null) => void;
  nomePorId: Map<string, string>;
  onNovo: (iso: string) => void;
  onEditar: (t: Turno) => void;
}) {
  const celulas = Array.from({ length: 42 }, (_, i) => somarDias(base, i));
  return (
    <div className="space-y-4">
      {/* Mobile: rola na horizontal com largura mínima para as células não esmagarem. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="grid min-w-[34rem] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
        {DIAS.map((d) => (
          <div key={d} className="bg-muted/50 py-2 text-center text-xs font-bold text-secondary">
            {d}
          </div>
        ))}
        {celulas.map((dia) => {
          const iso = dataISO(dia);
          const foraDoMes = dia.getMonth() !== mesAtual;
          const ehHoje = iso === hojeISO();
          const turnos = turnosDoDia(iso);
          const diurno = turnos.filter((t) => t.tag === "diurno").length;
          const noturno = turnos.filter((t) => t.tag === "noturno").length;
          const vagos = turnos.filter((t) => !t.profissional_id).length;
          const selecionado = iso === diaDetalhe;
          return (
            <button
              key={iso}
              onClick={() => onSelecionarDia(selecionado ? null : iso)}
              className={cn(
                "min-h-20 bg-card p-2 text-left align-top transition-colors hover:bg-accent",
                foraDoMes && "bg-muted/30 text-muted-foreground/50",
                selecionado && "ring-2 ring-inset ring-primary",
              )}
            >
              <div
                className={cn(
                  "mb-1 inline-grid size-6 place-items-center rounded-full text-xs font-bold",
                  ehHoje ? "bg-primary text-primary-foreground" : "text-secondary",
                )}
              >
                {dia.getDate()}
              </div>
              {turnos.length > 0 && (
                <div className="space-y-0.5 text-[11px] leading-tight">
                  <div className="text-muted-foreground">
                    D: {diurno} · N: {noturno}
                  </div>
                  {vagos > 0 && (
                    <div className="font-bold text-destructive">
                      {vagos} vago{vagos > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      </div>

      {/* Detalhe do dia selecionado */}
      {diaDetalhe && (
        <Card>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-bold text-secondary">
              <CalendarDays className="size-5 text-primary" />
              {new Date(diaDetalhe + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </div>
            <Button size="sm" onClick={() => onNovo(diaDetalhe)}>
              <Plus className="size-4" /> Novo turno
            </Button>
          </div>
          <CardContent className="space-y-2 p-4">
            {turnosDoDia(diaDetalhe).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhum turno neste dia.
              </p>
            ) : (
              turnosDoDia(diaDetalhe).map((t) => {
                const vago = !t.profissional_id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onEditar(t)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border-l-4 border bg-card p-3 text-left transition-colors hover:bg-accent",
                      t.tag === "diurno" ? "border-l-primary" : "border-l-success",
                      vago && "border-destructive/50 bg-destructive/10",
                    )}
                  >
                    <span className="w-28 shrink-0 text-sm font-bold tabular-nums text-secondary">
                      {formatarHoraBR(t.inicio)}–{formatarHoraBR(t.fim)}
                      {/* Ponto real (controle interno) abaixo do planejado. */}
                      {(t.check_in || t.check_out) && (
                        <span className="block text-[11px] font-medium text-primary">
                          Ent {horaPonto(t.check_in)} · Saí {horaPonto(t.check_out)}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm",
                        vago ? "font-bold text-destructive" : "text-secondary",
                      )}
                    >
                      {vago ? (
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="size-4" /> VAGO
                        </span>
                      ) : (
                        nomePorId.get(t.profissional_id!) ?? "Não informado"
                      )}
                    </span>
                    <span className="text-xs capitalize text-muted-foreground">
                      {t.categoria} · {t.tag}
                    </span>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
