import { useMemo, useState } from "react";
import { Check, Plus, X, Clock4, Droplet, CircleDot, AlertTriangle, Loader2, Utensils } from "lucide-react";
import { toast } from "sonner";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { useHospedesDesignados } from "@/hooks/useHospedes";
import {
  usePlanoCuidado,
  useRegistrosHoje,
  useMarcarTarefa,
  useRemoverRegistro,
  useDefinirRefeicao,
} from "@/hooks/useChecklist";
import {
  useEliminacoes,
  useRegistrarEliminacao,
  useRemoverEliminacao,
  calcularAlertasEliminacao,
} from "@/hooks/useEliminacao";
import { useDietaAtiva } from "@/hooks/useNutricao";
import { usePlantao } from "@/hooks/usePlantao";
import { PlantaoBar } from "@/components/cuidador/PlantaoBar";
import { HospedeSelector } from "@/components/HospedeSelector";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { cn, horarioParaMinutos, horarioNoTurno, ouNaoInformado, formatarHoraBR } from "@/lib/utils";
import type { PlanoCuidadoItem, Residente, TarefaRegistro, Turno } from "@/types/database";

// 6 refeições, na ordem do dia, com horário de referência para filtrar por turno.
const REFEICOES = [
  { nome: "Café da manhã", horario: "08:00" },
  { nome: "Lanche da manhã", horario: "10:00" },
  { nome: "Almoço", horario: "12:00" },
  { nome: "Lanche da tarde", horario: "16:00" },
  { nome: "Jantar", horario: "19:00" },
  { nome: "Ceia", horario: "21:00" },
] as const;
const NIVEIS = ["Nada", "Pouco", "Metade", "Quase tudo", "Tudo"] as const;
const SOB_DEMANDA = ["Troca de fralda", "Troca de roupa", "Salão de beleza"] as const;

type StatusKey = "feito" | "atraso" | "em_breve" | "normal";

function calcularStatus(item: PlanoCuidadoItem, feito: boolean): {
  key: StatusKey;
  label: string;
  dot: string;
} {
  if (feito) return { key: "feito", label: "Feito", dot: "bg-success" };
  const alvo = horarioParaMinutos(item.horario);
  if (alvo === null) return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
  const agora = new Date();
  const nowMin = agora.getHours() * 60 + agora.getMinutes();
  if (nowMin > alvo + item.tolerancia_minutos)
    return { key: "atraso", label: "Em atraso", dot: "bg-destructive" };
  if (nowMin >= alvo - 30) return { key: "em_breve", label: "Em breve", dot: "bg-warning" };
  return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
}

export function Checklist() {
  const { data: hospedes, isLoading, isError, error } = useHospedesDesignados(CUIDADOR_ATUAL.id);
  const plantao = usePlantao();
  const [selecionadoId, setSelecionadoId] = useState<string | undefined>();

  const hospedeId = selecionadoId ?? hospedes?.[0]?.id;
  const hospedeSel = hospedes?.find((h) => h.id === hospedeId);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} />;
  if (!hospedes || hospedes.length === 0)
    return <EmptyState label="Você não possui hóspedes designados." />;

  return (
    <div className="space-y-6">
      {/* Controle de plantão: só libera os registros após check-in no turno. */}
      <PlantaoBar plantao={plantao} />
      <HospedeSelector
        hospedes={hospedes}
        selecionadoId={hospedeId}
        onSelect={setSelecionadoId}
      />
      {hospedeId && hospedeSel && (
        <ChecklistDoHospede
          key={hospedeId}
          residenteId={hospedeId}
          hospede={hospedeSel}
          liberado={plantao.liberado}
          turno={plantao.turnoAtivo}
        />
      )}
    </div>
  );
}

interface Confirmacao {
  titulo: string;
  descricao?: string;
  acao: () => void;
}

function ChecklistDoHospede({
  residenteId,
  hospede,
  liberado,
  turno,
}: {
  residenteId: string;
  hospede: Residente;
  liberado: boolean;
  turno: Turno | null;
}) {
  const plano = usePlanoCuidado(residenteId);
  const registros = useRegistrosHoje(residenteId);
  const marcar = useMarcarTarefa(residenteId);
  const remover = useRemoverRegistro(residenteId);
  const definirRefeicao = useDefinirRefeicao(residenteId);
  const dieta = useDietaAtiva(residenteId);

  const registrosHoje = registros.data ?? [];
  const planoItens = plano.data ?? [];
  const planIds = useMemo(() => new Set(planoItens.map((p) => p.id)), [planoItens]);
  const planoItensDoTurno = useMemo(
    () => planoItens.filter((item) => horarioNoTurno(item.horario, turno)),
    [planoItens, turno]
  );
  const refeicoesDoTurno = useMemo(
    () => REFEICOES.filter((r) => horarioNoTurno(r.horario, turno)),
    [turno]
  );

  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [outros, setOutros] = useState("");

  function registroDaTarefa(tarefaId: string): TarefaRegistro | undefined {
    return registrosHoje.find((r) => r.tarefa === tarefaId);
  }

  function onToggleTarefa(item: PlanoCuidadoItem) {
    const existente = registroDaTarefa(item.id);
    if (existente) {
      setConfirmacao({
        titulo: "Desfazer este registro?",
        descricao: item.tarefa,
        acao: () => remover.mutate(existente.id),
      });
    } else {
      marcar.mutate(
        { tarefa: item.id, horario: item.horario },
        { onSuccess: () => toast.success(`Tarefa marcada: ${item.tarefa}`) },
      );
    }
  }

  // ----- Aceitação alimentar -----
  function registroRefeicao(refeicao: string): TarefaRegistro | undefined {
    return registrosHoje.find((r) => r.tarefa.startsWith(`Aceitação ${refeicao}:`));
  }
  function selecionarRefeicao(refeicao: string, nivel: string) {
    const existente = registroRefeicao(refeicao);
    definirRefeicao.mutate(
      { registroId: existente?.id, tarefa: `Aceitação ${refeicao}: ${nivel}` },
      { onSuccess: () => toast.success(`${refeicao}: ${nivel}`) },
    );
  }

  // ----- Sob demanda -----
  const sobDemanda = registrosHoje.filter(
    (r) => !planIds.has(r.tarefa) && !r.tarefa.startsWith("Aceitação "),
  );

  // Resumo de dieta para exibir (consistência + restrições)
  const dietaResumo = dieta.data
    ? [dieta.data.consistencia, (dieta.data.restricoes ?? []).join(", ")]
        .filter((p) => p && p.trim())
        .join(" · ")
    : null;

  if (plano.isError) return <ErrorState error={plano.error} />;
  if (plano.isLoading || registros.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* ---- Header sticky: quem é o hóspede ---- */}
      <div className="sticky top-0 z-10 -mx-1 rounded-lg border border-secondary/20 bg-card/95 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-bold text-secondary">{hospede.nome}</span>
            <span className="ml-2 text-sm text-muted-foreground">Quarto {hospede.quarto ?? "—"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hospede.alergias && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="size-3" /> Alérgico a {hospede.alergias}
              </Badge>
            )}
            {dietaResumo && (
              <Badge variant="warning" className="gap-1 text-xs">
                <Utensils className="size-3" /> {dietaResumo}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ---- Tarefas do plano ---- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Tarefas do turno</CardTitle>
          <Legenda />
        </CardHeader>
        <CardContent className="space-y-3">
          {planoItens.length === 0 ? (
            <EmptyState label="Este hóspede ainda não possui plano de cuidado ativo." />
          ) : planoItensDoTurno.length === 0 ? (
            <EmptyState label="Nenhuma tarefa agendada para o seu turno." />
          ) : (
            planoItensDoTurno.map((item) => {
              const registro = registroDaTarefa(item.id);
              const feito = !!registro;
              const status = calcularStatus(item, feito);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                    feito && "border-success/30 bg-success/5",
                    status.key === "atraso" && "border-destructive/30 bg-destructive/5",
                    status.key === "em_breve" && "border-warning/40 bg-warning/5",
                  )}
                >
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <Clock4 className="size-4 text-muted-foreground" />
                    <span className="text-sm font-bold tabular-nums text-secondary">
                      {item.horario ?? "--:--"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-secondary">{item.tarefa}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={cn("size-2 rounded-full", status.dot)} />
                      {feito ? (
                        <span className="text-xs font-semibold text-success">
                          Feito às {formatarHoraBR(registro!.feito_em)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{status.label}</span>
                      )}
                      <Badge variant={item.responsavel === "enfermagem" ? "secondary" : "muted"}>
                        {ouNaoInformado(item.responsavel)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    variant={feito ? "outline" : "success"}
                    onClick={() => onToggleTarefa(item)}
                    disabled={!liberado || marcar.isPending || remover.isPending}
                  >
                    {(marcar.isPending || remover.isPending) ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : feito ? (
                      <X className="size-4" />
                    ) : (
                      <Check className="size-5" />
                    )}
                    {feito ? "Desfazer" : "Marcar feito"}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ---- Aceitação alimentar ---- */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle>Aceitação alimentar</CardTitle>
            {/* Resumo de dieta ativo: visibilidade no momento da refeição */}
            {dietaResumo && (
              <div className="flex items-center gap-1.5 rounded-md bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning-foreground">
                <Utensils className="size-3.5" />
                {dietaResumo}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {refeicoesDoTurno.length === 0 ? (
            <EmptyState label="Nenhuma refeição agendada para o seu turno." />
          ) : (
          refeicoesDoTurno.map(({ nome: refeicao }) => {
            const reg = registroRefeicao(refeicao);
            const nivelAtual = reg?.tarefa.split(": ")[1];
            return (
              <div key={refeicao}>
                <div className="mb-2 text-sm font-semibold text-secondary">{refeicao}</div>
                <div className="grid grid-cols-5 gap-2">
                  {NIVEIS.map((nivel) => {
                    const ativo = nivelAtual === nivel;
                    return (
                      <button
                        key={nivel}
                        onClick={() => selecionarRefeicao(refeicao, nivel)}
                        disabled={!liberado || definirRefeicao.isPending}
                        className={cn(
                          "rounded-md border px-2 py-4 text-sm font-semibold transition-all",
                          ativo
                            ? "border-primary bg-primary text-primary-foreground shadow-card"
                            : "border-border bg-card text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {definirRefeicao.isPending && ativo ? (
                          <Loader2 className="mx-auto size-4 animate-spin" />
                        ) : nivel}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
          )}
        </CardContent>
      </Card>

      {/* ---- Eliminações ---- */}
      <EliminacoesSection
        residenteId={residenteId}
        pedirConfirmacao={setConfirmacao}
        liberado={liberado}
      />

      {/* ---- Sob demanda ---- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Sob demanda</CardTitle>
          <Badge variant="default">{sobDemanda.length} hoje</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SOB_DEMANDA.map((label) => (
              <Button
                key={label}
                variant="outline"
                onClick={() => marcar.mutate(
                  { tarefa: label },
                  { onSuccess: () => toast.success(label) },
                )}
                disabled={!liberado || marcar.isPending}
              >
                <Plus className="size-4" /> {label}
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={outros}
              onChange={(e) => setOutros(e.target.value)}
              placeholder="Outros (descreva)…"
              disabled={!liberado}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              variant="secondary"
              disabled={!liberado || !outros.trim() || marcar.isPending}
              onClick={async () => {
                const tarefa = `Outros: ${outros.trim()}`;
                await marcar.mutateAsync({ tarefa });
                toast.success(tarefa);
                setOutros("");
              }}
            >
              {marcar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Adicionar
            </Button>
          </div>

          {sobDemanda.length > 0 && (
            <div className="space-y-2">
              {sobDemanda.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-secondary">{r.tarefa}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {formatarHoraBR(r.feito_em)}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setConfirmacao({
                        titulo: "Remover este registro?",
                        descricao: r.tarefa,
                        acao: () => remover.mutate(r.id),
                      })
                    }
                    disabled={!liberado || remover.isPending}
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    aria-label="Remover"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        aberto={!!confirmacao}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        textoConfirmar="Sim, desfazer"
        textoCancelar="Cancelar"
        onConfirmar={() => {
          confirmacao?.acao();
          setConfirmacao(null);
        }}
        onCancelar={() => setConfirmacao(null)}
      />
    </div>
  );
}

function Legenda() {
  const itens = [
    { label: "Feito", dot: "bg-success" },
    { label: "Em atraso", dot: "bg-destructive" },
    { label: "Em breve", dot: "bg-warning" },
    { label: "Normal", dot: "bg-muted-foreground/40" },
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {itens.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", i.dot)} />
          <span className="text-xs text-muted-foreground">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function EliminacoesSection({
  residenteId,
  pedirConfirmacao,
  liberado,
}: {
  residenteId: string;
  pedirConfirmacao: (c: Confirmacao) => void;
  liberado: boolean;
}) {
  const eliminacoes = useEliminacoes(residenteId);
  const registrar = useRegistrarEliminacao(residenteId);
  const remover = useRemoverEliminacao(residenteId);

  const registros = eliminacoes.data ?? [];
  const alertas = calcularAlertasEliminacao(registros);

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const deHoje = registros.filter((r) => new Date(r.registrado_em) >= inicioHoje);
  const urinaHoje = deHoje.filter((r) => r.tipo === "urina");
  const evacHoje = deHoje.filter((r) => r.tipo === "evacuacao");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eliminações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Alertas de vigilância clínica */}
        {(alertas.semEvacuacao72h || alertas.semUrinaHoje) && (
          <div className="space-y-2">
            {alertas.semEvacuacao72h && (
              <AlertaFaixa
                nivel="alto"
                texto="Sem evacuar há 3 dias ou mais — avise a enfermagem."
              />
            )}
            {alertas.semUrinaHoje && (
              <AlertaFaixa nivel="medio" texto="Sem registro de urina hoje — fique atento(a)." />
            )}
          </div>
        )}

        {/* Botões grandes de registro */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="h-20 flex-col gap-1.5 text-base"
            disabled={!liberado || registrar.isPending}
            onClick={() => registrar.mutate("urina", { onSuccess: () => toast.success("Urina registrada") })}
          >
            {registrar.isPending ? <Loader2 className="size-6 animate-spin" /> : <Droplet className="size-6" />}
            Urinou
          </Button>
          <Button
            variant="secondary"
            className="h-20 flex-col gap-1.5 text-base"
            disabled={!liberado || registrar.isPending}
            onClick={() => registrar.mutate("evacuacao", { onSuccess: () => toast.success("Evacuação registrada") })}
          >
            {registrar.isPending ? <Loader2 className="size-6 animate-spin" /> : <CircleDot className="size-6" />}
            Evacuou
          </Button>
        </div>

        {/* Resumo de hoje */}
        <div className="grid grid-cols-2 gap-3">
          <ResumoEliminacao
            rotulo="Urina"
            quantidade={urinaHoje.length}
            ultimo={urinaHoje[0]?.registrado_em ?? null}
          />
          <ResumoEliminacao
            rotulo="Evacuação"
            quantidade={evacHoje.length}
            ultimo={evacHoje[0]?.registrado_em ?? null}
          />
        </div>

        {/* Lista do dia (com remoção confirmada) */}
        {eliminacoes.isError ? (
          <ErrorState error={eliminacoes.error} />
        ) : deHoje.length > 0 ? (
          <div className="space-y-2">
            {deHoje.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2.5"
              >
                <div className="flex items-center gap-2">
                  {r.tipo === "urina" ? (
                    <Droplet className="size-4 text-primary" />
                  ) : (
                    <CircleDot className="size-4 text-secondary" />
                  )}
                  <span className="text-sm font-medium text-secondary">
                    {r.tipo === "urina" ? "Urina" : "Evacuação"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {formatarHoraBR(r.registrado_em)}
                  </span>
                </div>
                <button
                  onClick={() =>
                    pedirConfirmacao({
                      titulo: "Remover este registro?",
                      descricao: `${r.tipo === "urina" ? "Urina" : "Evacuação"} às ${formatarHoraBR(r.registrado_em)}`,
                      acao: () => remover.mutate(r.id),
                    })
                  }
                  disabled={!liberado || remover.isPending}
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  aria-label="Remover"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResumoEliminacao({
  rotulo,
  quantidade,
  ultimo,
}: {
  rotulo: string;
  quantidade: number;
  ultimo: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-sm font-semibold text-secondary">
        {rotulo}: {quantidade} vez{quantidade === 1 ? "" : "es"} hoje
      </div>
      <div className="text-xs text-muted-foreground">
        {ultimo ? `última às ${formatarHoraBR(ultimo)}` : "nenhum registro hoje"}
      </div>
    </div>
  );
}

function AlertaFaixa({ nivel, texto }: { nivel: "alto" | "medio"; texto: string }) {
  const classe =
    nivel === "alto"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/50 bg-warning/10 text-warning";
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3", classe)}>
      <AlertTriangle className="size-5 shrink-0" />
      <span className="text-sm font-semibold">{texto}</span>
    </div>
  );
}
