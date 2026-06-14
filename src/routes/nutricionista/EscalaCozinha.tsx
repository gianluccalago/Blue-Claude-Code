/**
 * Escala da cozinha — Nutricionista (BLOCO N5).
 *
 * IMPORTANTE: é uma escala PRÓPRIA da cozinha (CLT), INDEPENDENTE do módulo de
 * Escalas assistenciais (cuidadores) e do PONTO. Serve ao controle interno da
 * Nutricionista — apenas visual. A marcação de presença/falta é opcional e NÃO
 * é ponto CLT.
 *
 * Dois grupos por paridade do dia (pares × ímpares), 5 pessoas/dia, em turnos
 * fixos. Como turno e grupo são fixos por pessoa, a escala se gera sozinha a
 * partir do cadastro (botão "Gerar escala"), com ajustes manuais pontuais.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChefHat,
  CalendarDays,
  Users,
  Wand2,
  Check,
  X,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import {
  useFuncionariosCozinha,
  useSalvarFuncionario,
  useDefinirAtivoFuncionario,
  useEscalaCozinha,
  useGerarEscala,
  useAtualizarEscala,
  useRemoverEscala,
} from "@/hooks/useCozinha";
import {
  TURNOS_COZINHA,
  FUNCAO_COZINHA_LABEL,
  GRUPO_COZINHA_LABEL,
  NECESSIDADE_TURNO,
  partesTurno,
  gerarEscalaPeriodo,
  coberturaDoDia,
  diasNoIntervalo,
} from "@/lib/cozinha";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/primitives";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, dataISO, formatarDataBR, inicioDaSemana, somarDias, ouNaoInformado } from "@/lib/utils";
import type {
  CozinhaEscala,
  CozinhaFuncionario,
  FuncaoCozinha,
  GrupoCozinha,
  TurnoCozinha,
} from "@/types/database";

const inputBase =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function EscalaCozinha() {
  const funcionarios = useFuncionariosCozinha();

  if (funcionarios.isLoading) return <LoadingState />;
  if (funcionarios.isError) return <ErrorState error={funcionarios.error} />;
  const equipe = funcionarios.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow-primary">
          <ChefHat className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-secondary">Escala da cozinha</h1>
          <p className="text-sm text-muted-foreground">
            Escala própria da cozinha (CLT) · controle interno da Nutrição · sem ponto.
          </p>
        </div>
      </div>

      <Tabs defaultValue="escala">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="escala" className="gap-1.5"><CalendarDays className="size-4" /> Escala</TabsTrigger>
          <TabsTrigger value="equipe" className="gap-1.5"><Users className="size-4" /> Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="escala">
          <Calendario equipe={equipe} />
        </TabsContent>
        <TabsContent value="equipe">
          <Equipe equipe={equipe} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Calendário (semana/mês) + geração + cobertura ──────────────────────────

function Calendario({ equipe }: { equipe: CozinhaFuncionario[] }) {
  const [modo, setModo] = useState<"semana" | "mes">("semana");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const { de, ate, titulo } = useMemo(() => rangeDe(modo, anchor), [modo, anchor]);
  const escala = useEscalaCozinha(de, ate);
  const gerar = useGerarEscala();

  const porId = useMemo(() => new Map(equipe.map((f) => [f.id, f])), [equipe]);
  const dias = useMemo(() => diasNoIntervalo(de, ate), [de, ate]);
  const escalas = escala.data ?? [];

  const coberturas = useMemo(
    () => dias.map((d) => coberturaDoDia(d, escalas, porId)),
    [dias, escalas, porId],
  );
  const diasDescobertos = coberturas.filter((c) => c.algumDescoberto).length;

  const faltantes = useMemo(
    () => gerarEscalaPeriodo(de, ate, equipe, escalas),
    [de, ate, equipe, escalas],
  );

  async function gerarEscala() {
    if (faltantes.length === 0) return;
    try {
      await gerar.mutateAsync(faltantes);
      toast.success(`Escala gerada: ${faltantes.length} ${faltantes.length === 1 ? "turno" : "turnos"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a escala.");
    }
  }

  function navegar(dir: -1 | 1) {
    setAnchor((a) => (modo === "semana" ? somarDias(a, dir * 7) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  }

  return (
    <div className="space-y-4">
      {/* Controles: período, navegação, geração */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/70 p-0.5">
              <SegBtn ativo={modo === "semana"} onClick={() => setModo("semana")}>Semana</SegBtn>
              <SegBtn ativo={modo === "mes"} onClick={() => setModo("mes")}>Mês</SegBtn>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => navegar(-1)} aria-label="Anterior"><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => navegar(1)} aria-label="Próximo"><ChevronRight className="size-4" /></Button>
            </div>
            <span className="text-sm font-semibold text-secondary">{titulo}</span>
          </div>
          <Button onClick={gerarEscala} disabled={faltantes.length === 0 || gerar.isPending}>
            <Wand2 className="size-4" />
            {faltantes.length === 0
              ? "Escala completa"
              : gerar.isPending
                ? "Gerando…"
                : `Gerar escala (${faltantes.length})`}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarDays} tom="secondary" rotulo="Dias no período" valor={dias.length} />
        <StatCard
          icon={AlertTriangle}
          tom={diasDescobertos > 0 ? "destructive" : "success"}
          destaque={diasDescobertos > 0}
          rotulo="Dias com turno descoberto"
          valor={diasDescobertos}
        />
        <StatCard icon={UserCheck} tom="primary" rotulo="Turnos escalados" valor={escalas.length} />
      </div>

      <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Controle interno da Nutrição — a marcação de presença/falta é apenas visual e <strong>não é ponto CLT</strong>.
      </p>

      {escala.isLoading ? (
        <LoadingState />
      ) : escalas.length === 0 && faltantes.length === 0 ? (
        <EmptyState label="Sem equipe ativa para escalar neste período." />
      ) : (
        <div className="space-y-3">
          {coberturas.map((c) => (
            <DiaCard key={c.data} cobertura={c} escalas={escalas} equipe={equipe} porId={porId} />
          ))}
        </div>
      )}
    </div>
  );
}

function SegBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
        ativo ? "bg-brand-gradient text-white shadow-glow-primary" : "text-muted-foreground hover:text-secondary",
      )}
    >
      {children}
    </button>
  );
}

// ─── Cartão de um dia ───────────────────────────────────────────────────────

function DiaCard({
  cobertura,
  escalas,
  equipe,
  porId,
}: {
  cobertura: ReturnType<typeof coberturaDoDia>;
  escalas: CozinhaEscala[];
  equipe: CozinhaFuncionario[];
  porId: Map<string, CozinhaFuncionario>;
}) {
  const doDia = escalas.filter((e) => e.data === cobertura.data);
  const d = new Date(cobertura.data + "T00:00:00");
  const diaSemana = d.toLocaleDateString("pt-BR", { weekday: "short" });

  return (
    <Card className={cn(cobertura.algumDescoberto && "border-destructive/40")}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <span className="capitalize">{diaSemana}</span>
            <span className="text-muted-foreground">· {formatarDataBR(cobertura.data)}</span>
            <Badge variant="muted">{GRUPO_COZINHA_LABEL[cobertura.grupo]}</Badge>
          </span>
          {cobertura.algumDescoberto && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" /> Turno descoberto</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {TURNOS_COZINHA.map((turno) => (
          <TurnoBloco
            key={turno}
            turno={turno}
            data={cobertura.data}
            cobertura={cobertura.turnos.find((t) => t.turno === turno)!}
            entradas={doDia.filter((e) => e.inicio === partesTurno(turno).inicio)}
            entradasDoDia={doDia}
            equipe={equipe}
            porId={porId}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function TurnoBloco({
  turno,
  data,
  cobertura,
  entradas,
  entradasDoDia,
  equipe,
  porId,
}: {
  turno: TurnoCozinha;
  data: string;
  cobertura: ReturnType<typeof coberturaDoDia>["turnos"][number];
  entradas: CozinhaEscala[];
  entradasDoDia: CozinhaEscala[];
  equipe: CozinhaFuncionario[];
  porId: Map<string, CozinhaFuncionario>;
}) {
  const need = NECESSIDADE_TURNO[turno];
  const faltaLabel = (Object.keys(cobertura.faltam) as FuncaoCozinha[])
    .filter((f) => cobertura.faltam[f] > 0)
    .map((f) => `${cobertura.faltam[f]} ${FUNCAO_COZINHA_LABEL[f].toLowerCase()}${cobertura.faltam[f] > 1 ? "s" : ""}`)
    .join(", ");

  return (
    <div className={cn("rounded-lg border px-3 py-2.5", cobertura.descoberto ? "border-destructive/40 bg-destructive/5" : "border-border/70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold tabular-nums text-secondary">{turno.replace("-", " – ")}</span>
        <span className="text-[11px] text-muted-foreground">
          Necessário: {need.cozinheiro} coz.{need.auxiliar > 0 ? ` + ${need.auxiliar} aux.` : ""}
        </span>
      </div>
      {cobertura.descoberto && (
        <p className="mt-1 text-xs font-semibold text-destructive">Falta: {faltaLabel}</p>
      )}
      <div className="mt-2 space-y-1.5">
        {entradas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguém escalado.</p>
        ) : (
          entradas
            .slice()
            .sort((a, b) => (porId.get(a.funcionario_id)?.funcao ?? "").localeCompare(porId.get(b.funcionario_id)?.funcao ?? ""))
            .map((e) => (
              <EntradaLinha key={e.id} entrada={e} data={data} turno={turno} equipe={equipe} porId={porId} entradasDia={entradasDoDia} />
            ))
        )}
      </div>
    </div>
  );
}

function EntradaLinha({
  entrada,
  data,
  turno,
  equipe,
  porId,
  entradasDia,
}: {
  entrada: CozinhaEscala;
  data: string;
  turno: TurnoCozinha;
  equipe: CozinhaFuncionario[];
  porId: Map<string, CozinhaFuncionario>;
  entradasDia: CozinhaEscala[];
}) {
  const atualizar = useAtualizarEscala();
  const remover = useRemoverEscala();
  const [confirmar, setConfirmar] = useState(false);
  const func = porId.get(entrada.funcionario_id);

  // Substitutos elegíveis: mesma função, ativos, ainda não escalados no dia
  // (a unicidade funcionário+dia impede dupla marcação).
  const ocupadosNoDia = new Set(entradasDia.map((e) => e.funcionario_id));
  const substitutos = equipe.filter(
    (f) => f.ativo && f.funcao === func?.funcao && (f.id === entrada.funcionario_id || !ocupadosNoDia.has(f.id)),
  );

  function setPresenca(valor: boolean | null) {
    atualizar.mutate({ id: entrada.id, patch: { presente: valor } });
  }
  function trocar(novoId: string) {
    if (novoId === entrada.funcionario_id) return;
    atualizar.mutate(
      { id: entrada.id, patch: { funcionario_id: novoId } },
      { onSuccess: () => toast.success("Substituição registrada.") },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-card px-2 py-1.5">
      <Badge variant={func?.funcao === "cozinheiro" ? "secondary" : "muted"} className="shrink-0">
        {func ? FUNCAO_COZINHA_LABEL[func.funcao] : "Não informado"}
      </Badge>
      <select
        value={entrada.funcionario_id}
        onChange={(e) => trocar(e.target.value)}
        className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Trocar funcionário"
      >
        {substitutos.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>

      {/* Presença/falta — controle visual, NÃO é ponto */}
      <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-border/70">
        <PresBtn ativo={entrada.presente === true} tom="success" onClick={() => setPresenca(entrada.presente === true ? null : true)}>Presente</PresBtn>
        <PresBtn ativo={entrada.presente === false} tom="destructive" onClick={() => setPresenca(entrada.presente === false ? null : false)}>Falta</PresBtn>
      </div>

      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setConfirmar(true)} aria-label="Remover da escala (folga)">
        <Trash2 className="size-4 text-destructive" />
      </Button>

      <ConfirmDialog
        aberto={confirmar}
        titulo="Remover desta escala?"
        descricao={`${func?.nome ?? "Funcionário"} · ${formatarDataBR(data)} · ${turno.replace("-", " – ")}`}
        textoConfirmar="Remover"
        varianteConfirmar="destructive"
        onConfirmar={() => {
          remover.mutate(entrada.id, { onSuccess: () => toast.success("Removido da escala.") });
          setConfirmar(false);
        }}
        onCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}

function PresBtn({
  ativo,
  tom,
  onClick,
  children,
}: {
  ativo: boolean;
  tom: "success" | "destructive";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2 py-1 text-[11px] font-bold transition-colors",
        ativo
          ? tom === "success"
            ? "bg-success/15 text-success"
            : "bg-destructive/15 text-destructive"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// ─── Equipe (cadastro) ──────────────────────────────────────────────────────

const TURNO_VAZIO: TurnoCozinha = "06:30-18:30";

function Equipe({ equipe }: { equipe: CozinhaFuncionario[] }) {
  const [editando, setEditando] = useState<CozinhaFuncionario | "novo" | null>(null);

  const grupos: GrupoCozinha[] = ["par", "impar"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {equipe.filter((f) => f.ativo).length} ativos · {equipe.length} no total
        </p>
        <Button onClick={() => setEditando("novo")}>
          <Plus className="size-4" /> Novo funcionário
        </Button>
      </div>

      {editando && (
        <FormFuncionario
          inicial={editando === "novo" ? null : editando}
          onFechar={() => setEditando(null)}
        />
      )}

      {equipe.length === 0 ? (
        <EmptyState label="Nenhum funcionário cadastrado." />
      ) : (
        grupos.map((g) => {
          const doGrupo = equipe.filter((f) => f.grupo === g);
          if (doGrupo.length === 0) return null;
          return (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{GRUPO_COZINHA_LABEL[g]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {doGrupo.map((f) => (
                  <LinhaFuncionario key={f.id} func={f} onEditar={() => setEditando(f)} />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

function LinhaFuncionario({ func, onEditar }: { func: CozinhaFuncionario; onEditar: () => void }) {
  const definirAtivo = useDefinirAtivoFuncionario();
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5", !func.ativo && "opacity-60")}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-secondary">{func.nome}</span>
          <Badge variant={func.funcao === "cozinheiro" ? "secondary" : "muted"}>{FUNCAO_COZINHA_LABEL[func.funcao]}</Badge>
          {!func.ativo && <Badge variant="destructive">Inativo</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Turno {func.turno_padrao.replace("-", " – ")}
          {func.observacao ? ` · ${func.observacao}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onEditar}><Pencil className="size-4" /> Editar</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => definirAtivo.mutate({ id: func.id, ativo: !func.ativo })}
        >
          {func.ativo ? <X className="size-4" /> : <Check className="size-4" />}
          {func.ativo ? "Inativar" : "Reativar"}
        </Button>
      </div>
    </div>
  );
}

function FormFuncionario({
  inicial,
  onFechar,
}: {
  inicial: CozinhaFuncionario | null;
  onFechar: () => void;
}) {
  const salvar = useSalvarFuncionario();
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [funcao, setFuncao] = useState<FuncaoCozinha>(inicial?.funcao ?? "cozinheiro");
  const [grupo, setGrupo] = useState<GrupoCozinha>(inicial?.grupo ?? "par");
  const [turno, setTurno] = useState<TurnoCozinha>(inicial?.turno_padrao ?? TURNO_VAZIO);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");

  // Auxiliar não cobre o turno 08:00-20:00 (só cozinheiro) — guia visual.
  const turnosDisponiveis = TURNOS_COZINHA.filter(
    (t) => funcao === "cozinheiro" || NECESSIDADE_TURNO[t].auxiliar > 0,
  );

  async function submit() {
    if (nome.trim().length === 0) {
      toast.error("Informe o nome.");
      return;
    }
    const turnoOk = turnosDisponiveis.includes(turno) ? turno : turnosDisponiveis[0];
    try {
      await salvar.mutateAsync({
        id: inicial?.id,
        nome: nome.trim(),
        funcao,
        grupo,
        turno_padrao: turnoOk,
        observacao: observacao.trim() || null,
      });
      toast.success(inicial ? "Funcionário atualizado." : "Funcionário cadastrado.");
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{inicial ? "Editar funcionário" : "Novo funcionário"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-secondary">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className={inputBase} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Função</span>
            <select value={funcao} onChange={(e) => setFuncao(e.target.value as FuncaoCozinha)} className={inputBase}>
              <option value="cozinheiro">Cozinheiro</option>
              <option value="auxiliar">Auxiliar</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Grupo</span>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoCozinha)} className={inputBase}>
              <option value="par">Dias pares</option>
              <option value="impar">Dias ímpares</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-secondary">Turno padrão</span>
            <select value={turno} onChange={(e) => setTurno(e.target.value as TurnoCozinha)} className={inputBase}>
              {turnosDisponiveis.map((t) => (
                <option key={t} value={t}>{t.replace("-", " – ")}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-secondary">Observação (opcional)</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder={ouNaoInformado(null)} className={inputBase} />
        </label>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={salvar.isPending}>
            <Check className="size-4" /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onFechar} disabled={salvar.isPending}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Período (semana/mês) ───────────────────────────────────────────────────

function rangeDe(modo: "semana" | "mes", anchor: Date): { de: string; ate: string; titulo: string } {
  if (modo === "semana") {
    const ini = inicioDaSemana(anchor);
    const fim = somarDias(ini, 6);
    return {
      de: dataISO(ini),
      ate: dataISO(fim),
      titulo: `${formatarDataBR(dataISO(ini))} – ${formatarDataBR(dataISO(fim))}`,
    };
  }
  const ini = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const fim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const titulo = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { de: dataISO(ini), ate: dataISO(fim), titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1) };
}
